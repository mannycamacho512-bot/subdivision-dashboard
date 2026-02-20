const params = new URLSearchParams(window.location.search);
const subdivision = params.get("sub") || "No subdivision selected";

document.getElementById("dashboard").innerHTML = `
  <div style="
      font-family: Arial, sans-serif;
      padding: 20px;
      border: 1px solid #eee;
      border-radius: 12px;
      max-width: 800px;
      margin: 20px auto;
  ">
    <h2>${subdivision} Dashboard</h2>
    <p>This is working correctly.</p>
  </div>
`;

