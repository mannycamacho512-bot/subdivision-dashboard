function renderCards(row) {
  const container = document.getElementById("dashboard");

  const sold = Number(row.Sold_YTD || 0);
  const price = Number(row.MedianSoldPrice_YTD || 0);
  const soldToOrigPct = Number(row.MedianSoldToOrigPct_YTD || 0);

  // ----------- SCALES (tune later if needed) -----------

  const activityScaleMax = 80;     // typical yearly volume range
  const priceMin = 200000;
  const priceMax = 500000;

  const activityPct = Math.min((sold / activityScaleMax) * 100, 100);
  const negotiationPct = (1 - soldToOrigPct) * 100;  // % discount
  const priceLevelPct = Math.min(
    ((price - priceMin) / (priceMax - priceMin)) * 100,
    100
  );

  // ----------- INTERPRETATION -----------

  function activityText() {
    if (activityPct > 70) return "High sales activity in this neighborhood.";
    if (activityPct > 40) return "Moderate sales activity.";
    return "Lower sales activity compared to typical pace.";
  }

  function negotiationText() {
    if (negotiationPct < 2)
      return "Homes are selling very close to original list price.";
    if (negotiationPct < 5)
      return "Buyers are negotiating modest discounts.";
    return "Buyers are negotiating larger discounts than usual.";
  }

  function priceText() {
    if (priceLevelPct > 70)
      return "Higher-end pricing relative to typical neighborhood range.";
    if (priceLevelPct > 40)
      return "Mid-range pricing for the area.";
    return "Lower-end pricing within the typical range.";
  }

  container.innerHTML = `
    <div class="wrap">

      <!-- Row 1: KPI Cards -->
      <div class="grid">

        <div class="card">
          <div class="label">Sold (YTD)</div>
          <div class="value">${sold}</div>
          <div class="sub">Homes sold so far this year</div>
        </div>

        <div class="card">
          <div class="label">Median Sold Price</div>
          <div class="value">${money(price)}</div>
          <div class="sub">Typical closed price</div>
        </div>

        <div class="card">
          <div class="label">Median Discount</div>
          <div class="value">${(negotiationPct).toFixed(1)}%</div>
          <div class="sub">From original list price</div>
        </div>

      </div>

      <!-- Row 2: Signal Cards -->
      <div class="grid" style="margin-top:16px;">

        <div class="card">
          <div class="label">Sales Activity</div>
          <div class="canvasWrap">
            <div style="height:8px; background:#e5e7eb; border-radius:6px; overflow:hidden;">
              <div style="width:${activityPct}%; height:100%; background:#065f46;"></div>
            </div>
          </div>
          <div class="sub">This means: ${activityText()}</div>
        </div>

        <div class="card">
          <div class="label">Negotiation Room</div>
          <div class="canvasWrap">
            <div style="height:8px; background:#e5e7eb; border-radius:6px; overflow:hidden;">
              <div style="width:${negotiationPct * 10}%; height:100%; background:#065f46;"></div>
            </div>
          </div>
          <div class="sub">This means: ${negotiationText()}</div>
        </div>

        <div class="card">
          <div class="label">Price Position</div>
          <div class="canvasWrap">
            <div style="height:8px; background:#e5e7eb; border-radius:6px; overflow:hidden;">
              <div style="width:${priceLevelPct}%; height:100%; background:#065f46;"></div>
            </div>
          </div>
          <div class="sub">This means: ${priceText()}</div>
        </div>

      </div>

    </div>
  `;
}
