# Ocean Heatwave Prediction System: Full Technical Overview

Use this document as your "master pitch" when explaining your project to technical evaluators, developers, or professors. It logically breaks down the entire application from the problem statement to the deployment architecture.

## 1. The Core Problem
**Marine Heatwaves (MHWs)** are prolonged periods of extreme oceanic temperatures that severely damage marine ecosystems (e.g., coral bleaching) and impact global weather patterns. 

**The Solution:** This project is a full-stack, real-time monitoring and predictive dashboard. It ingests live global oceanic temperatures, applies standardized detection algorithms to identify current heatwaves, and uses machine learning to forecast future MHW severity up to 14 days in advance.

---

## 2. Theoretical Ground Truth
How does the system know what a heatwave is?
The project strictly implements the internationally standardized **Hobday et al. (2016)** MHW mathematical definition:
- It establishes a moving 30-day climatological baseline for specific geographic coordinates.
- It records an "event" only when the Sea Surface Temperature (SST) continuously exceeds the **90th percentile** of that historical baseline for **5 or more consecutive days**.

---

## 3. The Data Pipeline (API Architecture)
Rather than statically hosting massive, multi-terabyte CSV files locally—which is heavily inefficient—the system utilizes a dynamic, API-driven ingestion pipeline.

* **NOAA ERDDAP Integration:** The python backend and frontend connect directly to the US Government's *NOAA CoastWatch ERDDAP* servers.
* **Target Dataset:** We query the `ncdcOisst21Agg_LonPM180` dataset (NOAA's 0.25-degree Daily Optimum Interpolation Sea Surface Temperature v2.1).
* **Execution:** Through precisely formatted REST queries (e.g., `sst[(last-30):1:(last)]`), the app slices only the required real-time parameters out of NOAA's supercomputers and drops them directly into our application memory state. 

> [!TIP]
> Emphasize to technical reviewers that your project maintains **0 bytes of local CSV storage** while handling global geospatial datasets!

---

## 4. Machine Learning & Predictive Modeling
The system employs a dual-model ensemble pipeline to handle both current classifications and future regression forecasting.

### A. Random Forest (RF) Classifier — State Classification
- **Role:** Analyzes the real-time thermal state of the ocean and strictly categorizes it into severity tiers (Normal, Moderate, High alert).
- **Features:** Focuses intensely on short-term vectors (`anom_7d_mean`, `anom_7d_max`).
- **Validation:** Evaluated on ROC-AUC criteria to carefully balance prediction between rare, extreme MHW events and normal temperatures.

### B. Gradient Boosting (GB) Regressor — Time-Series Forecasting
- **Role:** Generates an accurate 14-day chronological projection of future ocean temperatures and directly calculates the statistical probability of an impending heatwave.
- **Features:** Looks at momentum (`SST_current`, `sst_14d_max`, `anom_30d_max`) to map trajectory.
- **Validation:** Minimized over residual errors using Mean Absolute Error (MAE) and R².

---

## 5. Frontend & Visualization Architecture
The user interface is an intricate, interactive Single Page Application (SPA).

* **Framework:** Built using **React.js** (bootstrapped with Vite for high-speed module bundling).
* **Theme & UI:** A custom-built, modern light-theme dashboard with component-based glass-morphism panels.
* **Geospatial Mapping:** Utilizes **D3.js** `geoOrthographic` projections to render a fully interactive, draggable 3D globe plotting active oceanic stations with severity-based animated pulse rings.
* **Data Visualization:** Uses **Recharts** to draw multi-layered area and bar graphs comparing climatology baselines, active SST trajectories, and MHW threshold markers dynamically.

---

## 6. System Resilience & Synthetic Fail-safes
What happens if the NOAA API server crashes or the user loses internet?
The project features an incredibly robust fallback mechanism: **The Synthetic `sstEngine`**.

If the live API request times out, the application dynamically generates its own hyper-realistic historical data pool using sinusoidal physics:
1. Projects an anchored latitudinal base temperature.
2. Mathematically calculates annual and semi-annual wave formations (`Math.sin(2 * Math.PI * doy / 365.25)`).
3. Superimposes quasi-periodic **ENSO** oscillations (simulating complex El Niño cycles every 3-7 years).
4. Layers an artificial 0.022°C/year linear anthropogenic global warming trend. 

> [!IMPORTANT]
> The inclusion of this physics-based fallback engine proves advanced engineering foresight. The architecture dictates that the UI will *never* freeze or display blank charts.
