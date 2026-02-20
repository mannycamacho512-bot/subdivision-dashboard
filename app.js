// app.js — KPI cards + 3 signal cards + desktop/mobile layouts

const params = new URLSearchParams(window.location.search);
const subdivision = (params.get("sub") || "").toUpperCase().trim();

// ---------- formatting helpers ----------
function money(n) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "n/a";
  return Number(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function num(n) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "n/a";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function normalizeKey(s) {
  return String(s || "").toUpperCase().trim();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// ---------- data loading ----------
async function loadData() {
  const res = await fetch("./data/subdiv_ytd_2026.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load data file.");
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Data file is not an array of rows.");
  return data;
}

// ---------- UI screens ----------
function renderNoSubSelected(allSubs) {
  const container = document.getElementById("dashboard");

  const options = allSubs
    .map((s) => `<option value="${encodeURIComponent(s)}">${s}</option>`)
    .join("");

  container.innerHTML = `
    <div class="wrap">
      <h2>Select a subdivision</h2>
      <p class="muted">Pick one to load the dashboard.</p>
      <select id="subSelect">
        <option value="">-- choose --</option>
        ${options}
      </select>
    </div>
  `;

  const sel = document.getElementById("subSelect");
  sel.addEventListener("change", (e) => {
    const v = e.target.value;
    if (!v) return;
    window.location.href = `?sub=${v}`;
  });
}

function renderNoRowFound() {
  const container = document.getElementById("dashboard");
  container.innerHTML = `
    <div class="wrap">
      <p class="muted">No data found for this subdivision.</p>
      <p class="muted">Tip: check that the subdivision name in the URL matches the JSON "Subdivision" value (after uppercasing).</p>
    </div>
  `;
}

function renderError(err) {
  const container = document.getElementById("dashboard");
  container.innerHTML = `
    <div class="wrap">
      <h2>Error</h2>
      <p class="muted">${String(err?.message || err)}</p>
    </div>
  `;
}

// ---------- band helpers ----------
function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function computeBand(data) {
  const prices = data
    .map((r) => Number(r.MedianSoldPrice_YTD))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  // 10th–90th percentile band (stable, avoids outliers)
  return {
    min: percentile(prices, 0.10),
    max: percentile(prices, 0.90),
  };
}

// ---------- main dashboard ----------
function renderCards(row, band) {
  const container = document.getElementById("dashboard");

  const sold = Number(row.Sold_YTD || 0);
  const price = Number(row.MedianSoldPrice_YTD || 0);

  // CLOSED discount from original list (your JSON uses negative for below list)
  const closedDiff = Number(row.MedianSoldToOrigPct_YTD ?? NaN); // ex: -0.0416 = -4.16%
  const hasClosedDiff = Number.isFinite(closedDiff);

  const closedPct = hasClosedDiff ? Math.abs(closedDiff) * 100 : NaN;
  const closedDirection = hasClosedDiff
    ? (closedDiff < 0 ? "below" : closedDiff > 0 ? "above" : "at")
    : "";

  // ACTIVE negotiation signals (price cuts)
  const pctCut = Number(row.PctActiveCut_Current ?? NaN); // 0..1
  const medCut = Number(row.MedianActiveCutPct_Current ?? NaN); // negative fraction

  const pctCutPct = Number.isFinite(pctCut) ? pctCut * 100 : NaN;
  const medCutPct = Number.isFinite(medCut) ? Math.abs(medCut) * 100 : NaN;

  // --- Scales ---
  const activityScaleMax = 12; // tune later if needed
  const priceMin = band.min;
  const priceMax = band.max;

  const activityPct = clamp((sold / activityScaleMax) * 100, 0, 100);
  const pricePosPct = Number.isFinite(priceMin) && Number.isFinite(priceMax) && priceMax > priceMin
    ? clamp(((price - priceMin) / (priceMax - priceMin)) * 100, 0, 100)
    : 50;

  // Negotiation bar width: prefer % of actives with cuts, fallback to closed discount
  const negoWidth = Number.isFinite(pctCutPct)
    ? clamp(pctCutPct, 0, 100)
    : Number.isFinite(closedPct)
      ? clamp((closedPct / 10) * 100, 0, 100) // map 0–10% discount to 0–100 bar
      : 0;

  // --- Explanations ---
  const activityMeaning =
    activityPct >= 75 ? "High activity (more homes selling so far this year)." :
    activityPct >= 45 ? "Moderate activity (steady pace)." :
                        "Lower activity (fewer sales so far).";

  let negoMeaning = "Not enough active pricing data yet.";
  if (Number.isFinite(pctCutPct)) {
    if (pctCutPct >= 85) negoMeaning = "Widespread price cuts (buyers have strong leverage).";
    else if (pctCutPct >= 70) negoMeaning = "A lot of listings are cutting price (buyers have more leverage).";
    else if (pctCutPct >= 50) negoMeaning = "Many listings have price cuts (negotiation is common).";
    else if (pctCutPct >= 30) negoMeaning = "Some listings have price cuts (moderate negotiation).";
    else if (pctCutPct >= 15) negoMeaning = "A few listings are cutting price (limited negotiation).";
    else negoMeaning = "Price cuts are rare (less negotiation).";

    if (Number.isFinite(medCutPct)) {
      if (medCutPct >= 10) negoMeaning += " Cuts are also sizable.";
      else if (medCutPct >= 6) negoMeaning += " Cuts are meaningful.";
      else if (medCutPct >= 3) negoMeaning += " Cuts are modest.";
      else negoMeaning += " Cuts are small.";
    }
  }

  const priceMeaning =
    pricePosPct >= 70 ? "Higher price range for the area." :
    pricePosPct >= 40 ? "Mid-range pricing." :
                        "Lower price range within the typical band.";

  const barTrack = "rgba(15,23,42,.10)";
  const barFill = "#065f46"; // dark emerald

  container.innerHTML = `
    <div class="wrap">

      <!-- ================= DESKTOP LAYOUT ================= -->
      <div class="desktopOnly">

        <div class="grid">
          <div class="card">
            <div class="label">Sold (YTD)</div>
            <div class="value">${num(sold)}</div>
            <div class="sub">Homes sold so far this year</div>
          </div>

          <div class="card">
            <div class="label">Median Sold Price</div>
            <div class="value">${money(price)}</div>
            <div class="sub">Typical closed price</div>
          </div>

          <div class="card">
            <div class="label">Closed Discount (Orig → Sold)</div>
            <div class="value">${
              hasClosedDiff
                ? (closedDiff < 0 ? `-${closedPct.toFixed(1)}%` : closedDiff > 0 ? `+${closedPct.toFixed(1)}%` : "0.0%")
                : "n/a"
            }</div>
            <div class="sub">${
              hasClosedDiff
                ? `Typical sale closed ${closedDirection} original list`
                : "Not enough closed data"
            }</div>
          </div>
        </div>

        <div class="grid" style="margin-top:16px;">
          <div class="card">
            <div class="label">Sales Activity</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${activityMeaning}</div>
            <div style="
  height:10px;
  background:${barTrack};
  border-radius:8px;
  overflow:hidden;
  box-shadow: 0 0 10px rgba(6,95,70,.18);
">
              <div style="
  width:${activityPct}%;
  height:100%;
  background:${barFill};
  box-shadow: 0 0 8px rgba(6,95,70,.45);
"></div>
            </div>
            <div class="sub" style="margin-top:8px;">${num(sold)} sales YTD</div>
          </div>

          <div class="card">
            <div class="label">Median Price Position</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${priceMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${pricePosPct}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">
              Kyle-wide typical Range: ${money(priceMin)}–${money(priceMax)}
            </div>
          </div>

          <div class="card">
            <div class="label">Negotiation Room</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${negoMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${negoWidth}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">
              ${
                Number.isFinite(pctCutPct)
                  ? `${pctCutPct.toFixed(0)}% of active listings have a price cut`
                  : "Active cut data not available"
              }
              ${
                Number.isFinite(medCutPct)
                  ? ` • Typical cut: ~${medCutPct.toFixed(1)}%`
                  : ""
              }
            </div>
          </div>
        </div>

      </div>

      <!-- ================= MOBILE LAYOUT ================= -->
      <div class="mobileOnly">

        <div class="grid">
          <div class="card">
            <div class="label">Sold (YTD)</div>
            <div class="value">${num(sold)}</div>
            <div class="sub">Homes sold so far this year</div>
          </div>

          <div class="card">
            <div class="label">Sales Activity</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${activityMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${activityPct}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">${num(sold)} sales YTD</div>
          </div>

          <div class="card">
            <div class="label">Median Sold Price</div>
            <div class="value">${money(price)}</div>
            <div class="sub">Typical closed price</div>
          </div>

          <div class="card">
            <div class="label">Median Price Position</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${priceMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${pricePosPct}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">
              Kyle-wide typical Range: ${money(priceMin)}–${money(priceMax)}
            </div>
          </div>

          <div class="card">
            <div class="label">Closed Discount (Orig → Sold)</div>
            <div class="value">${
              hasClosedDiff
                ? (closedDiff < 0 ? `-${closedPct.toFixed(1)}%` : closedDiff > 0 ? `+${closedPct.toFixed(1)}%` : "0.0%")
                : "n/a"
            }</div>
            <div class="sub">${
              hasClosedDiff
                ? `Typical sale closed ${closedDirection} original list`
                : "Not enough closed data"
            }</div>
          </div>

          <div class="card">
            <div class="label">Negotiation Room</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${negoMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${negoWidth}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">
              ${
                Number.isFinite(pctCutPct)
                  ? `${pctCutPct.toFixed(0)}% of active listings have a price cut`
                  : "Active cut data not available"
              }
              ${
                Number.isFinite(medCutPct)
                  ? ` • Typical cut: ~${medCutPct.toFixed(1)}%`
                  : ""
              }
            </div>
          </div>
        </div>

      </div>

    </div>
  `;
}

// ---------- main ----------
(async function main() {
  try {
    const data = await loadData();

    const allSubs = data
      .map((r) => normalizeKey(r.Subdivision))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    if (!subdivision) {
      renderNoSubSelected(allSubs);
      return;
    }

    const row = data.find((r) => normalizeKey(r.Subdivision) === subdivision);

    if (!row) {
      renderNoRowFound();
      return;
    }

    const band = computeBand(data);
    renderCards(row, band);
  } catch (e) {
    renderError(e);
  }
})();
