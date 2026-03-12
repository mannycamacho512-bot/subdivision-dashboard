// app.js — KPI cards + 3 signal cards + subdivision page data

const params = new URLSearchParams(window.location.search);
const subdivision = (params.get("sub") || "").toUpperCase().trim();

// ---------- formatting helpers ----------
function money(n) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "n/a";
  return Number(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function num(n) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "n/a";
  return Number(n).toLocaleString("en-US", {
    maximumFractionDigits: 0
  });
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

async function loadSubdivisionPageData() {
  const res = await fetch("./data/subdivision_page_data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load subdivision page data.");
  const data = await res.json();
  return data;
}

// ---------- UI screens ----------
function renderNoSubSelected(allSubs) {
  const container = document.getElementById("dashboard");
  if (!container) return;

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
  if (sel) {
    sel.addEventListener("change", (e) => {
      const v = e.target.value;
      if (!v) return;
      window.location.href = \`?sub=\${v}\`;
    });
  }
}

function renderNoRowFound() {
  const container = document.getElementById("dashboard");
  if (!container) return;

  container.innerHTML = `
    <div class="wrap">
      <h2>No YTD sales yet</h2>
      <p class="muted">This subdivision doesn’t have enough closed sales in 2026 to calculate stats.</p>
      <p class="muted">Most likely: <strong>0 homes sold YTD</strong> (so far).</p>
      <p class="muted">Tip: try a different subdivision or check back after the next closing.</p>
    </div>
  `;
}

function renderError(err) {
  const container = document.getElementById("dashboard");
  if (!container) return;

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

  return {
    min: percentile(prices, 0.10),
    max: percentile(prices, 0.90)
  };
}

// ---------- main dashboard ----------
function renderCards(row, band) {
  const container = document.getElementById("dashboard");
  if (!container) return;

  const sold = Number(row.Sold_YTD || 0);
  const price = Number(row.MedianSoldPrice_YTD || 0);

  const closedDiff = Number(row.MedianSoldToOrigPct_YTD ?? NaN);
  const hasClosedDiff = Number.isFinite(closedDiff);

  const closedPct = hasClosedDiff ? Math.abs(closedDiff) * 100 : NaN;
  const closedDirection = hasClosedDiff
    ? (closedDiff < 0 ? "below" : closedDiff > 0 ? "above" : "at")
    : "";

  const activityScaleMax = 12;
  const priceMin = band?.min;
  const priceMax = band?.max;

  const activityPct = clamp((sold / activityScaleMax) * 100, 0, 100);

  const pricePosPct =
    Number.isFinite(priceMin) &&
    Number.isFinite(priceMax) &&
    priceMax > priceMin
      ? clamp(((price - priceMin) / (priceMax - priceMin)) * 100, 0, 100)
      : 50;

  const negoWidth = Number.isFinite(closedPct)
    ? clamp((closedPct / 10) * 100, 0, 100)
    : 0;

  const activityMeaning =
    activityPct >= 75
      ? "High activity (more homes selling so far this year)."
      : activityPct >= 45
      ? "Moderate activity (steady pace)."
      : "Lower activity (fewer sales so far).";

  let negoMeaning = "Not enough closed sales yet to estimate negotiation.";
  if (Number.isFinite(closedPct)) {
    if (closedPct >= 10) negoMeaning = "Large discounts are showing up in closed sales (strong negotiation).";
    else if (closedPct >= 6) negoMeaning = "Discounts are meaningful in closed sales (negotiation is common).";
    else if (closedPct >= 3) negoMeaning = "Some discounting in closed sales (moderate negotiation).";
    else if (closedPct >= 1) negoMeaning = "Small discounts in closed sales (limited negotiation).";
    else negoMeaning = "Closed sales are near original list price (little negotiation).";
  }

  const priceMeaning =
    pricePosPct >= 70
      ? "Higher price range for the area."
      : pricePosPct >= 40
      ? "Mid-range pricing."
      : "Lower price range within the typical band.";

  const barTrack = "rgba(15,23,42,.10)";
  const barFill = "#065f46";

  const rangeLabel =
    Number.isFinite(priceMin) && Number.isFinite(priceMax)
      ? `Kyle-wide typical range: ${money(priceMin)}–${money(priceMax)}`
      : "Kyle-wide typical range: n/a";

  const closedDiscountValue = hasClosedDiff
    ? (closedDiff < 0
        ? `-${closedPct.toFixed(1)}%`
        : closedDiff > 0
        ? `+${closedPct.toFixed(1)}%`
        : "0.0%")
    : "n/a";

  const closedDiscountSub = hasClosedDiff
    ? `Typical sale closed ${closedDirection} original list`
    : "Not enough closed data";

  const negotiationBottomLine = Number.isFinite(closedPct)
    ? `Typical sale closed ${closedDirection} original list by ~${closedPct.toFixed(1)}%`
    : "Closed discount data not available";

  container.innerHTML = `
    <div class="wrap">

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
            <div class="value">${closedDiscountValue}</div>
            <div class="sub">${closedDiscountSub}</div>
          </div>
        </div>

        <div class="grid" style="margin-top:16px;">
          <div class="card">
            <div class="label">Sales Activity</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${activityMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${activityPct}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">${num(sold)} sales YTD</div>
          </div>

          <div class="card">
            <div class="label">Median Price Position</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${priceMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${pricePosPct}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">${rangeLabel}</div>
          </div>

          <div class="card">
            <div class="label">Negotiation Room</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${negoMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${negoWidth}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">${negotiationBottomLine}</div>
          </div>
        </div>
      </div>

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
            <div class="sub" style="margin-top:8px;">${rangeLabel}</div>
          </div>

          <div class="card">
            <div class="label">Closed Discount (Orig → Sold)</div>
            <div class="value">${closedDiscountValue}</div>
            <div class="sub">${closedDiscountSub}</div>
          </div>

          <div class="card">
            <div class="label">Negotiation Room</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${negoMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${negoWidth}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">${negotiationBottomLine}</div>
          </div>
        </div>
      </div>

    </div>
  `;
}

// ---------- page data card ----------
function renderSubdivisionPageDataCard() {
  const container = document.getElementById("page-data-card");
  if (!container) return;

  container.innerHTML = `
    <div class="wrap">
      <div class="grid">
        <div class="card">
          <div class="label">Homes Available</div>
          <div class="value" id="homes-available-text">Loading...</div>
          <div class="sub">Current active homes in this subdivision</div>
        </div>

        <div class="card">
          <div class="label">Price Range</div>
          <div class="value" id="price-range-text">Loading...</div>
          <div class="sub" id="median-price-text">Loading...</div>
        </div>
      </div>
    </div>
  `;
}

async function fillSubdivisionPageData() {
  try {
    const allPageData = await loadSubdivisionPageData();
    const data = allPageData[subdivision];

    if (!data) return;

    const homesEl = document.getElementById("homes-available-text");
    const priceRangeEl = document.getElementById("price-range-text");
    const medianEl = document.getElementById("median-price-text");

    if (homesEl) {
      const count = Number(data.homesAvailable || 0);
      homesEl.textContent = `${count} ${count === 1 ? "home" : "homes"} available`;
    }

    if (priceRangeEl) {
      priceRangeEl.textContent = `${money(data.minPrice)} – ${money(data.maxPrice)}`;
    }

    if (medianEl) {
      medianEl.textContent = `Median Price near this area: ≈ ${money(data.medianPrice)}`;
    }
  } catch (err) {
    console.error("Subdivision page data error:", err);
  }
}

// ---------- main ----------
(async function main() {
  try {
    renderSubdivisionPageDataCard();
    fillSubdivisionPageData();

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
