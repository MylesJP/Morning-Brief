import csv
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
    # driver.get_screenshot_as_file("a_test_screenshot.png")

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
print(df.head())