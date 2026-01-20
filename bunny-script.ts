/**
 * PIPA Tag Search API - Bunny Edge Script
 * With libsql caching
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.10.0";
import { createClient, type Client } from "https://esm.sh/@libsql/client@0.6.0/web";
import { parse, type HTMLElement } from "https://esm.sh/node-html-parser@6.1.13";

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
  reportNo: string;
  inspectionBody: string;
  status: string;
  details?: ReportDetails | null;
  detailsError?: string;
}

interface ReportDetails {
  found: boolean;
  reportId?: string;
  id?: string;
  validFrom?: string;
  expiryDate?: string;
  inspectionBody?: string;
  tagNo?: string;
  deviceType?: string;
  serialNumber?: string;
  statusClass?: string;
  status?: string;
  imageUrl?: string;
  reportDetails?: Record<string, string>;
  device?: Record<string, unknown>;
  dimensions?: Record<string, string>;
  userLimits?: Record<string, number | string>;
  notes?: Record<string, string>;
  inspectionSections?: Record<string, unknown[]>;
  fetchedAt?: string;
  error?: string;
  isPdf?: boolean;
  redirectUrl?: string;
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
  // Updated regex to match new PIPA site structure (2025):
  // - Date in report__date
  // - Report No in report__number
  // - Inspection Body in report__company
  // - Status in tag tag--small
  const reportRegex =
    /<a class="report report--(\w+)" href="([^"]+)"[^>]*>[\s\S]*?report__date[\s\S]*?report__value">([^<]+)[\s\S]*?report__number[\s\S]*?report__value">([^<]+)[\s\S]*?report__company[\s\S]*?report__value">([^<]+)[\s\S]*?tag tag--small">([^<]+)/g;

  const matches = html.matchAll(reportRegex);
  const reports: AnnualReport[] = [];

  for (const match of matches) {
    reports.push({
      statusClass: match[1],
      url: match[2],
      date: match[3].trim(),
      reportNo: match[4].trim(),
      inspectionBody: match[5].trim(),
      status: match[6].trim(),
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

// =====================
// Report Parser Functions
// =====================

const getDetailFromLabelRow = (label: HTMLElement): string | null => {
  const row = label.closest("tr");
  if (!row) return null;
  const detail = row.querySelector(".detail");
  return detail?.text.trim() || null;
};

const findDetailByLabel = (root: HTMLElement, labelText: string): string | null => {
  const labels = root.querySelectorAll(".label");
  for (const label of labels) {
    if (label.text.trim().startsWith(labelText)) {
      const value = getDetailFromLabelRow(label);
      if (value) return value;
    }
  }
  return null;
};

const extractBadgeFromRow = (row: HTMLElement): { statusClass: string; status: string } | null => {
  const badge = row.querySelector("[class*='badge badge--']");
  if (!badge) return null;
  const classAttr = badge.getAttribute("class") || "";
  const classMatch = classAttr.match(/badge--(\w+)/);
  if (!classMatch) return null;
  return {
    statusClass: classMatch[1],
    status: badge.text.trim(),
  };
};

const getBadgeFromLabelRow = (label: HTMLElement): { statusClass: string; status: string } | null => {
  const row = label.closest("tr");
  if (!row) return null;
  return extractBadgeFromRow(row);
};

const findBadgeByLabel = (root: HTMLElement, labelText: string): { statusClass: string; status: string } | null => {
  const labels = root.querySelectorAll(".label");
  for (const label of labels) {
    if (!label.text.trim().includes(labelText)) continue;
    const badgeInfo = getBadgeFromLabelRow(label);
    if (badgeInfo) return badgeInfo;
  }
  return null;
};

const extractReportId = (root: HTMLElement): string | null => {
  const h1 = root.querySelector("h1");
  if (!h1) return null;
  const headerText = h1.text.trim();
  const match = headerText.match(/Inspection Report\s+(\S+)/);
  return match?.[1] || null;
};

const extractStatusBadge = (root: HTMLElement): { statusClass?: string; status?: string } => {
  const statusBadge = root.querySelector("[class*='badge badge--']");
  if (!statusBadge) return {};
  const classAttr = statusBadge.getAttribute("class") || "";
  const classMatch = classAttr.match(/badge--(\w+)/);
  if (!classMatch) return {};
  return {
    statusClass: classMatch[1],
    status: statusBadge.text.trim(),
  };
};

const extractImageUrl = (root: HTMLElement): string | null => {
  const img = root.querySelector('img[src*="hub.pipa.org.uk/content-files"]');
  if (!img) return null;
  const src = img.getAttribute("src");
  return src ? src.replace(/&amp;/g, "&") : null;
};

const extractIntroFields = (html: string): Record<string, unknown> => {
  const root = parse(html);
  const intro: Record<string, unknown> = {};

  const reportId = extractReportId(root);
  if (reportId) intro.reportId = reportId;

  const introFields: [string, string][] = [
    ["id", "ID:"],
    ["validFrom", "Inspection Valid from:"],
    ["expiryDate", "Expiry Date:"],
    ["inspectionBody", "Inspection Body:"],
    ["tagNo", "Tag No:"],
    ["deviceType", "Device Type:"],
    ["serialNumber", "Serial Number:"],
  ];

  for (const [key, label] of introFields) {
    const value = findDetailByLabel(root, label);
    if (value) intro[key] = value;
  }

  Object.assign(intro, extractStatusBadge(root));

  const imageUrl = extractImageUrl(root);
  if (imageUrl) intro.imageUrl = imageUrl;

  return intro;
};

const findSectionTable = (root: HTMLElement, headerText: string): HTMLElement | null => {
  const headers = root.querySelectorAll("th[colspan]");
  for (const th of headers) {
    if (th.text.trim() === headerText) {
      const table = th.closest("table");
      if (table) {
        return table.querySelector("tbody");
      }
    }
  }
  return null;
};

const extractReportDetailsSection = (html: string): Record<string, string> => {
  const root = parse(html);
  const details: Record<string, string> = {};

  const fields: [string, string][] = [
    ["creationDate", "Creation Date:"],
    ["inspectionDate", "Inspection Date:"],
    ["placeOfInspection", "Place of Inspection:"],
    ["inspector", "Inspector:"],
    ["structureVersion", "Structure version:"],
    ["indoorUseOnly", "Tested for Indoor Use Only:"],
  ];

  for (const [key, label] of fields) {
    const value = findDetailByLabel(root, label);
    if (value) details[key] = value;
  }

  return details;
};

const extractDeviceInfo = (html: string): Record<string, unknown> => {
  const root = parse(html);
  const device: Record<string, unknown> = {};

  const deviceSection = findSectionTable(root, "Device");

  const fields: [string, string][] = [
    ["pipaReferenceNumber", "PIPA Reference Number:"],
    ["tagNumber", "Tag Number:"],
    ["type", "Type:"],
    ["name", "Name:"],
    ["manufacturer", "Manufacturer:"],
    ["deviceSerialNumber", "Serial Number:"],
    ["dateManufactured", "Date Manufactured:"],
  ];

  const searchRoot = deviceSection || root;

  for (const [key, label] of fields) {
    const value = findDetailByLabel(searchRoot, label);
    if (value) device[key] = value;
  }

  const manualStatus = findBadgeByLabel(root, "operation manual present");
  if (manualStatus) device.operationManualPresent = manualStatus;

  return device;
};

const extractBadgeStatus = (row: HTMLElement, field: Record<string, unknown>): void => {
  const badgeInfo = extractBadgeFromRow(row);
  if (badgeInfo) {
    field.statusClass = badgeInfo.statusClass;
    field.status = badgeInfo.status;
  }
};

const extractDetailValues = (row: HTMLElement, field: Record<string, unknown>): void => {
  const details = row.querySelectorAll(".detail");
  const values: string[] = [];
  for (const detail of details) {
    const val = detail.text.trim();
    if (val) values.push(val);
  }
  if (values.length > 0) {
    field.value = values.join(" ").trim();
  }
};

const extractRowNotes = (row: HTMLElement, field: Record<string, unknown>): void => {
  const notesDiv = row.querySelector(".text");
  if (!notesDiv) return;
  const notes = notesDiv.text.trim();
  if (notes && notes !== "&nbsp;" && notes !== "") {
    field.notes = notes;
  }
};

const parseInspectionRow = (row: HTMLElement): Record<string, unknown> | null => {
  const labelDiv = row.querySelector(".label");
  if (!labelDiv) return null;

  const field: Record<string, unknown> = { label: labelDiv.text.trim().replace(/:$/, "") };
  extractBadgeStatus(row, field);
  extractDetailValues(row, field);
  extractRowNotes(row, field);

  return field;
};

const sectionNameToKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[,&]/g, "")
    .replace(/\s+(\w)/g, (_, c) => c.toUpperCase());

const SKIP_SECTIONS = new Set(["Report Details", "Device"]);

const processSection = (th: HTMLElement): { key: string; fields: unknown[] } | null => {
  const sectionName = th.text.trim();
  if (SKIP_SECTIONS.has(sectionName)) return null;

  const table = th.closest("table");
  if (!table) return null;

  const tbody = table.querySelector("tbody");
  if (!tbody) return null;

  const rows = tbody.querySelectorAll("tr");
  const fields: unknown[] = [];

  for (const row of rows) {
    const field = parseInspectionRow(row);
    if (field) fields.push(field);
  }

  if (fields.length === 0) return null;

  return { key: sectionNameToKey(sectionName), fields };
};

const extractInspectionSections = (html: string): Record<string, unknown[]> => {
  const root = parse(html);
  const sections: Record<string, unknown[]> = {};

  const headers = root.querySelectorAll("th[colspan]");
  for (const th of headers) {
    const result = processSection(th);
    if (result) sections[result.key] = result.fields;
  }

  return sections;
};

const extractUserLimits = (html: string): Record<string, number | string> => {
  const root = parse(html);
  const limits: Record<string, number | string> = {};

  const heightPatterns: [string, string][] = [
    ["upTo1_0m", "Max Number of Users of Height up to 1.0m:"],
    ["upTo1_2m", "Max Number of Users of Height up to 1.2m:"],
    ["upTo1_5m", "Max Number of Users of Height up to 1.5m:"],
    ["upTo1_8m", "Max Number of Users of Height up to 1.8m:"],
  ];

  for (const [key, label] of heightPatterns) {
    const value = findDetailByLabel(root, label);
    if (value) {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        limits[key] = num;
      }
    }
  }

  const customValue = findDetailByLabel(root, "Custom Max User Height:");
  if (customValue) {
    limits.customMaxHeight = customValue;
  }

  return limits;
};

const extractNotes = (html: string): Record<string, string> => {
  const root = parse(html);
  const notes: Record<string, string> = {};

  const fields: [string, string][] = [
    ["additionalNotes", "Additional Notes:"],
    ["riskAssessmentNotes", "Risk Assessment Notes:"],
    ["repairsNeeded", "Repairs needed to pass inspection:"],
    ["advisoryItems", "Advisory items"],
  ];

  for (const [key, label] of fields) {
    const value = findDetailByLabel(root, label);
    if (value) {
      const processed = value.replace(/&#xA;/g, "\n");
      notes[key] = processed;
    }
  }

  return notes;
};

const extractDimensions = (html: string): Record<string, string> => {
  const root = parse(html);
  const dimensions: Record<string, string> = {};

  const fields: [string, string][] = [
    ["length", "Length:"],
    ["width", "Width:"],
    ["height", "Height:"],
  ];

  for (const [key, label] of fields) {
    const value = findDetailByLabel(root, label);
    if (value) dimensions[key] = value;
  }

  return dimensions;
};

const parseReportPage = (html: string): ReportDetails => {
  if (!html.includes("Inspection Report") && !html.includes("badge badge--")) {
    return { found: false };
  }

  const intro = extractIntroFields(html);
  const reportDetails = extractReportDetailsSection(html);
  const device = extractDeviceInfo(html);
  const dimensions = extractDimensions(html);
  const userLimits = extractUserLimits(html);
  const notes = extractNotes(html);
  const sections = extractInspectionSections(html);

  return {
    found: true,
    ...intro,
    reportDetails,
    device,
    dimensions,
    userLimits,
    notes,
    inspectionSections: sections,
    fetchedAt: new Date().toISOString(),
  } as ReportDetails;
};

const isValidReportUrl = (url: string): boolean => url?.includes("hub.pipa.org.uk");

const fetchReport = async (reportUrl: string): Promise<ReportDetails> => {
  if (!isValidReportUrl(reportUrl)) {
    return { found: false, error: "Invalid report URL" };
  }

  const response = await fetch(reportUrl, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    return {
      found: false,
      isPdf: true,
      redirectUrl: response.headers.get("location") || undefined,
      error: "Report is a PDF download, not an HTML page",
    };
  }

  if (!response.ok) {
    return { found: false, error: `Report fetch error: ${response.status}` };
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/pdf")) {
    return { found: false, isPdf: true, error: "Report is a PDF, not HTML" };
  }

  const html = await response.text();
  return parseReportPage(html);
};

const fetchReportDetails = async (report: AnnualReport): Promise<AnnualReport> => {
  if (!report?.url) {
    return { ...report, details: null, detailsError: "No report URL" };
  }

  const details = await fetchReport(report.url);

  if (!details.found) {
    return { ...report, details: null, detailsError: details.error };
  }

  return { ...report, details };
};

const fetchAllReportDetails = async (tagData: TagResult): Promise<TagResult> => {
  if (!tagData?.found || !tagData?.annualReports?.length) {
    return tagData;
  }

  const detailedReports = await Promise.all(
    tagData.annualReports.map((report) => fetchReportDetails(report))
  );

  return { ...tagData, annualReports: detailedReports };
};

// =====================
// Cache Functions
// =====================

const searchTagWithCache = async (tagId: string, useCache = true): Promise<TagResult> => {
  // Only read from cache if useCache is true
  if (useCache) {
    const cached = await readCache(tagId);
    if (cached) {
      // Fetch details if not already in cache
      const hasDetails = cached.annualReports?.[0]?.details;
      if (cached.annualReports?.length && !hasDetails) {
        const withDetails = await fetchAllReportDetails(cached);
        await writeCache(tagId, withDetails);
        return { ...withDetails, fromCache: false };
      }
      return cached;
    }
  }

  const data = await searchTag(tagId);

  // Always fetch report details for found tags
  const finalData = data.found
    ? await fetchAllReportDetails(data)
    : data;

  // Always write to cache if found (even when bypassing read)
  if (finalData.found) {
    await writeCache(tagId, finalData);
  }

  return finalData;
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
    const useCache = !url.searchParams.has("noCache");
    const result = await searchTagWithCache(tagId, useCache);
    return jsonResponse(result);
  }

  if (url.pathname === "/health") {
    return jsonResponse({ status: "ok" });
  }

  return jsonResponse({ error: "Not found" }, 404);
});
