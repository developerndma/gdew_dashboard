import { pie_chart_data } from "./subregion_counts.js";
import { normalityCountriesList } from "./normality_countries_list.js";


// ====== CONFIG ======
const PIE_COLORS = ["rgba(238, 34, 34, 0.92)", "rgba(54, 251, 36, 0.92)"];
const PIE_BORDER = "rgba(0,0,0,0)";

// Responsive pie size — scales with the viewport
function getSize() {
  const w = window.innerWidth;
  if (w <= 390) return 24;
  if (w <= 767) return 30;
  if (w <= 1099) return 34;
  return 40;
}

function getLabelFontSize() {
  const w = window.innerWidth;
  if (w <= 390) return 7;
  if (w <= 767) return 8;
  if (w <= 1099) return 9;
  return 10;
}

function getPieFontSize() {
  const w = window.innerWidth;
  if (w <= 390) return 8;
  if (w <= 767) return 10;
  if (w <= 1099) return 12;
  return 14;
}

const MONTH_TO_NUM = { april: 4, may: 5, june: 6, july: 7, august: 8, september: 9 };
const NUM_TO_MONTH = Object.fromEntries(Object.entries(MONTH_TO_NUM).map(([k, v]) => [v, k]));

// ====== STATE ======
let regionalPieMarkers = [];

// IMPORTANT: do not force default month 4 for first render
let currentMonthKey = null;
let currentMonth = null;

let chartsEnabled = false;
let boundMap = null;
let legendEl = null;

// ====== HELPERS ======
const safeNum = (v) => (Number.isFinite((v = Number(v))) ? v : 0);

const getAboveBelow = (row, month) => [safeNum(row?.[`${month}_above`]), safeNum(row?.[`${month}_below`])];

// NOTE: your JSON is swapped. latitude holds lng, longitude holds lat.
const getLngLat = (row) => [Number(row?.latitude), Number(row?.longitude)];
const isValidLngLat = (lng, lat) =>
  Number.isFinite(lng) && Number.isFinite(lat) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

const getSubregionLabel = (r) =>
  r?.subregion ??
  r?.sub_region ??
  r?.subregion_name ??
  r?.subregionName ??
  r?.subregion_en ??
  r?.subregionNameEn ??
  "";

const fmtPercent = (p) => (Number.isFinite((p = Number(p))) ? `${p.toFixed(1)}%` : "0%");

function drawHalo(ctx, cx, cy, r) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(3, 7, 18, 0.55)";
  ctx.fill();

  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.stroke();
  ctx.restore();
}

// Try to detect currently active month button in UI
function detectActiveMonthKey() {
  const btn =
    document.querySelector('.m-btn.active[data-month]') ||
    document.querySelector('.m-btn.is-active[data-month]') ||
    document.querySelector('.m-btn[aria-pressed="true"][data-month]');

  const key = btn?.getAttribute("data-month")?.toLowerCase() || null;
  return MONTH_TO_NUM[key] ? key : null;
}

// Parse monthKeyOrNum into { key, num } or null
function parseMonth(monthKeyOrNum) {
  if (typeof monthKeyOrNum === "string") {
    const key = monthKeyOrNum.toLowerCase();
    const num = MONTH_TO_NUM[key] ?? null;
    return num ? { key, num } : null;
  }

  const m = Number(monthKeyOrNum);
  if (Number.isFinite(m)) {
    const key = NUM_TO_MONTH[m] ?? null;
    return key ? { key, num: m } : null;
  }

  return null;
}

// ====== LEGEND ======
function removeLegend() {
  legendEl?.parentElement?.removeChild(legendEl);
  legendEl = null;
}

function ensureLegend(map) {
  const container = map?.getContainer?.();
  if (!container) return;

  const cs = window.getComputedStyle(container);
  if (cs.position === "static" || !cs.position) container.style.position = "relative";
  if (legendEl && legendEl.parentElement === container) return;

  removeLegend();

  const el = document.createElement("div");
  legendEl = el;
  el.id = "regional-pie-legend";
  Object.assign(el.style, {
    position: "absolute",
    right: "12px",
    bottom: "12px",
    zIndex: "10",
    pointerEvents: "none",
    padding: "10px 10px",
    borderRadius: "12px",
    background: "rgba(2, 6, 23, 0.62)",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    backdropFilter: "blur(8px)",
    boxShadow: "0 8px 22px rgba(0,0,0,0.35)",
  });

  const title = document.createElement("div");
  Object.assign(title.style, {
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.2px",
    marginBottom: "8px",
    color: "rgba(226,232,240,0.95)",
    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
  });
  el.appendChild(title);

  const makeRow = (color, label) => {
    const r = document.createElement("div");
    Object.assign(r.style, { display: "flex", alignItems: "center", gap: "8px", margin: "6px 0" });

    const sw = document.createElement("span");
    Object.assign(sw.style, {
      width: "12px",
      height: "12px",
      borderRadius: "999px",
      background: color,
      boxShadow: "0 0 0 2px rgba(15, 23, 42, 0.55), 0 2px 6px rgba(0,0,0,0.35)",
    });

    const tx = document.createElement("span");
    tx.textContent = label;
    Object.assign(tx.style, {
      fontSize: "11px",
      color: "rgba(226,232,240,0.92)",
      textShadow: "0 1px 2px rgba(0,0,0,0.6)",
    });

    r.appendChild(sw);
    r.appendChild(tx);
    return r;
  };

  el.appendChild(makeRow(PIE_COLORS[0], "Above"));
  el.appendChild(makeRow(PIE_COLORS[1], "Below"));

  const foot = document.createElement("div");
  Object.assign(foot.style, {
    marginTop: "8px",
    fontSize: "10px",
    color: "rgba(148,163,184,0.95)",
    textShadow: "0 1px 2px rgba(0,0,0,0.55)",
  });
  el.appendChild(foot);

  container.appendChild(el);
}

// ====== PIE ELEMENT ======
function makePieCanvas(row, month) {
  const [above, below] = getAboveBelow(row, month);
  const S = getSize();

  const c = document.createElement("canvas");
  c.width = c.height = S;

  const haloPlugin = {
    id: "haloPlugin",
    beforeDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;
      const r = Math.min(chartArea.width, chartArea.height) / 2 + 1;
      drawHalo(ctx, cx, cy, r);
    },
  };

  // ✅ Data labels plugin (draw values inside slices)
  const valueLabelsPlugin = {
    id: "valueLabelsPlugin",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data.length) return;

      const ds = chart.data.datasets?.[0];
      const vals = ds?.data || [];
      const total = vals.reduce((a, b) => a + safeNum(b), 0);

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${getPieFontSize()}px Candara, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
      ctx.fillStyle = "rgba(192, 192, 192, 0.95)";
      ctx.shadowColor = "rgba(0,0,0,0.65)";
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;

      meta.data.forEach((arc, i) => {
        const v = safeNum(vals[i]);
        if (!v) return;
        // Hide labels for tiny slices to avoid clutter
        const frac = total > 0 ? v / total : 0;
        if (frac < 0.08) return;

        const p = arc.getProps(["x", "y", "startAngle", "endAngle", "innerRadius", "outerRadius"], true);
        const ang = (p.startAngle + p.endAngle) / 2;
        const r = (p.innerRadius + p.outerRadius) / 2;

        const x = p.x + Math.cos(ang) * r;
        const y = p.y + Math.sin(ang) * r;

        ctx.fillText(String(Math.round(v)), x, y);
      });

      ctx.restore();
    },
  };

  // Chart.js must already be loaded globally as `Chart`
  new Chart(c, {
    type: "doughnut",
    data: {
      labels: ["Above", "Below"],
      datasets: [
        {
          data: [above, below],
          backgroundColor: PIE_COLORS,
          borderColor: PIE_BORDER,
          borderWidth: 0,
          hoverOffset: 0,
        },
      ],
    },
    options: {
      animation: false,
      responsive: false,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      cutout: "52%",
      layout: { padding: 2 },
    },
    plugins: [haloPlugin, valueLabelsPlugin],
  });

  c.style.width = c.style.height = `${S}px`;

  // ====== SUBREGION + PERCENT LABEL (same behavior) ======
  const total = above + below;
  const pctAbove = total > 0 ? (above / total) * 100 : 0;

  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    pointerEvents: "none",
  });
  wrap.appendChild(c);

  const label = document.createElement("div");
  const sub = getSubregionLabel(row);
  const pct = fmtPercent(pctAbove);
  label.textContent = sub ? `${sub} . ${pct}` : pct;

  Object.assign(label.style, {
    marginTop: "2px",
    padding: "1px 5px",
    borderRadius: "7px",
    fontSize: `${getLabelFontSize()}px`,
    lineHeight: `${getLabelFontSize() + 2}px`,
    whiteSpace: "nowrap",
    color: "rgba(226,232,240,0.95)",
    background: "rgba(2, 6, 23, 0.55)",
    border: "1px solid rgba(148, 163, 184, 0.20)",
    backdropFilter: "blur(6px)",
    textShadow: "0 1px 2px rgba(0,0,0,0.65)",
    boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
  });

  wrap.appendChild(label);
  return wrap;
}

// ====== INTERNAL ADD/REMOVE ======
function clearMarkers() {
  for (const m of regionalPieMarkers) m.remove();
  regionalPieMarkers = [];
}

function buildMarkers(map, month) {

  // logRegionValue();

  if (!Array.isArray(pie_chart_data) || !pie_chart_data.length) {
    console.warn("pie_chart_data is empty or not an array.");
    return [];
  }

  if (!Number.isFinite(Number(month))) {
    console.warn("buildMarkers called without a valid month:", month);
    return [];
  }

  const markers = [];
  for (const row of pie_chart_data) {
    if (!row || typeof row !== "object") continue;

    const [lng, lat] = getLngLat(row);
    if (!isValidLngLat(lng, lat)) continue;

    markers.push(
      new mapboxgl.Marker({ element: makePieCanvas(row, month), anchor: "center" }).setLngLat([lng, lat]).addTo(map),
    );
  }
  return markers;
}

function refreshIfEnabled() {
  if (!chartsEnabled || !boundMap) return;
  if (!Number.isFinite(Number(currentMonth))) return;

  ensureLegend(boundMap);
  clearMarkers();
  regionalPieMarkers = buildMarkers(boundMap, currentMonth);
}

// ====== EXPORTED API ======
export function add_regional_charts(map, lngLat = [69.3451, 30.3753], monthKeyOrNum = null) {
  // lngLat kept only for compatibility with old calls. not used.
  boundMap = map;
  chartsEnabled = true;

  // pick month in priority order:
  // 1) caller passed it
  // 2) detect active month button
  // 3) alert and stop
  let picked = parseMonth(monthKeyOrNum);

  if (!picked) {
    const activeKey = detectActiveMonthKey();
    if (activeKey) picked = parseMonth(activeKey);
  }

  if (!picked) {
    chartsEnabled = false;
    clearMarkers();
    removeLegend();

    // 🔹 auto-uncheck the checkbox that enables charts
    const activeToggle =
      document.querySelector("#toggle-regional-charts") ||
      document.querySelector('input[type="checkbox"][data-role="regional-charts"]') ||
      document.querySelector('input[type="checkbox"]:checked');

    if (activeToggle) activeToggle.checked = false;

    alert("Select a month first, then enable charts.");
    return [];
  }

  ensureLegend(boundMap);
  set_regional_month(picked.key); // sets currentMonth + triggers refresh when changed
  refreshIfEnabled(); // ensure we have pies right now
  return regionalPieMarkers;
}

export function remove_regional_charts() {
  chartsEnabled = false;
  clearMarkers();
  removeLegend();
}

export function set_regional_month(monthKeyOrNum) {
  const parsed = parseMonth(monthKeyOrNum);
  if (!parsed) return;

  const { key, num } = parsed;

  // If nothing set yet. allow setting without comparing
  if (num === currentMonth) return;

  currentMonth = num;
  currentMonthKey = key;

  refreshIfEnabled();
}

export function get_regional_month() {
  return currentMonth;
}

// function logRegionValue() {
//   const sel = document.getElementById("RegionSelect");
//   if (!sel) return;
//   console.log(sel.value);
// }
