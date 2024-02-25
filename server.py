import os
from dotenv import load_dotenv
import smtplib
from email.message import EmailMessage
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import schedule
import time
import pandas as pd
from datetime import datetime, timezone, timedelta
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import numpy as np
from scipy.signal import find_peaks

def download_tides_data(url, download_dir):
    options = Options()
    options.add_argument("--headless")
    options.add_experimental_option("prefs", {
        "download.default_directory": download_dir,
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True  # You can set this to False if you want to disable the Safe Browsing feature
    })   

    with webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options) as driver:
        driver.get(url)
        time.sleep(5)
        # Select the "Predictions" option from the dropdown
        dropdown = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID, 'export-select')))
        dropdown.find_element(By.CSS_SELECTOR, "option[value='Predictions']").click()

        # Click the export button
        export_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID, 'export_button')))
        filename = "predictions_" + export_button.get_attribute('data-filename') + ".csv"  # Save the filename for later
        export_button.click()

        time.sleep(5)  # Wait 3 seconds for file to download

    return os.path.join(download_dir, filename)


def process_tide_data(csv_file):
    df = pd.read_csv(csv_file)
    df['Date'] = pd.to_datetime(df['Date'].str.split(' ', expand=True).iloc[:, :2].agg(' '.join, axis=1), format="%Y-%m-%d %H:%M")
    df['date_only'] = df['Date'].dt.date

    # Only want data from today on
    today = datetime.now().date()
    df = df[df['date_only'] >= today]

    tide_preds = {}
    for date, group in df.groupby('date_only'):
        # Locate local minima and maxima for low and high tides each day
        preds = group['predictions (m)'].values
        high_tides = find_peaks(preds)[0]
        low_tides = find_peaks(-preds)[0]

        # Sort and keep the top 2 high tides and low tides for the day based on their height
        high_tides = sorted(high_tides, key=lambda x: preds[x], reverse=True)[:2]
        low_tides = sorted(low_tides, key=lambda x: preds[x])[:2]

        tide_preds[date] = {
            'High Tides': [(group.iloc[i]['Date'], preds[i]) for i in high_tides],
            'Low Tides': [(group.iloc[i]['Date'], preds[i]) for i in low_tides]
        }

    os.remove(csv_file)
    return tide_preds

def format_tide_message(tide_preds):
    messages = []
    for date, tides in tide_preds.items():
        message = f"{date}\n"
        # Merge high and low tides, tagging each entry with its type
        combined_tides = [('High', *tide) for tide in tides['High Tides']] + \
                        [('Low', *tide) for tide in tides['Low Tides']]

        sorted_tides = sorted(combined_tides, key=lambda x: x[1])
        
        for tide_type, time, level in sorted_tides:
            # Format the time to only show hour and minute
            time_str = time.strftime("%H:%M")
            message += (f"  {tide_type}: {time_str} - {level}m\n")
        messages.append(message)
    return "\n".join(messages)


def send_sms(phone_number, message, smtp_user, smtp_pass):
    smtp_host = "smtp.office365.com"
    smtp_port = 587
    email_address = phone_number + "@txt.bell.ca"

    # Setup email message
    msg = MIMEMultipart()
    msg['From'] = smtp_user
    msg['To'] = email_address
    msg['Subject'] = ''
    msg.attach(MIMEText(message, 'plain'))

    # Send SMS
    try:
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        text = msg.as_string()
        server.sendmail(smtp_user, email_address, text)
        server.quit()
    except Exception as e:
        print(f"Failed: {e}")


def main_workflow():
    load_dotenv()
    smtp_user = os.getenv('SMTP_USER')
    smtp_pass = os.getenv('SMTP_PASS')
    phone_number = os.getenv('PHONE_NUMBER')
    download_dir = "/home/myles/Documents/Code/Morning-Brief/CSVs"
    url = "https://tides.gc.ca/en/stations/9850/"

    csv_file = download_tides_data(url=url, download_dir=download_dir)
    tide_preds = process_tide_data(csv_file=csv_file)
    message = format_tide_message(tide_preds=tide_preds)
    send_sms(phone_number=phone_number, message=message, smtp_user=smtp_user, smtp_pass=smtp_pass)
    print(f"Sent successfully on {datetime.now().date()}")

schedule.every(5).days.do(main_workflow)

if __name__ == "__main__":
    while True:
        schedule.run_pending()
        time.sleep(1)
