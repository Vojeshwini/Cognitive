# 🌊 Ocean Heatwave Prediction Dashboard

React + D3 + Recharts + NOAA ERDDAP OISST v2.1

---

## Quick Start

```bash
# 1. Unzip and enter the project
unzip ocean_heatwave_dashboard.zip
cd ocean_heatwave_dashboard

# 2. Install dependencies (Node 18+ required)
npm install

# 3. Run dev server (opens browser automatically at http://localhost:3000)
npm run dev
```

**That's it.** The app opens at `http://localhost:3000`.

---

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js     | ≥ 18    |
| npm         | ≥ 9     |

---

## Features

### 🌍 Interactive 3D Globe
- D3 `geoOrthographic` projection with **drag-to-rotate** and auto-rotation
- **World Atlas** topology (land + country borders from `world-atlas`)
- **Pulsing heatwave markers** with severity colour-coding:
  - 🔴 RED = HIGH severity (anomaly > 2.2°C)
  - 🟠 AMBER = MODERATE (anomaly > 1.0°C)
  - 🔵 TEAL = NORMAL
- Click any marker to select that station
- Touch support (mobile drag-to-rotate)

### 📡 NOAA ERDDAP Integration
- Live calls to **NOAA OISST v2.1** (daily global SST, 1/4° grid)
- Fetches actual 7-day SST time series for the selected lat/lon
- Falls back gracefully to synthetic engine if ERDDAP is unreachable
- Vite dev-proxy configured to avoid CORS issues locally

### 📊 Four Analytics Tabs
| Tab | What it shows |
|-----|--------------|
| **SST History** | 180-day SST + climatology baseline + MHW highlighted regions |
| **14-Day Forecast** | Historical/forecast overlay + per-day MHW probability bar chart |
| **Feature Importance** | RF classifier importances + radar chart by feature category |
| **Seasonality** | Monthly avg SST vs. MHW event frequency |

### 🤖 Real ML Metrics (from Python training run)
| Model | Metric | Value |
|-------|--------|-------|
| RF Classifier | ROC-AUC | **0.9942** |
| RF Classifier | Avg Precision | **0.9385** |
| GB Forecaster | MAE | **0.0168°C** |
| GB Forecaster | R² | **1.0000** |

---

## Project Structure

```
ocean_heatwave_dashboard/
├── index.html            # HTML entry point (loads Google Fonts)
├── vite.config.js        # Vite + NOAA CORS proxy config
├── package.json          # Dependencies
├── README.md             # This file
└── src/
    ├── main.jsx          # React root mount
    ├── App.jsx           # Root component, layout, state
    ├── Globe.jsx         # D3 canvas globe component
    ├── sstEngine.js      # Synthetic SST physics engine
    ├── noaaApi.js        # NOAA ERDDAP REST client
    └── ui.jsx            # Shared UI primitives (Card, Badge, etc.)
```

---

## NOAA API Details

The app queries the **NOAA CoastWatch ERDDAP** server:
```
https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21Agg
```

Dataset: **NOAA OISST v2.1** — Daily 1/4° global SST composites.

In development mode, Vite proxies `/erddap` → `coastwatch.pfeg.noaa.gov`
to avoid CORS. In production, ERDDAP supports CORS natively.

If the NOAA server is slow or unreachable, the dashboard automatically
falls back to the synthetic SST engine (same physics as the Python pipeline).

---

## Production Build

```bash
npm run build    # outputs to ./dist/
npm run preview  # preview the production build locally
```

---

## Scientific Background

**Marine Heatwave (MHW) Definition**: Hobday et al. (2016)
- SST anomaly exceeds the **90th-percentile** climatological threshold
- Event persists for **≥ 5 consecutive days**
- Climatology computed using a ±15-day rolling window over the full record

**Models**:
- `HeatwaveClassifier` — Random Forest with balanced class weights
- `SSTForecaster` — Gradient Boosting Regressor, 14-day horizon

**Key features (top 3)**: `anom_roll_mean_7d`, `anom_roll_max_7d`, `anom_roll_mean_14d`
