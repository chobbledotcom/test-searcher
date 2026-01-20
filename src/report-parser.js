/**
 * PIPA Report Parser
 * Parses detailed inspection report pages from hub.pipa.org.uk
 */

import { parse } from "node-html-parser";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Get detail value from a row containing a label
 * @param {HTMLElement} label - Label element
 * @returns {string|null} Detail value or null
 */
const getDetailFromLabelRow = (label) => {
  const row = label.closest("tr");
  if (!row) return null;
  const detail = row.querySelector(".detail");
  return detail?.text.trim() || null;
};

/**
 * Find a row by label text and extract the detail value
 * @param {HTMLElement} root - Parsed HTML root
 * @param {string} labelText - Label text to search for
 * @returns {string|null} Detail value or null
 */
const findDetailByLabel = (root, labelText) => {
  const labels = root.querySelectorAll(".label");
  for (const label of labels) {
    if (label.text.trim().startsWith(labelText)) {
      const value = getDetailFromLabelRow(label);
      if (value) return value;
    }
  }
  return null;
};

/**
 * Extract badge info from a row
 * @param {HTMLElement} row - Table row element
 * @returns {object|null} Badge info or null
 */
const extractBadgeFromRow = (row) => {
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

/**
 * Get badge from a label's row
 * @param {HTMLElement} label - Label element
 * @returns {object|null} Badge info or null
 */
const getBadgeFromLabelRow = (label) => {
  const row = label.closest("tr");
  if (!row) return null;
  return extractBadgeFromRow(row);
};

/**
 * Find a badge by label text and extract status info
 * @param {HTMLElement} root - Parsed HTML root
 * @param {string} labelText - Label text to search for
 * @returns {object|null} Status info or null
 */
const findBadgeByLabel = (root, labelText) => {
  const labels = root.querySelectorAll(".label");
  for (const label of labels) {
    if (!label.text.trim().includes(labelText)) continue;
    const badgeInfo = getBadgeFromLabelRow(label);
    if (badgeInfo) return badgeInfo;
  }
  return null;
};

/**
 * Extract report ID from header
 * @param {HTMLElement} root - Parsed HTML root
 * @returns {string|null} Report ID or null
 */
const extractReportId = (root) => {
  const h1 = root.querySelector("h1");
  if (!h1) return null;
  const headerText = h1.text.trim();
  const match = headerText.match(/Inspection Report\s+(\S+)/);
  return match?.[1] || null;
};

/**
 * Extract status badge info from HTML
 * @param {HTMLElement} root - Parsed HTML root
 * @returns {object} Status info
 */
const extractStatusBadge = (root) => {
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

/**
 * Extract image URL from HTML
 * @param {HTMLElement} root - Parsed HTML root
 * @returns {string|null} Image URL or null
 */
const extractImageUrl = (root) => {
  const img = root.querySelector('img[src*="hub.pipa.org.uk/content-files"]');
  if (!img) return null;
  const src = img.getAttribute("src");
  return src ? src.replace(/&amp;/g, "&") : null;
};

/**
 * Extract intro section fields from report HTML
 * @param {string} html - Full HTML content
 * @returns {object} Intro fields
 */
export const extractIntroFields = (html) => {
  const root = parse(html);
  const intro = {};

  // Extract report ID from header
  const reportId = extractReportId(root);
  if (reportId) intro.reportId = reportId;

  // Extract fields using label search
  const introFields = [
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

  // Extract status with badge class
  Object.assign(intro, extractStatusBadge(root));

  // Extract main image URL
  const imageUrl = extractImageUrl(root);
  if (imageUrl) intro.imageUrl = imageUrl;

  return intro;
};

/**
 * Find a section table by header text
 * @param {HTMLElement} root - Parsed HTML root
 * @param {string} headerText - Section header text
 * @returns {HTMLElement|null} tbody element or null
 */
const findSectionTable = (root, headerText) => {
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

/**
 * Extract report details section
 * @param {string} html - Full HTML content
 * @returns {object} Report details
 */
export const extractReportDetails = (html) => {
  const root = parse(html);
  const details = {};

  const fields = [
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

/**
 * Extract device information section
 * @param {string} html - Full HTML content
 * @returns {object} Device info
 */
export const extractDeviceInfo = (html) => {
  const root = parse(html);
  const device = {};

  // Find the Device section
  const deviceSection = findSectionTable(root, "Device");

  const fields = [
    ["pipaReferenceNumber", "PIPA Reference Number:"],
    ["tagNumber", "Tag Number:"],
    ["type", "Type:"],
    ["name", "Name:"],
    ["manufacturer", "Manufacturer:"],
    ["deviceSerialNumber", "Serial Number:"],
    ["dateManufactured", "Date Manufactured:"],
  ];

  // If we found the device section, search within it first
  const searchRoot = deviceSection || root;

  for (const [key, label] of fields) {
    const value = findDetailByLabel(searchRoot, label);
    if (value) device[key] = value;
  }

  // Manual present - Pass/Fail (search in device section)
  const manualStatus = findBadgeByLabel(root, "operation manual present");
  if (manualStatus) device.operationManualPresent = manualStatus;

  return device;
};

/**
 * Extract badge status from row element
 * @param {HTMLElement} row - Table row element
 * @param {object} field - Field object to populate
 */
const extractBadgeStatus = (row, field) => {
  const badgeInfo = extractBadgeFromRow(row);
  if (badgeInfo) {
    field.statusClass = badgeInfo.statusClass;
    field.status = badgeInfo.status;
  }
};

/**
 * Extract detail values from row element
 * @param {HTMLElement} row - Table row element
 * @param {object} field - Field object to populate
 */
const extractDetailValues = (row, field) => {
  const details = row.querySelectorAll(".detail");
  const values = [];
  for (const detail of details) {
    const val = detail.text.trim();
    if (val) values.push(val);
  }
  if (values.length > 0) {
    field.value = values.join(" ").trim();
  }
};

/**
 * Extract notes from row element
 * @param {HTMLElement} row - Table row element
 * @param {object} field - Field object to populate
 */
const extractRowNotes = (row, field) => {
  const notesDiv = row.querySelector(".text");
  if (!notesDiv) return;
  const notes = notesDiv.text.trim();
  if (notes && notes !== "&nbsp;" && notes !== "") {
    field.notes = notes;
  }
};

/**
 * Parse a single inspection row
 * @param {HTMLElement} row - Table row element
 * @returns {object|null} Field data or null
 */
const parseInspectionRow = (row) => {
  const labelDiv = row.querySelector(".label");
  if (!labelDiv) return null;

  const field = { label: labelDiv.text.trim().replace(/:$/, "") };
  extractBadgeStatus(row, field);
  extractDetailValues(row, field);
  extractRowNotes(row, field);

  return field;
};

/**
 * Convert section name to camelCase key
 * @param {string} name - Section name
 * @returns {string} camelCase key
 */
const sectionNameToKey = (name) =>
  name
    .toLowerCase()
    .replace(/[,&]/g, "")
    .replace(/\s+(\w)/g, (_, c) => c.toUpperCase());

/**
 * Sections to skip when extracting inspection data
 */
const SKIP_SECTIONS = new Set(["Report Details", "Device"]);

/**
 * Process a single section header and extract fields
 * @param {HTMLElement} th - Section header element
 * @returns {object|null} Section data or null
 */
const processSection = (th) => {
  const sectionName = th.text.trim();
  if (SKIP_SECTIONS.has(sectionName)) return null;

  const table = th.closest("table");
  if (!table) return null;

  const tbody = table.querySelector("tbody");
  if (!tbody) return null;

  const rows = tbody.querySelectorAll("tr");
  const fields = [];

  for (const row of rows) {
    const field = parseInspectionRow(row);
    if (field) fields.push(field);
  }

  if (fields.length === 0) return null;

  return { key: sectionNameToKey(sectionName), fields };
};

/**
 * Extract all inspection sections (Structure, Materials, etc.)
 * @param {string} html - Full HTML content
 * @returns {object} Sections with their fields
 */
export const extractInspectionSections = (html) => {
  const root = parse(html);
  const sections = {};

  const headers = root.querySelectorAll("th[colspan]");
  for (const th of headers) {
    const result = processSection(th);
    if (result) sections[result.key] = result.fields;
  }

  return sections;
};

/**
 * Extract user capacity limits
 * @param {string} html - Full HTML content
 * @returns {object} User limits by height
 */
export const extractUserLimits = (html) => {
  const root = parse(html);
  const limits = {};

  const heightPatterns = [
    ["upTo1_0m", "Max Number of Users of Height up to 1.0m:"],
    ["upTo1_2m", "Max Number of Users of Height up to 1.2m:"],
    ["upTo1_5m", "Max Number of Users of Height up to 1.5m:"],
    ["upTo1_8m", "Max Number of Users of Height up to 1.8m:"],
  ];

  for (const [key, label] of heightPatterns) {
    const value = findDetailByLabel(root, label);
    if (value) {
      const num = Number.parseInt(value, 10);
      if (!Number.isNaN(num)) {
        limits[key] = num;
      }
    }
  }

  // Custom max height
  const customValue = findDetailByLabel(root, "Custom Max User Height:");
  if (customValue) {
    limits.customMaxHeight = customValue;
  }

  return limits;
};

/**
 * Extract notes section
 * @param {string} html - Full HTML content
 * @returns {object} Notes
 */
export const extractNotes = (html) => {
  const root = parse(html);
  const notes = {};

  const fields = [
    ["additionalNotes", "Additional Notes:"],
    ["riskAssessmentNotes", "Risk Assessment Notes:"],
    ["repairsNeeded", "Repairs needed to pass inspection:"],
    ["advisoryItems", "Advisory items"],
  ];

  for (const [key, label] of fields) {
    const value = findDetailByLabel(root, label);
    if (value) {
      // Convert HTML entities for newlines
      const processed = value.replace(/&#xA;/g, "\n");
      notes[key] = processed;
    }
  }

  return notes;
};

/**
 * Extract key dimensions from Structure section
 * @param {string} html - Full HTML content
 * @returns {object} Dimensions
 */
export const extractDimensions = (html) => {
  const root = parse(html);
  const dimensions = {};

  const fields = [
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

/**
 * Parse a complete PIPA report page
 * @param {string} html - The full HTML of the report page
 * @returns {object} Parsed report data
 */
export const parseReportPage = (html) => {
  // Check if this looks like a valid report page
  if (!html.includes("Inspection Report") && !html.includes("badge badge--")) {
    return { found: false };
  }

  const intro = extractIntroFields(html);
  const reportDetails = extractReportDetails(html);
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
  };
};

/**
 * Check if URL is a valid PIPA report URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
const isValidReportUrl = (url) => url?.includes("hub.pipa.org.uk");

/**
 * Check response for redirect (PDF download)
 * @param {Response} response - Fetch response
 * @returns {object|null} Error result if redirect, null otherwise
 */
const checkForRedirect = (response) => {
  if (response.status >= 300 && response.status < 400) {
    return {
      found: false,
      isPdf: true,
      redirectUrl: response.headers.get("location"),
      error: "Report is a PDF download, not an HTML page",
    };
  }
  return null;
};

/**
 * Check if response is PDF content
 * @param {Response} response - Fetch response
 * @returns {boolean} True if PDF
 */
const isPdfContent = (response) => {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/pdf");
};

/**
 * Fetch and parse a PIPA report
 * @param {string} reportUrl - The report URL
 * @param {object} options - Options
 * @param {Function} options.fetcher - Custom fetch function (for testing)
 * @returns {Promise<object>} Parsed report data
 */
export const fetchReport = async (reportUrl, options = {}) => {
  if (!isValidReportUrl(reportUrl)) {
    return { found: false, error: "Invalid report URL" };
  }

  const fetcher = options.fetcher || fetch;
  const response = await fetcher(reportUrl, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "manual",
  });

  const redirectResult = checkForRedirect(response);
  if (redirectResult) return redirectResult;

  if (!response.ok) {
    return { found: false, error: `Report fetch error: ${response.status}` };
  }

  if (isPdfContent(response)) {
    return { found: false, isPdf: true, error: "Report is a PDF, not HTML" };
  }

  const html = await response.text();
  return parseReportPage(html);
};
