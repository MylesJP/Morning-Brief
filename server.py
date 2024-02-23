import csv
import enum
import os
from sys import dont_write_bytecode
from tracemalloc import start
from urllib import request
import requests
import smtplib
from email.message import EmailMessage
import requests
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

url = "https://tides.gc.ca/en/stations/9850/"

# Setup download path first
download_dir = "/home/myles/Documents/Code/Morning-Brief/CSVs"
# Setup Chrome options
options = Options()
options.add_experimental_option("prefs", {
    "download.default_directory": download_dir,
    "download.prompt_for_download": False,
    "download.directory_upgrade": True,
    "safebrowsing.enabled": True  # You can set this to False if you want to disable the Safe Browsing feature
})

# Initialize the Chrome WebDriver
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)


try:
    # Navigate to the page and wait 5 seconds for it to load
    driver.get(url)
    time.sleep(3)

    # Select the "Predictions" option from the dropdown
    dropdown = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID, 'export-select')))
    dropdown.find_element(By.CSS_SELECTOR, "option[value='Predictions']").click()

    # Click the export button
    export_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID, 'export_button')))
    filename = "predictions_" + export_button.get_attribute('data-filename') + ".csv"  # Save the filename for later
    export_button.click()

    time.sleep(3)  # Wait 3 seconds for file to download

finally:
    driver.quit()

csv_file = os.path.join(download_dir, filename)
df = pd.read_csv(csv_file)
# print(df.head())

# Correctly retain both date and time while removing the timezone
df['Date'] = df['Date'].str.split(' ', expand=True).iloc[:, :2].agg(' '.join, axis=1)

# Now, convert the 'Date' column to datetime objects without the timezone
df['Date'] = pd.to_datetime(df['Date'], format="%Y-%m-%d %H:%M")

# We want to work day by day
df['date_only'] = df['Date'].dt.date

tide_preds = {}

for date, group in df.groupby('date_only'):
    # Locate local minima and maxima for low and high tides each day
    preds = group['predictions (m)'].values
    high_tides = find_peaks(preds)[0]
    low_tides = find_peaks(-preds)[0]

    # Sort and keep the top 2 high tides and low tides for the day based on their height
    high_tides = sorted(high_tides, key=lambda x: preds[x], reverse=True)[:2]
    low_tides = sorted(low_tides, key=lambda x: preds[x])[:2]

    # Store results
    tide_preds[date] = {
        'High Tides': [(group.iloc[i]['Date'], preds[i]) for i in high_tides],
        'Low Tides': [(group.iloc[i]['Date'], preds[i]) for i in low_tides]
    }

for date, tides in tide_preds.items():
    print(f"Date: {date}")
    # Merge high and low tides, tagging each entry with its type
    combined_tides = [('High Tide', *tide) for tide in tides['High Tides']] + \
                     [('Low Tide', *tide) for tide in tides['Low Tides']]
    
    # Sort the combined list by the datetime (which is now the second element in each tuple)
    sorted_tides = sorted(combined_tides, key=lambda x: x[1])
    
    # Print the sorted tide information, displaying only the hour and minute
    for tide_type, time, level in sorted_tides:
        # Format the time to only show hour and minute
        time_str = time.strftime("%H:%M")
        print(f"{tide_type}: {time_str} - {level}m")

# Delete the CSV afterwards
try:
    os.remove(csv_file)
    print("Successfully deleted")
except OSError as e:
    print(f"Error: {e.strerror}")