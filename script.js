import { continent, subregion, country } from "./centroids.js";
import { graph_data } from "./zonal_means_final.js";
import { renderPrecipChart, wmsTile, addRasterLayer, buildGlobeMap, syncMaps, getAverageObject, filterFeatures, removeOrgCountriesOutline, setOrgCountriesOutline } from "./functions.js";
import { add_regional_charts, remove_regional_charts } from "./regional_pie_charts.js";
import { set_regional_month } from "./regional_pie_charts.js";

import {
  sids,
  sco,
  saarc,
  oic,
  icimod,
  eu,
  eco,
  commonwealth,
  asean,
  african_union_african_union_countries
} from "./filters.js";


// ── Mapbox ────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN?.trim() || "";

function showMapConfigError(message) {
  document.querySelectorAll(".map").forEach((el) => {
    if (!el) return;
    el.classList.add("map-disabled");
    el.textContent = message;
  });
}

function hasMapboxToken() {
  return MAPBOX_TOKEN.length > 0;
}

if (hasMapboxToken()) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
} else {
  const message = "Map unavailable: set VITE_MAPBOX_TOKEN and restart the Vite server.";
  console.error(message);
  showMapConfigError(message);
}

export let WB_LYR = "world_boundaries_outline";
export let GEOSERVER_WMS = "/wms-proxy";
export let isTimeField = (k) => /^\d{4}_\d{2}$/.test(k);


export const WMS_LAYERS = {
  april_2025: wmsTile("regional_dew:2025_04_classes50"),
  may_2025: wmsTile("regional_dew:2025_05_classes50"),
  june_2025: wmsTile("regional_dew:2025_06_classes50"),
  july_2025: wmsTile("regional_dew:2025_07_classes50"),
  august_2025: wmsTile("regional_dew:2025_08_classes50"),
  september_2025: wmsTile("regional_dew:2025_09_classes50"),

  april_2026: wmsTile("regional_dew:2026_04_classes50"),
  may_2026: wmsTile("regional_dew:2026_05_classes50"),
  june_2026: wmsTile("regional_dew:2026_06_classes50"),
  july_2026: wmsTile("regional_dew:2026_07_classes50"),
  august_2026: wmsTile("regional_dew:2026_08_classes50"),
  september_2026: wmsTile("regional_dew:2026_09_classes50")
};

// Create the maps
const mapHistoric = hasMapboxToken() ? buildGlobeMap("mapHistoric") : null;
const mapForecast = hasMapboxToken() ? buildGlobeMap("mapForecast") : null;

// Syncing
if (mapHistoric && mapForecast) {
  syncMaps(mapHistoric, mapForecast);
  syncMaps(mapForecast, mapHistoric);
}


// scripts.js
const ORG_TOGGLES = [
  { id: "optSIDS", data: sids },
  { id: "optSCO", data: sco },
  { id: "optSAARC", data: saarc },
  { id: "optOIC", data: oic },
  { id: "optICIMOD", data: icimod },
  { id: "optEU", data: eu },
  { id: "optECO", data: eco },
  { id: "optCommonwealth", data: commonwealth },
  { id: "optASEAN", data: asean },
  { id: "optAfricanUnion", data: african_union_african_union_countries },
];

function clearOrgHighlight() {
  removeOrgCountriesOutline(mapHistoric);
  removeOrgCountriesOutline(mapForecast);
}

function applyOrgHighlight(list) {
  setOrgCountriesOutline(mapHistoric, list);
  setOrgCountriesOutline(mapForecast, list);
}

// Only one checkbox ON at a time. Turning one ON removes previous highlight and unchecks others.
ORG_TOGGLES.forEach((t) => {
  const el = document.getElementById(t.id);
  if (!el) return;

  el.addEventListener("change", () => {
    if (el.checked) {
      // uncheck others
      ORG_TOGGLES.forEach((o) => {
        if (o.id !== t.id) {
          const otherEl = document.getElementById(o.id);
          if (otherEl) otherEl.checked = false;
        }
      });

      clearOrgHighlight();
      applyOrgHighlight(t.data);
    } else {
      clearOrgHighlight();
    }
  });
});

const regionCheck = document.getElementById("regionCheck");

regionCheck.addEventListener("change", () => {
  if (!mapForecast) {
    regionCheck.checked = false;
    return;
  }

  if (regionCheck.checked) add_regional_charts(mapForecast);
  else remove_regional_charts();
});


document.querySelectorAll(".m-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const month = button.getAttribute("data-month");

    if (["april", "may", "june", "july", "august", "september"].includes(month)) {
      addRasterLayer(mapHistoric, month, 2025);
      addRasterLayer(mapForecast, month, 2026);

      // ✅ check if any dropdown has a valid selection
      const continent = document.getElementById("continentSelect");
      const region = document.getElementById("RegionSelect");
      const country = document.getElementById("countrySelect");

      const hasValidSelection = [continent, region, country].some((select) => {
        if (!select) return false;

        const text = select.options[select.selectedIndex]?.text?.toLowerCase().trim();
        const value = select.value?.toLowerCase().trim();

        return (
          value &&
          value !== "" &&
          value !== "select" &&
          text !== "select"
        );
      });

      if (hasValidSelection) {
        const applyBtn = document.getElementById("applyBtn");
        if (applyBtn) applyBtn.click();
      }
    }

    set_regional_month(month);
  });
});



// ── Month active state ────────────────────────────────────────────────────
document.querySelectorAll(".m-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".m-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});



////////////////////////////////////////// data /////////////////////////////////////////////////////////
let avgActiveMonthGlobal = null;
let precipChartInstance = null;


const $ = (id) => document.getElementById(id);

function populateSelect(id, obj) {
  const s = $(id);
  s.innerHTML =
    `<option value="">Select</option>` +
    Object.keys(obj)
      .sort()
      .map((k) => `<option value="${k}">${k.replace(/\b\w/g, (c) => c.toUpperCase())}</option>`)
      .join("");
}

populateSelect("continentSelect", continent);
populateSelect("RegionSelect", subregion);
populateSelect("countrySelect", country);

let lastChanged = null;
const ids = ["continentSelect", "RegionSelect", "countrySelect"];
const levels = ["continent", "subregion", "country"];
const objByLevel = { continent, subregion, country };
const zoomByLevel = { continent: 3, subregion: 4, country: 5 };

// ── Cascade helpers ────────────────────────────────────────────────────────
function filterObjByKeys(obj, keys) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => keys.includes(k)));
}

function subregionsFor(continentVal) {
  const s = new Set();
  graph_data.forEach(f => {
    if (f.continent?.toLowerCase() === continentVal) s.add(f.subregion?.toLowerCase());
  });
  return [...s].filter(Boolean);
}

function countriesFor({ continentVal, subregionVal }) {
  const s = new Set();
  graph_data.forEach(f => {
    const matchC = !continentVal || f.continent?.toLowerCase() === continentVal;
    const matchS = !subregionVal || f.subregion?.toLowerCase() === subregionVal;
    if (matchC && matchS) s.add(f.name_en?.toLowerCase());
  });
  return [...s].filter(Boolean);
}

// ── Cascading change listeners ─────────────────────────────────────────────
$("continentSelect").addEventListener("change", () => {
  lastChanged = "continent";
  const val = $("continentSelect").value.toLowerCase().trim();

  if (!val) {
    populateSelect("RegionSelect", subregion);
    populateSelect("countrySelect", country);
  } else {
    populateSelect("RegionSelect", filterObjByKeys(subregion, subregionsFor(val)));
    populateSelect("countrySelect", filterObjByKeys(country, countriesFor({ continentVal: val })));
  }
  $("RegionSelect").value = "";
  $("countrySelect").value = "";
});

$("RegionSelect").addEventListener("change", () => {
  lastChanged = "subregion";
  const subVal = $("RegionSelect").value.toLowerCase().trim();
  const contVal = $("continentSelect").value.toLowerCase().trim();

  if (!subVal) {
    populateSelect("countrySelect", filterObjByKeys(country,
      countriesFor({ continentVal: contVal || null })));
  } else {
    populateSelect("countrySelect", filterObjByKeys(country,
      countriesFor({ continentVal: contVal || null, subregionVal: subVal })));
  }
  $("countrySelect").value = "";
});

$("countrySelect").addEventListener("change", () => {
  lastChanged = "country";
});


const MONTH_INDEX = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

let selectedMonthNum = null; // "01".."12"

function setActiveMonthButton(btn) {
  document.querySelectorAll(".month-grid .m-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  const label = (btn.textContent || "").trim().toLowerCase();
  selectedMonthNum = MONTH_INDEX[label] ?? null;
}

// Click handling (event delegation)
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".month-grid .m-btn");
  if (!btn) return;
  setActiveMonthButton(btn);
});

// Initialize from markup (your HTML already has one .active)
(function initActiveMonth() {
  const active = document.querySelector(".month-grid .m-btn.active");
  if (active) setActiveMonthButton(active);
})();

/* ───────────────────────────────────────────── */
/* NEW: filter averaged values by active month    */
/* ───────────────────────────────────────────── */

function filterAvgByActiveMonth(avgObj, monthNum) {
  if (!avgObj || !monthNum) return null; // monthNum like "04"
  const out = {};
  for (const [k, v] of Object.entries(avgObj)) {
    // k is like "2010_04"
    if (k.slice(5, 7) === monthNum) out[k] = v;
  }
  return out;
}

function flyWhenReady(m, opts) {
  if (!m || typeof m.flyTo !== "function") return;

  // If style is already loaded, fly immediately
  if (typeof m.isStyleLoaded === "function" && m.isStyleLoaded()) {
    m.flyTo(opts);
    return;
  }

  // Otherwise wait until map becomes idle (most reliable)
  m.once("idle", () => m.flyTo(opts));
}

function flyToAll(center, zoom) {
  if (!Array.isArray(center) || center.length !== 2) return;
  const opts = { center, zoom, duration: 1600, essential: true };
  flyWhenReady(mapHistoric, opts);
  flyWhenReady(mapForecast, opts);
}



$("applyBtn").addEventListener("click", () => {
  if (!selectedMonthNum) {
    alert("Please select a month.");
    return;
  }

  if (!lastChanged) {
    alert("Please select a continent, region, or country.");
    return;
  }

  const selId = ids[levels.indexOf(lastChanged)];
  const keyRaw = $(selId).value;

  if (!keyRaw) {
    alert("Please select a value from the dropdown.");
    return;
  }

  const key = keyRaw.toString().trim().toLowerCase();

  const centroid = objByLevel[lastChanged]?.[key] ?? null;

  const matched = filterFeatures(lastChanged, key);
  const avgMatched = getAverageObject(matched);

  avgActiveMonthGlobal = filterAvgByActiveMonth(avgMatched, selectedMonthNum);

  console.log("Average filtered by active month:", avgActiveMonthGlobal);

  // ───────── HISTORIC vs FORECAST SPLIT ─────────
  const entries = Object.entries(avgActiveMonthGlobal);

  const historicValues = entries
    .filter(([k]) => Number(k.slice(0, 4)) <= 2025)
    .map(([, v]) => v);

  const forecastValue = entries.find(
    ([k]) => Number(k.slice(0, 4)) === 2026
  )?.[1] ?? null;

  const historicAvg =
    historicValues.length
      ? historicValues.reduce((a, b) => a + b, 0) / historicValues.length
      : null;

  console.log("Historic average (2010–2025):", historicAvg);
  console.log("Forecast (2026):", forecastValue);

  // ───────── UPDATE UI VALUES ─────────
  const historicEl = document.getElementById("historicValue");
  const forecastEl = document.getElementById("forecastValue");
  const anomalyEl = document.getElementById("anomolyValue");

  if (historicEl && historicAvg != null) {
    historicEl.textContent = `${historicAvg.toFixed(2)} mm`;
  }

  if (forecastEl && forecastValue != null) {
    forecastEl.textContent = `${Number(forecastValue).toFixed(2)} mm`;
  }

  // ✅ ANOMALY = ((forecast - historic) / historic) * 100
  if (anomalyEl && historicAvg != null && forecastValue != null && historicAvg !== 0) {
    const anomalyPct = ((forecastValue - historicAvg) / historicAvg) * 100;
    const sign = anomalyPct >= 0 ? "+" : "−";
    const arrowIcon = anomalyPct >= 0
      ? `<iconify-icon icon="lucide:arrow-up" width="13" style="vertical-align:middle;margin-right:2px"></iconify-icon>`
      : `<iconify-icon icon="lucide:arrow-down" width="13" style="vertical-align:middle;margin-right:2px"></iconify-icon>`;
    anomalyEl.innerHTML = `${arrowIcon}${sign}${Math.abs(anomalyPct).toFixed(2)}%`;
  }

  // Sync values to mobile trends strip
  const mHistoric = document.getElementById("historicValue-m");
  const mForecast = document.getElementById("forecastValue-m");
  const mAnomaly  = document.getElementById("anomolyValue-m");
  if (mHistoric && historicAvg != null) mHistoric.textContent = `${historicAvg.toFixed(2)} mm`;
  if (mForecast && forecastValue != null) mForecast.textContent = `${Number(forecastValue).toFixed(2)} mm`;
  if (mAnomaly && historicAvg != null && forecastValue != null && historicAvg !== 0) {
    const pct = ((forecastValue - historicAvg) / historicAvg) * 100;
    const arrowM = pct >= 0
      ? `<iconify-icon icon="lucide:arrow-up" width="13" style="vertical-align:middle;margin-right:2px"></iconify-icon>`
      : `<iconify-icon icon="lucide:arrow-down" width="13" style="vertical-align:middle;margin-right:2px"></iconify-icon>`;
    mAnomaly.innerHTML = `${arrowM}${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(2)}%`;
  }

  // ── Update chart filter label ──────────────────────────────
  const chartFilterLabel = document.getElementById("chartFilterLabel");
  if (chartFilterLabel) {
    const selId = ids[levels.indexOf(lastChanged)];
    const selEl = $(selId);
    const displayText = selEl?.options[selEl.selectedIndex]?.text ?? keyRaw;
    const activeBtn = document.querySelector(".month-grid .m-btn.active");
    const monthLabel = activeBtn ? activeBtn.textContent.trim() : "";
    chartFilterLabel.textContent = `${displayText}${monthLabel ? " · " + monthLabel : ""}`;
    chartFilterLabel.style.display = "inline-flex";
  }

  // ────────────────────────────────────

  renderPrecipChart(avgActiveMonthGlobal);

  if (centroid) flyToAll(centroid, zoomByLevel[lastChanged] ?? 4);
});


// ── Mobile drawer toggle ───────────────────────────────────────────────────
(function () {
  const menuBtn  = document.getElementById('mobileMenuBtn');
  const closeBtn = document.getElementById('drawerClose');
  const overlay  = document.getElementById('mobileOverlay');
  const controls = document.getElementById('controls');

  if (!menuBtn || !controls) return;

  function openDrawer() {
    controls.classList.add('mobile-open');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    controls.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  menuBtn.addEventListener('click', openDrawer);
  if (closeBtn)  closeBtn.addEventListener('click', closeDrawer);
  if (overlay)   overlay.addEventListener('click', closeDrawer);
})();

// ── Guide modal toggle ──────────────────────────────────────────────────────
(function () {
  const guideBtn       = document.getElementById('guideBtn');
  const mobileGuideBtn = document.getElementById('mobileGuideBtn');
  const guideOverlay   = document.getElementById('guideOverlay');
  const guideClose     = document.getElementById('guideClose');

  if (!guideOverlay) return;

  function openGuide() {
    guideOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeGuide() {
    guideOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (guideBtn)       guideBtn.addEventListener('click', openGuide);
  if (mobileGuideBtn) mobileGuideBtn.addEventListener('click', openGuide);
  if (guideClose)     guideClose.addEventListener('click', closeGuide);
  guideOverlay.addEventListener('click', (e) => {
    if (e.target === guideOverlay) closeGuide();
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && guideOverlay.classList.contains('active')) closeGuide();
  });
})();
