/**
 * PIPA Tag Search API - Bunny Edge Script
 * With libsql caching
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.10.0";
import { createClient, type Client } from "https://esm.sh/@libsql/client@0.6.0/web";

const BASE_URL = "https://www.pipa.org.uk";
const SEARCH_API = "/umbraco/Surface/searchSurface/SearchTag";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface TagDetails {
  unitReferenceNo?: string;
  type?: string;
  currentOperator?: string;
  certificateExpiryDate?: string;
}

interface AnnualReport {
  statusClass: string;
  url: string;
  date: string;
  inspector: string;
  status: string;
}

interface TagResult {
  found: boolean;
  tagId?: string;
  status?: string;
  statusClass?: string;
  certificateUrl?: string | null;
  reportUrl?: string | null;
  imageUrl?: string | null;
  annualReports?: AnnualReport[];
  fetchedAt?: string;
  fromCache?: boolean;
  error?: string;
}

interface CacheRow {
  host: string;
  id: string;
  cached: string;
  json: string;
}

// Database client (lazy initialized)
let db: Client | null = null;

const getDb = (): Client => {
  if (!db) {
    db = createClient({
      url: process.env.DB_URL!,
      authToken: process.env.DB_TOKEN,
    });
  }
  return db;
};

const initCache = async (): Promise<void> => {
  await getDb().execute(`
    CREATE TABLE IF NOT EXISTS cache (
      host TEXT NOT NULL,
      id TEXT NOT NULL,
      cached TEXT NOT NULL,
      json TEXT NOT NULL,
      PRIMARY KEY (host, id)
    )
  `);
};

const CACHE_HOST = "pipa.org.uk";

const readCache = async (tagId: string): Promise<TagResult | null> => {
  const result = await getDb().execute({
    sql: "SELECT json, cached FROM cache WHERE host = ? AND id = ?",
    args: [CACHE_HOST, tagId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as unknown as CacheRow;
  const cachedAt = new Date(row.cached).getTime();
  const age = Date.now() - cachedAt;

  if (age > CACHE_TTL_MS) return null;

  return { ...JSON.parse(row.json), fromCache: true };
};

const writeCache = async (tagId: string, data: TagResult): Promise<void> => {
  await getDb().execute({
    sql: "INSERT OR REPLACE INTO cache (host, id, cached, json) VALUES (?, ?, ?, ?)",
    args: [CACHE_HOST, tagId, new Date().toISOString(), JSON.stringify(data)],
  });
};

const isAllNumbers = (str: string): boolean => {
  if (!str || str.length === 0) return false;
  return /^\d+$/.test(str);
};

const extractText = (html: string, pattern: RegExp): string | null => {
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
};

const extractDetails = (html: string): TagDetails => {
  const detailsSection = html.match(
    /check__details">([\s\S]*?)<\/div>\s*<div class="y-spacer/,
  );
  if (!detailsSection) return {};

  const section = detailsSection[1];
  const details: TagDetails = {};

  const unitRef = extractText(
    section,
    /Unit Reference No:<\/div>\s*<div[^>]*>([^<]+)/,
  );
  if (unitRef) details.unitReferenceNo = unitRef;

  const type = extractText(section, /Type:<\/div>\s*<div[^>]*>([^<]+)/);
  if (type) details.type = type;

  const operator = extractText(
    section,
    /Current Operator:<\/div>\s*<div[^>]*>([^<]+)/,
  );
  if (operator) details.currentOperator = operator;

  const expiry = extractText(
    section,
    /Certificate Expiry Date:<\/div>\s*<div[^>]*>([^<]+)/,
  );
  if (expiry) details.certificateExpiryDate = expiry;

  return details;
};

const extractAnnualReports = (html: string): AnnualReport[] => {
  const reportRegex =
    /<a class="report report--(\w+)" href="([^"]+)"[^>]*>[\s\S]*?Date:<\/div>\s*<div[^>]*>([^<]+)[\s\S]*?Inspector:<\/div>\s*<div[^>]*>([^<]+)[\s\S]*?Status:<\/div>\s*<div[^>]*>([^<]+)/g;

  const matches = html.matchAll(reportRegex);
  const reports: AnnualReport[] = [];

  for (const match of matches) {
    reports.push({
      statusClass: match[1],
      url: match[2],
      date: match[3].trim(),
      inspector: match[4].trim(),
      status: match[5].trim(),
    });
  }

  return reports;
};

const parseTagPage = (html: string, tagId: string): TagResult => {
  const statusMatch = html.match(/check__image-tag--(\w+)"[^>]*>([^<]+)</i);
  if (!statusMatch) {
    return { found: false, tagId };
  }

  const certificateUrl = extractText(
    html,
    /href="(https:\/\/hub\.pipa\.org\.uk\/download\/reports\/certificate\/[^"]+)"/,
  );
  const reportUrl = extractText(
    html,
    /href="(https:\/\/hub\.pipa\.org\.uk\/public\/reports\/report\/[^"]+)"/,
  );
  const imageUrl = extractText(
    html,
    /check__image[^>]*>[\s\S]*?<img src="([^"]+)"/,
  );

  return {
    found: true,
    tagId,
    status: statusMatch[2].trim(),
    statusClass: statusMatch[1],
    ...extractDetails(html),
    certificateUrl,
    reportUrl,
    imageUrl,
    annualReports: extractAnnualReports(html),
    fetchedAt: new Date().toISOString(),
  };
};

const searchTag = async (tagId: string): Promise<TagResult> => {
  if (!isAllNumbers(tagId)) {
    return { found: false, error: "Invalid tag ID - must be all numbers" };
  }

  const searchUrl = `${BASE_URL}${SEARCH_API}?Tag=${tagId}&PageId=1133`;
  const searchResponse = await fetch(searchUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!searchResponse.ok) {
    return {
      found: false,
      error: `Search API error: ${searchResponse.status}`,
    };
  }

  const searchResult = await searchResponse.json();

  if (searchResult.success !== "true") {
    return { found: false, tagId, error: "Tag not found" };
  }

  const tagUrl = `${BASE_URL}${searchResult.message}`;
  const tagResponse = await fetch(tagUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!tagResponse.ok) {
    return { found: false, error: `Tag page error: ${tagResponse.status}` };
  }

  const html = await tagResponse.text();
  return parseTagPage(html, tagId);
};

const searchTagWithCache = async (tagId: string): Promise<TagResult> => {
  const cached = await readCache(tagId);
  if (cached) return cached;

  const data = await searchTag(tagId);

  if (data.found) {
    await writeCache(tagId, data);
  }

  return data;
};

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const getHomepageHtml = (): string => `<!DOCTYPE html>
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
      window.location.href = '/tag/' + encodeURIComponent(unitId);
    });
  </script>
</body>
</html>`;

// Initialize cache table on startup
let initialized = false;

BunnySDK.net.http.serve(async (request: Request): Promise<Response> => {
  if (!initialized) {
    await initCache();
    initialized = true;
  }

  const url = new URL(request.url);

  // Homepage with search form
  if (url.pathname === "/" || url.pathname === "") {
    return new Response(getHomepageHtml(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  if (url.pathname.startsWith("/tag/")) {
    const tagId = url.pathname.slice(5);
    const result = await searchTagWithCache(tagId);
    return jsonResponse(result);
  }

  if (url.pathname === "/health") {
    return jsonResponse({ status: "ok" });
  }

  return jsonResponse({ error: "Not found" }, 404);
});
