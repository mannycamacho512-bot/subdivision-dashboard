window.addEventListener("DOMContentLoaded", function () {
  var el = document.getElementById("dashboard");
  if (!el) {
    document.body.innerHTML = "Missing #dashboard element";
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var subdivision = params.get("sub") || "No subdivision selected";

  el.innerHTML = "<div style='font-family:Arial; padding:20px; border:1px solid #eee; border-radius:12px; max-width:800px; margin:20px auto;'>" +
    "<h2>" + subdivision + " Dashboard</h2>" +
    "<p>This is working correctly.</p>" +
  "</div>";
});
