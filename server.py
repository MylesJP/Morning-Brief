import os
from tracemalloc import start
import requests
import smtplib
from email.message import EmailMessage
import requests
from bs4 import BeautifulSoup
import schedule
import time
from datetime import datetime, timezone, timedelta

# App texts user every Monday morning with week tide preds

DG_STATION_ID = "5cebf1de3d0f4a073c4bba3e"
BASE_URL = "https://api.iwls-sine.azure.cloud-nuage.dfo-mpo.gc.ca"
TIDE_API = f"/api/v1/stations/"

time_series_code = "wlo"
start_time = datetime.now(timezone.utc)
start_time_iso = start_time.replace(microsecond=0).isoformat()[:-6] + "Z"
end_time = start_time + timedelta(days=1)
end_time_iso = end_time.replace(microsecond=0).isoformat()[:-6] + "Z"
resolution = "FIFTEEN_MINUTES"


def get_tides(station_id, time_series_code, start_time_iso, end_time_iso, resolution):
    try:
        params = {
            "time-series-code": time_series_code,
            "from": start_time_iso,
            "to": end_time_iso,
            "resolution": resolution
        }
        response = requests.get(BASE_URL + TIDE_API + station_id + "/data", params=params)
        print(response.url)
        tide_data = response.json()
        return tide_data
    except Exception as e:
        print("Error occured while fetching tide data:", e)


print(get_tides(DG_STATION_ID, time_series_code, start_time_iso, end_time_iso, resolution))

print(start_time_iso)
print(end_time_iso)
# https://api.iwls-sine.azure.cloud-nuage.dfo-mpo.gc.ca/api/v1/stations/5cebf1de3d0f4a073c4bba3e/data?time-series-code=wlo&from=2024-02-14T00%3A00%3A00Z&to=2024-02-15T00%3A00%3A00Z&resolution=FIFTEEN_MINUTES
# https://api.iwls-sine.azure.cloud-nuage.dfo-mpo.gc.ca/api/v1/stations/5cebf1de3d0f4a073c4bba3e/data?time-series-code=wlo&from=2024-02-15T06%3A21%3A53%2B00%3A00Z&to=2024-02-22T06%3A21%3A53%2B00%3A00Z&resolution=FIFTEEN_MINUTES

# Bad: https://api.iwls-sine.azure.cloud-nuage.dfo-mpo.gc.ca/api/v1/stations/5cebf1de3d0f4a073c4bba3e/data?time-series-code=wlo&from=2024-02-15T06%3A30%3A06Z&to=2024-02-22T06%3A30%3A06Z&resolution=FIFTEEN_MINUTES
# Gud: https://api.iwls-sine.azure.cloud-nuage.dfo-mpo.gc.ca/api/v1/stations/5cebf1de3d0f4a073c4bba3e/data?time-series-code=wlo&from=2024-02-14T00%3A00%3A00Z&to=2024-02-15T00%3A00%3A00Z&resolution=FIFTEEN_MINUTES