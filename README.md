# Precipitation Outlook Dashboard

## Setup & Run

### Prerequisites
- Node.js 18+ installed

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
The app will be hosted at: **http://172.18.0.22:5003**

### Production Build
```bash
npm run build
npm run preview
```

## Project Structure
```
precip-dashboard/
├── index.html        # Main HTML entry point
├── styles.css        # Dashboard styles
├── script.js         # Mapbox + Chart.js logic
├── vite.config.js    # Vite configuration (host + port)
├── package.json      # Dependencies & scripts
└── README.md         # This file
```

## Notes
- The dashboard uses **Mapbox GL JS** for globe maps (API token already embedded)
- **Chart.js** handles the precipitation trend chart
- **GeoServer** boundary tiles are fetched from `http://172.18.7.21:8080`
- Vite serves all static assets with HMR in development mode
