/**
 * PIPA Report Parser
 * Parses detailed inspection report pages from hub.pipa.org.uk
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Extract intro section fields from report HTML
 * @param {string} html - Full HTML content
 * @returns {object} Intro fields
 */
export const extractIntroFields = (html) => {
  const intro = {};

  // Extract from intro table structure
  const introPatterns = [
    ["reportId", /Inspection Report\s+([^<\s]+)/],
    [
      "id",
      /<div class="label"[^>]*>ID:<\/div>\s*<\/td>\s*<td>\s*<div class="detail"[^>]*>\s*([^<]+)/i,
    ],
    [
      "validFrom",
      /Inspection Valid from:<\/div>\s*<\/td>\s*<td>\s*<div class="detail"[^>]*>\s*([^<]+)/i,
    ],
    [
      "expiryDate",
      /Expiry Date:<\/div>\s*<\/td>\s*<td>\s*<div class="detail"[^>]*>\s*([^<]+)/i,
    ],
    [
      "inspectionBody",
      /Inspection Body:<\/div>\s*<\/td>\s*<td>\s*<div class="detail"[^>]*>([^<]+)/i,
    ],
    [
      "tagNo",
      /Tag No:<\/div>\s*<\/td>\s*<td>\s*<div class="detail"[^>]*>([^<]+)/i,
    ],
    [
      "deviceType",
      /Device Type:<\/div>\s*<\/td>\s*<td>\s*<div class="detail"[^>]*>([^<]+)/i,
    ],
    [
      "serialNumber",
      /Serial Number:<\/div>\s*<\/td>\s*<td>\s*<div class="detail"[^>]*>([^<]+)/i,
    ],
  ];

  for (const [key, pattern] of introPatterns) {
    const match = html.match(pattern);
    if (match) {
      intro[key] = match[1].trim();
    }
  }

  // Extract status with badge class
  const statusMatch = html.match(/badge badge--(\w+)"[^>]*>([^<]+)/);
  if (statusMatch) {
    intro.statusClass = statusMatch[1];
    intro.status = statusMatch[2].trim();
  }

  // Extract main image URL
  const imageMatch = html.match(
    /<img[^>]+src="(https:\/\/hub\.pipa\.org\.uk\/content-files\/[^"]+)"/,
  );
  if (imageMatch) {
    intro.imageUrl = imageMatch[1].replace(/&amp;/g, "&");
  }

  return intro;
};

/**
 * Extract report details section
 * @param {string} html - Full HTML content
 * @returns {object} Report details
 */
export const extractReportDetails = (html) => {
  const details = {};

  const patterns = [
    [
      "creationDate",
      /Creation Date:<\/div>\s*<\/td>\s*<td[^>]*>\s*<div class="detail">([^<]+)/i,
    ],
    [
      "inspectionDate",
      /Inspection Date:<\/div>\s*<\/td>\s*<td[^>]*>\s*<div class="detail">([^<]+)/i,
    ],
    [
      "placeOfInspection",
      /Place of Inspection:<\/div>\s*<\/td>\s*<td[^>]*>\s*<div class="detail">([^<]+)/i,
    ],
    [
      "inspector",
      /Inspector:<\/div>\s*<\/td>\s*<td[^>]*>\s*<div class="detail">([^<]+)/i,
    ],
    [
      "structureVersion",
      /Structure version:<\/div>\s*<\/td>\s*<td[^>]*>\s*<div class="detail">([^<]+)/i,
    ],
  ];

  for (const [key, pattern] of patterns) {
    const match = html.match(pattern);
    if (match) {
      details[key] = match[1].trim();
    }
  }

  // Indoor use only - Yes/No
  const indoorMatch = html.match(
    /Tested for Indoor Use Only:<\/div>[\s\S]*?<div class="detail">([^<]+)/i,
  );
  if (indoorMatch) {
    details.indoorUseOnly = indoorMatch[1].trim();
  }

  return details;
};

/**
 * Extract device information section
 * @param {string} html - Full HTML content
 * @returns {object} Device info
 */
export const extractDeviceInfo = (html) => {
  const device = {};

  const patterns = [
    [
      "pipaReferenceNumber",
      /PIPA Reference Number:<\/div>\s*<\/td>\s*<td[^>]*>\s*<div class="detail">([^<]+)/i,
    ],
    [
      "tagNumber",
      /Tag Number:<\/div>\s*<\/td>\s*<td[^>]*>\s*<div class="detail">([^<]+)/i,
    ],
    [
      "type",
      /<th colspan="4">Device<\/th>[\s\S]*?Type:<\/div>\s*<\/td>\s*<td[^>]*>\s*<div class="detail">([^<]+)/i,
    ],
    [
      "name",
      /Name:<\/div>\s*<\/td>\s*<td[^>]*>\s*<div class="detail">([^<]+)/i,
    ],
    [
      "manufacturer",
      /Manufacturer:<\/div>\s*<\/td>\s*<td[^>]*>\s*<div class="detail">([^<]+)/i,
    ],
    [
      "deviceSerialNumber",
      /<th colspan="4">Device<\/th>[\s\S]*?Serial Number:<\/div>\s*<\/td>\s*<td[^>]*>\s*<div class="detail">([^<]+)/i,
    ],
    [
      "dateManufactured",
      /Date Manufactured:<\/div>\s*<\/td>\s*<td[^>]*>\s*<div class="detail">([^<]+)/i,
    ],
  ];

  for (const [key, pattern] of patterns) {
    const match = html.match(pattern);
    if (match) {
      device[key] = match[1].trim();
    }
  }

  // Manual present - Pass/Fail
  const manualMatch = html.match(
    /manufacturer.*operation manual present\?:<\/div>[\s\S]*?badge--(\w+)">([^<]+)/i,
  );
  if (manualMatch) {
    device.operationManualPresent = {
      statusClass: manualMatch[1],
      status: manualMatch[2].trim(),
    };
  }

  return device;
};

/**
 * Extract badge status from row HTML
 * @param {string} rowHtml - HTML for one table row
 * @param {object} field - Field object to populate
 */
const extractBadgeStatus = (rowHtml, field) => {
  const badgeMatch = rowHtml.match(/badge badge--(\w+)"[^>]*>([^<]+)/);
  if (badgeMatch) {
    field.statusClass = badgeMatch[1];
    field.status = badgeMatch[2].trim();
  }
};

/**
 * Extract detail values from row HTML
 * @param {string} rowHtml - HTML for one table row
 * @param {object} field - Field object to populate
 */
const extractDetailValues = (rowHtml, field) => {
  const detailMatches = rowHtml.matchAll(
    /<div class="detail"[^>]*>([^<]*)<\/div>/g,
  );
  const details = [];
  for (const m of detailMatches) {
    const val = m[1].trim();
    if (val) details.push(val);
  }
  if (details.length > 0) {
    field.value = details.join(" ").trim();
  }
};

/**
 * Extract notes from row HTML
 * @param {string} rowHtml - HTML for one table row
 * @param {object} field - Field object to populate
 */
const extractRowNotes = (rowHtml, field) => {
  const notesMatch = rowHtml.match(/<div class="text">\s*([^<]+)/);
  const notes = notesMatch?.[1]?.trim();
  if (notes && notes !== "&nbsp;") {
    field.notes = notes;
  }
};

/**
 * Extract a single inspection field with optional status, value, and notes
 * @param {string} rowHtml - HTML for one table row
 * @returns {object|null} Field data or null
 */
const parseInspectionRow = (rowHtml) => {
  const labelMatch = rowHtml.match(/<div class="label">([^<]+)<\/div>/);
  if (!labelMatch) return null;

  const field = { label: labelMatch[1].trim().replace(/:$/, "") };
  extractBadgeStatus(rowHtml, field);
  extractDetailValues(rowHtml, field);
  extractRowNotes(rowHtml, field);

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
 * Parse rows from a section body
 * @param {string} sectionBody - HTML content of section tbody
 * @returns {Array} Array of field objects
 */
const parseSectionRows = (sectionBody) => {
  const rowRegex = /<tr>\s*<td[^>]*>[\s\S]*?<div class="label">[\s\S]*?<\/tr>/g;
  const rows = sectionBody.matchAll(rowRegex);
  const fields = [];

  for (const row of rows) {
    const field = parseInspectionRow(row[0]);
    if (field) fields.push(field);
  }

  return fields;
};

/**
 * Extract all inspection sections (Structure, Materials, etc.)
 * @param {string} html - Full HTML content
 * @returns {object} Sections with their fields
 */
export const extractInspectionSections = (html) => {
  const sections = {};
  const sectionRegex =
    /<th colspan="4">([^<]+)<\/th>[\s\S]*?<\/thead>\s*<tbody>([\s\S]*?)<\/tbody>/g;

  for (const match of html.matchAll(sectionRegex)) {
    const sectionName = match[1].trim();
    if (SKIP_SECTIONS.has(sectionName)) continue;

    const fields = parseSectionRows(match[2]);
    if (fields.length > 0) {
      sections[sectionNameToKey(sectionName)] = fields;
    }
  }

  return sections;
};

/**
 * Extract user capacity limits
 * @param {string} html - Full HTML content
 * @returns {object} User limits by height
 */
export const extractUserLimits = (html) => {
  const limits = {};

  const heightPatterns = [
    [
      "upTo1_0m",
      /Max Number of Users of Height up to 1\.0m:<\/div>[\s\S]*?<div class="detail">(\d+)/i,
    ],
    [
      "upTo1_2m",
      /Max Number of Users of Height up to 1\.2m:<\/div>[\s\S]*?<div class="detail">(\d+)/i,
    ],
    [
      "upTo1_5m",
      /Max Number of Users of Height up to 1\.5m:<\/div>[\s\S]*?<div class="detail">(\d+)/i,
    ],
    [
      "upTo1_8m",
      /Max Number of Users of Height up to 1\.8m:<\/div>[\s\S]*?<div class="detail">(\d+)/i,
    ],
  ];

  for (const [key, pattern] of heightPatterns) {
    const match = html.match(pattern);
    if (match) {
      limits[key] = Number.parseInt(match[1], 10);
    }
  }

  // Custom max height
  const customMatch = html.match(
    /Custom Max User Height:<\/div>[\s\S]*?<div class="detail">([^<]+)/i,
  );
  const customValue = customMatch?.[1]?.trim();
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
  const notes = {};

  const patterns = [
    [
      "additionalNotes",
      /Additional Notes:<\/div>[\s\S]*?<div class="detail">([^<]+)/i,
    ],
    [
      "riskAssessmentNotes",
      /Risk Assessment Notes:<\/div>[\s\S]*?<div class="detail">([^<]+)/i,
    ],
    [
      "repairsNeeded",
      /Repairs needed to pass inspection:<\/div>[\s\S]*?<div class="detail">([^<]+)/i,
    ],
    [
      "advisoryItems",
      /Advisory items\s*:<\/div>[\s\S]*?<div class="detail">([^<]+)/i,
    ],
  ];

  for (const [key, pattern] of patterns) {
    const match = html.match(pattern);
    if (match) {
      const value = match[1].trim().replace(/&#xA;/g, "\n");
      if (value) {
        notes[key] = value;
      }
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
  const dimensions = {};

  const patterns = [
    ["length", /Length:<\/div>[\s\S]*?<div class="detail">([^<]+)/i],
    ["width", /Width:<\/div>[\s\S]*?<div class="detail">([^<]+)/i],
    ["height", /Height:<\/div>[\s\S]*?<div class="detail">([^<]+)/i],
  ];

  for (const [key, pattern] of patterns) {
    const match = html.match(pattern);
    if (match) {
      dimensions[key] = match[1].trim();
    }
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
