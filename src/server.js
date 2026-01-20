/**
 * Minimal PIPA Tag Search API Server
 * Usage: bun src/server.js
 */

import { searchTagWithCache } from "#src/pipa-searcher.js";

const PORT = process.env.PORT || 3000;

/**
 * Generate the homepage HTML with search form and API documentation
 * @returns {string} HTML content
 */
const getHomepageHtml = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PIPA Tag Search</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { color: #333; }
    .search-form { background: #f5f5f5; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
    .form-group { margin-bottom: 1rem; }
    label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    select, input { padding: 0.5rem; font-size: 1rem; border: 1px solid #ccc; border-radius: 4px; }
    select { width: 200px; }
    input[type="text"] { width: 200px; }
    button { background: #0066cc; color: white; padding: 0.5rem 1.5rem; font-size: 1rem; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #0055aa; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .api-docs { background: #f9f9f9; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #0066cc; }
    .api-docs h2 { margin-top: 0; }
    code { background: #e8e8e8; padding: 0.2rem 0.4rem; border-radius: 3px; font-family: monospace; }
    pre { background: #2d2d2d; color: #f8f8f2; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    .endpoint { margin-bottom: 1.5rem; }
    .method { color: #22c55e; font-weight: bold; }
  </style>
</head>
<body>
  <h1>PIPA Tag Search</h1>

  <div class="search-form">
    <form id="searchForm">
      <div class="form-group">
        <label for="host">Host</label>
        <select id="host" name="host" required>
          <option value="">Please select</option>
          <option value="pipa.org.uk">pipa.org.uk</option>
        </select>
      </div>
      <div class="form-group">
        <label for="unitId">Unit ID</label>
        <input type="text" id="unitId" name="unitId" placeholder="e.g. 40000" required pattern="[0-9]+" title="Unit ID must be a number">
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="useCache" name="useCache" checked> Use cache</label>
      </div>
      <button type="submit" id="searchBtn">Search</button>
    </form>
  </div>

  <div class="api-docs">
    <h2>API Documentation</h2>
    <p>This is an open API for searching PIPA (Playground Inspection Partners Association) safety tags.</p>

    <div class="endpoint">
      <h3><span class="method">GET</span> /tag/:id</h3>
      <p>Search for a PIPA tag by its ID number.</p>
      <p><strong>Parameters:</strong></p>
      <ul>
        <li><code>:id</code> - The numeric tag ID (e.g., 40000)</li>
      </ul>
      <p><strong>Example:</strong></p>
      <pre>curl https://test-searcher-upm2z.bunny.run/tag/40000</pre>
      <p><strong>Response:</strong></p>
      <pre>{
  "found": true,
  "tagId": "40000",
  "status": "Pass",
  "statusClass": "pass",
  "unitReferenceNo": "...",
  "type": "...",
  "currentOperator": "...",
  "certificateExpiryDate": "...",
  "certificateUrl": "...",
  "reportUrl": "...",
  "imageUrl": "...",
  "annualReports": [...],
  "fetchedAt": "..."
}</pre>
    </div>

    <div class="endpoint">
      <h3><span class="method">GET</span> /health</h3>
      <p>Health check endpoint.</p>
      <pre>curl https://test-searcher-upm2z.bunny.run/health</pre>
      <p><strong>Response:</strong> <code>{"status": "ok"}</code></p>
    </div>
  </div>

  <script>
    const form = document.getElementById('searchForm');
    const hostSelect = document.getElementById('host');
    const unitIdInput = document.getElementById('unitId');
    const useCacheCheckbox = document.getElementById('useCache');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!hostSelect.value) {
        alert('Please select a host');
        return;
      }
      const unitId = unitIdInput.value.trim();
      if (!unitId || !/^[0-9]+$/.test(unitId)) {
        alert('Please enter a valid numeric Unit ID');
        return;
      }
      const useCache = useCacheCheckbox.checked;
      let url = '/tag/' + encodeURIComponent(unitId);
      if (!useCache) {
        url += '?noCache=1';
      }
      window.location.href = url;
    });
  </script>
</body>
</html>`;

/**
 * Handle incoming requests
 * @param {Request} req - The incoming request
 * @returns {Promise<Response>} The response
 */
const handleRequest = async (req) => {
  const url = new URL(req.url);

  // Homepage with search form
  if (url.pathname === "/" || url.pathname === "") {
    return new Response(getHomepageHtml(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // GET /tag/:id - Search for a PIPA tag
  // ?noCache=1 bypasses cache read (but still writes to cache)
  // ?details=1 fetches detailed report data (user limits, dimensions, etc.)
  if (url.pathname.startsWith("/tag/")) {
    const tagId = url.pathname.slice(5);
    const useCache = !url.searchParams.has("noCache");
    const includeReportDetails = url.searchParams.has("details");
    const result = await searchTagWithCache(tagId, {
      useCache,
      includeReportDetails,
    });
    return Response.json(result);
  }

  // Health check
  if (url.pathname === "/health") {
    return Response.json({ status: "ok" });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
};

/**
 * Start the server
 * @param {number} port - Port to listen on
 * @returns {object} Server instance
 */
export const startServer = (port = PORT) =>
  Bun.serve({
    port,
    fetch: handleRequest,
  });

export { handleRequest };
