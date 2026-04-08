// function.js
import { WB_LYR, GEOSERVER_WMS, WMS_LAYERS, isTimeField } from "./script.js";
import { graph_data } from "./zonal_means_final.js";
if (window.ChartDataLabels) {
  Chart.register(window.ChartDataLabels);
}

let precipChartInstance = null;
let WB_SRC = "world_boundaries";
let GEO = "/geo-proxy";
let WB_TILES = `${window.location.origin}/geo-proxy/gwc/service/tms/1.0.0/regional_dew:countries@EPSG:900913@pbf/{z}/{x}/{y}.pbf`;
let syncing = false;



export function renderPrecipChart(dataObj) {
  if (!dataObj || typeof dataObj !== "object") return;

  const keysSorted = Object.keys(dataObj).sort();
  const labels = keysSorted.map((k) => k.slice(0, 4));
  const values = keysSorted.map((k) => dataObj[k]);

  const canvas = document.getElementById("precipChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (precipChartInstance) precipChartInstance.destroy();

  const isMobile = window.innerWidth <= 767;

  const gradHistoric = ctx.createLinearGradient(0, 0, 0, 180);
  gradHistoric.addColorStop(0, "rgba(34,211,238,0.55)");
  gradHistoric.addColorStop(1, "rgba(34,211,238,0.04)");

  precipChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Precipitation (mm)",
          data: values,
          backgroundColor: values.map((v, i) =>
            i === values.length - 1 ? "rgba(251,191,36,0.65)" : gradHistoric
          ),
          borderColor: values.map((v, i) =>
            i === values.length - 1
              ? "rgba(251,191,36,0.90)"
              : "rgba(34,211,238,0.85)"
          ),
          borderWidth: 1.5,
          borderRadius: 7,
          borderSkipped: "bottom",
          order: 2,

          // labels INSIDE bars — vertical on mobile
          datalabels: {
            anchor: "center",
            align: "center",
            rotation: isMobile ? -90 : 0,
            clamp: true,
            color: "#ffffff",
            font: {
              family: "Candara, Segoe UI, sans-serif",
              weight: "600",
              size: isMobile ? 7 : 11,
            },
            formatter: (v) => (v != null ? v.toFixed(1) : ""),
            display: (ctx) => {
              const meta = ctx.chart.getDatasetMeta(ctx.datasetIndex);
              const bar = meta.data[ctx.dataIndex];
              return bar && bar.height > (isMobile ? 20 : 18);
            },
          },
        },
        {
          type: "line",
          label: "Precipitation (mm)",
          data: values,
          borderColor: "rgba(167,139,250,0.80)",
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.45,
          order: 1,

          datalabels: { display: false },
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      animation: false,

      plugins: {
        legend: {
          display: true,
          position: "top",
          align: "end",
          labels: {
            font: { size: isMobile ? 9 : 12 },
            boxWidth: isMobile ? 14 : 24,
            boxHeight: isMobile ? 7 : 12,
            padding: isMobile ? 6 : 10,
            color: "rgba(240,246,255,0.80)",
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.type === "line") return null;
              return ctx.parsed.y != null
                ? ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} mm`
                : null;
            },
          },
        },

        datalabels: {
          display: true,
          clip: true,
        },
      },

      scales: {
        x: {
          beginAtZero: true,
          ticks: { font: { size: isMobile ? 8 : 11 } },
        },
        y: {
          beginAtZero: true,
          ticks: { font: { size: isMobile ? 8 : 11 } },
        },
      },
    },
    plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
  });

  // extra-safe: force a draw so labels appear immediately
  precipChartInstance.update("none");
}

export function ensureWorldBoundaries(map) {
  if (!map.getSource(WB_SRC))
    map.addSource(WB_SRC, { type: "vector", scheme: "tms", tiles: [WB_TILES], minzoom: 0, maxzoom: 14 });

  if (!map.getLayer(WB_LYR))
    map.addLayer({
      id: WB_LYR,
      type: "line",
      source: WB_SRC,
      "source-layer": "countries",
      paint: { "line-opacity": 0.8, "line-color": "#00ffdd", "line-width": 1 },
    });

  map.moveLayer(WB_LYR);
}


export function wmsTile(layerFullName) {
  // layerFullName example: "regional_dew:2025_04_classes50" or "regional_dew:2025_05"
  return (
    `${GEOSERVER_WMS}?service=WMS&version=1.1.1&request=GetMap` +
    `&layers=${encodeURIComponent(layerFullName)}` +
    `&styles=` +
    `&bbox={bbox-epsg-3857}` +
    `&width=256&height=256` +
    `&srs=EPSG:3857` +
    `&format=image/png` +
    `&transparent=true`
  );
}

export function addRasterLayer(map, month, year) {
  if (!map) return;

  // Remove all existing DEW raster layers first
  removeAllDewRasters(map);

  const layerId = `dew-layer-${year}-${month}`;
  const tileUrl = WMS_LAYERS[`${month}_${year}`];

  if (!tileUrl) {
    console.warn("No WMS layer configured for:", `${month}_${year}`);
    return;
  }

  // Add (fresh) source
  if (!map.getSource(layerId)) {
    map.addSource(layerId, {
      type: "raster",
      tiles: [tileUrl],
      tileSize: 256,
    });
  }

  // Add layer
  if (!map.getLayer(layerId)) {
    map.addLayer({
      id: layerId,
      type: "raster",
      source: layerId,
      paint: { "raster-opacity": 0.7 },
    });
  }
}

function removeAllDewRasters(map) {
  // remove layers first
  const layers = map.getStyle()?.layers || [];
  for (const l of layers) {
    if (l.id && l.id.startsWith("dew-layer-") && map.getLayer(l.id)) {
      map.removeLayer(l.id);
    }
  }

  // then remove sources with same naming
  const sources = map.getStyle()?.sources || {};
  for (const sourceId of Object.keys(sources)) {
    if (sourceId.startsWith("dew-layer-") && map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  }
}

export function buildGlobeMap(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const map = new mapboxgl.Map({
    container,
    style: "mapbox://styles/mapbox/dark-v11",
    projection: "globe",
    center: [69.3451, 30.3753],
    zoom: 2,
    attributionControl: false,
  });
  const fog = () =>
    map.setFog({ range: [0.8, 8], color: "gray", "horizon-blend": 0.01, "space-color": "black", "star-intensity": 1 });

  map.on("load", () => {
    fog();
    ensureWorldBoundaries(map);
  });

  map.on("style.load", () => {
    fog();
    ensureWorldBoundaries(map);
  });

  map.on("styledata", () => map.getLayer(WB_LYR) && map.moveLayer(WB_LYR));

  return map;
}

export function syncMaps(source, target) {
  if (!source || !target) return;

  source.on("move", () => {
    if (syncing) return;
    syncing = true;
    target.jumpTo({
      center: source.getCenter(),
      zoom: source.getZoom(),
      bearing: source.getBearing(),
      pitch: source.getPitch(),
    });
    syncing = false;
  });
}


export function getAverageObject(features) {
  if (!features?.length) return null;

  const sums = {};
  const counts = {};

  for (const f of features) {
    for (const [k, v] of Object.entries(f)) {
      if (!isTimeField(k)) continue;
      if (typeof v !== "number" || !Number.isFinite(v)) continue;

      sums[k] = (sums[k] || 0) + v;
      counts[k] = (counts[k] || 0) + 1;
    }
  }

  const avg = {};
  for (const k of Object.keys(sums)) avg[k] = +(sums[k] / counts[k]).toFixed(4);
  return avg;
}

export function filterFeatures(level, key) {
  const field = level === "country" ? "name_en" : level;
  const want = key.trim().toLowerCase();

  return graph_data.filter((f) => {
    const v = (f?.[field] ?? "").toString().trim().toLowerCase();
    return v === want;
  });
}










// functions.js
// === ORG BOUNDARY HIGHLIGHT (GeoServer WFS -> Mapbox line layer) ===
const ORG_HL_SOURCE_ID = "org-countries-src";
const ORG_HL_LINE_ID = "org-countries-outline";

// =========================
// ✅ BLINK CONFIG + STATE
// =========================
const ORG_BLINK_ENABLED_DEFAULT = true;     // set false if you want default off
const ORG_BLINK_MIN_OPACITY = 0.15;         // lowest opacity during blink
const ORG_BLINK_MAX_OPACITY = 0.95;         // highest opacity during blink
const ORG_BLINK_PERIOD_MS = 900;            // one full cycle time (ms). lower = faster

function ensureBlinkState(map) {
  if (!map) return;
  if (!map.__orgBlink) {
    map.__orgBlink = {
      enabled: ORG_BLINK_ENABLED_DEFAULT,
      raf: null,
      startTs: 0,
      lastOpacity: null,
    };
  }
}

function stopOrgBlink(map) {
  if (!map?.__orgBlink) return;
  const st = map.__orgBlink;
  if (st.raf) {
    cancelAnimationFrame(st.raf);
    st.raf = null;
  }
  st.startTs = 0;
  st.lastOpacity = null;

  // restore a stable opacity if layer exists
  if (map.getLayer(ORG_HL_LINE_ID)) {
    try {
      map.setPaintProperty(ORG_HL_LINE_ID, "line-opacity", 0.95);
    } catch (_) { }
  }
}

function startOrgBlink(map) {
  ensureBlinkState(map);
  const st = map.__orgBlink;
  if (!st.enabled) return;

  // already running
  if (st.raf) return;

  st.startTs = performance.now();

  const tick = (now) => {
    // stop if style/layer gone
    if (!map || !map.getLayer(ORG_HL_LINE_ID)) {
      stopOrgBlink(map);
      return;
    }

    const t = (now - st.startTs) % ORG_BLINK_PERIOD_MS;
    const phase = t / ORG_BLINK_PERIOD_MS; // 0..1

    // smooth sine wave 0..1
    const wave01 = (Math.sin(phase * Math.PI * 2) + 1) / 2;

    // map to opacity range
    const op = ORG_BLINK_MIN_OPACITY + wave01 * (ORG_BLINK_MAX_OPACITY - ORG_BLINK_MIN_OPACITY);

    // reduce redundant setPaintProperty calls
    if (st.lastOpacity === null || Math.abs(st.lastOpacity - op) > 0.01) {
      try {
        map.setPaintProperty(ORG_HL_LINE_ID, "line-opacity", op);
        st.lastOpacity = op;
      } catch (_) { }
    }

    st.raf = requestAnimationFrame(tick);
  };

  st.raf = requestAnimationFrame(tick);
}

// Optional public toggle if you want to enable/disable blinking externally
export function setOrgBlink(map, enabled) {
  ensureBlinkState(map);
  map.__orgBlink.enabled = !!enabled;
  if (map.__orgBlink.enabled) startOrgBlink(map);
  else stopOrgBlink(map);
}

// build a WFS GeoJSON URL for your layer
function makeWfsGeojsonUrl() {
  const base = `${window.location.origin}/geo-proxy/regional_dew/ows`;
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    typeName: "regional_dew:countries",
    outputFormat: "application/json",
  });
  return `${base}?${params.toString()}`;
}

function ensureOrgHighlightLayer(map) {
  // source
  if (!map.getSource(ORG_HL_SOURCE_ID)) {
    map.addSource(ORG_HL_SOURCE_ID, {
      type: "geojson",
      data: makeWfsGeojsonUrl(),
    });
  }

  // line layer
  if (!map.getLayer(ORG_HL_LINE_ID)) {
    map.addLayer({
      id: ORG_HL_LINE_ID,
      type: "line",
      source: ORG_HL_SOURCE_ID,
      paint: {
        "line-color": "#ff2a2a",
        "line-width": 2,
        "line-opacity": ORG_BLINK_MAX_OPACITY, // start at max
      },
    });
  }

  // force top
  try {
    map.moveLayer(ORG_HL_LINE_ID);
  } catch (_) { }
}

function normStr(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

// Normalize your filters.js arrays into a list of country names
function extractCountryNames(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => x?.Country ?? x?.country ?? x?.name_en ?? x?.NAME_EN ?? x?.name)
    .filter(Boolean)
    .map((s) => String(s).trim());
}

// Extract subregions from filters.js arrays
function extractSubregions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => x?.Subregion ?? x?.subregion ?? x?.SUBREGION)
    .filter(Boolean)
    .map((s) => String(s).trim());
}

// Mapbox expression to read a property that might have different keys
function featureCountryExprLower() {
  return [
    "downcase",
    [
      "to-string",
      [
        "coalesce",
        ["get", "name_en"],
        ["get", "NAME_EN"],
        ["get", "Country"],
        ["get", "country"],
        ["get", "name"],
      ],
    ],
  ];
}

function featureSubregionExprLower() {
  return [
    "downcase",
    [
      "to-string",
      [
        "coalesce",
        ["get", "subregion"],
        ["get", "Subregion"],
        ["get", "SUBREGION"],
        ["get", "sub_region"],
        ["get", "SUB_REGION"],
      ],
    ],
  ];
}

// Keep highlight on top even if other layers get added later
function attachBumpToTop(map) {
  // remove old handler (if any)
  if (map.__orgBumpHandler) {
    map.off("styledata", map.__orgBumpHandler);
  }

  const handler = () => {
    if (map.getLayer(ORG_HL_LINE_ID)) {
      try {
        map.moveLayer(ORG_HL_LINE_ID);
      } catch (_) { }
    }
  };

  map.__orgBumpHandler = handler;
  map.on("styledata", handler);
}

function detachBumpToTop(map) {
  if (map?.__orgBumpHandler) {
    map.off("styledata", map.__orgBumpHandler);
    map.__orgBumpHandler = null;
  }
}

// Public API
export function setOrgCountriesOutline(map, countryListLikeFiltersJsArray) {
  if (!map) return;

  const names = extractCountryNames(countryListLikeFiltersJsArray);
  const namesLower = names.map(normStr).filter(Boolean);

  // If none selected: remove highlight
  if (!namesLower.length) {
    removeOrgCountriesOutline(map);
    return;
  }

  // Make sure style is loaded
  if (!map.isStyleLoaded()) {
    map.once("load", () => setOrgCountriesOutline(map, countryListLikeFiltersJsArray));
    return;
  }

  ensureOrgHighlightLayer(map);

  // RegionSelect value
  const regionSelectEl = document.getElementById("RegionSelect");
  const selectedRegionValueRaw = regionSelectEl?.value ?? "";
  const selectedRegionValue = normStr(selectedRegionValueRaw);

  // Decide if we should apply Subregion AND Country filter:
  // Only do it if the selectedRegionValue matches at least one Subregion in the passed list.
  const subregions = extractSubregions(countryListLikeFiltersJsArray).map(normStr).filter(Boolean);
  const shouldUseSubregion = !!selectedRegionValue && subregions.includes(selectedRegionValue);

  console.log("Selected Region value:", selectedRegionValueRaw);
  console.log("Selected country names:", names);
  console.log("Subregions in list:", subregions);
  console.log("Using Subregion filter:", shouldUseSubregion);

  const countryInFilter = [
    "in",
    featureCountryExprLower(),
    ["literal", namesLower],
  ];

  const finalFilter = shouldUseSubregion
    ? [
      "all",
      countryInFilter,
      ["==", featureSubregionExprLower(), selectedRegionValue],
    ]
    : countryInFilter;

  map.setFilter(ORG_HL_LINE_ID, finalFilter);

  attachBumpToTop(map);

  // ✅ START BLINK AFTER FILTER APPLIED
  startOrgBlink(map);
}

export function removeOrgCountriesOutline(map) {
  if (!map) return;

  // ✅ STOP BLINK FIRST
  stopOrgBlink(map);

  detachBumpToTop(map);

  if (map.getLayer(ORG_HL_LINE_ID)) {
    map.removeLayer(ORG_HL_LINE_ID);
  }
  if (map.getSource(ORG_HL_SOURCE_ID)) {
    map.removeSource(ORG_HL_SOURCE_ID);
  }
}
