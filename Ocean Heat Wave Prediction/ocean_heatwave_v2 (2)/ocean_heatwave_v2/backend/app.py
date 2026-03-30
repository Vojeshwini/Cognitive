"""
Ocean Heatwave Prediction — Flask Backend
Serves real NOAA erdBAssta5day SST data via /real-data endpoint.
"""

from flask import Flask, jsonify
from flask_cors import CORS
import requests
import io
import csv

# ✅ Create app FIRST
app = Flask(__name__)
CORS(app)  # allow frontend dev server

# ✅ Add root route AFTER app creation
@app.route("/")
def home():
    return "Backend is running 🚀"

NOAA_URL = (
    "https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21Agg_LonPM180.csv"
    "?sst[(last)][0:1:0][(-89.99):1:(89.99)][(-179.99):1:(180.0)]"
)

@app.route('/predict')
def predict():
    return jsonify({"status": "ok", "model": "RF+GB Ocean Heatwave Predictor"})


@app.route('/real-data')
def real_data():
    try:
        resp = requests.get(NOAA_URL, timeout=45)
        resp.raise_for_status()
    except Exception as e:
        return jsonify({"error": f"NOAA fetch failed: {str(e)}"}), 502

    data = []
    f = io.StringIO(resp.text)
    reader = csv.DictReader(f)
    for row in reader:
        try:
            sst = float(row.get("sst", "NaN"))
            lat = float(row.get("latitude", "NaN"))
            lon = float(row.get("longitude", "NaN"))
            if -2 <= sst <= 35:
                data.append({
                    "lat": round(lat, 2),
                    "lon": round(lon, 2),
                    "sst": round(sst, 3)
                })
        except (ValueError, TypeError):
            continue

    return jsonify(data)


if __name__ == "__main__":
    app.run(debug=True, port=5000)