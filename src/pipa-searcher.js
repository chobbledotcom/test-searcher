/**
 * PIPA Tag Searcher
 * Fetches and parses PIPA tag information from pipa.org.uk
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchReport } from "#src/report-parser.js";

const BASE_URL = "https://www.pipa.org.uk";
const SEARCH_API = "/umbraco/Surface/searchSurface/SearchTag";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Check if a string contains only digits
 * @param {string} str - The string to check
 * @returns {boolean} True if the string is all numbers
 */
export const isAllNumbers = (str) => {
  if (!str || str.length === 0) return false;
  return /^\d+$/.test(str);
};

/**
 * Extract text content from between HTML tags
 * @param {string} html - HTML string to search
 * @param {string} pattern - Regex pattern with capture group
 * @returns {string|null} Extracted text or null
 */
const extractText = (html, pattern) => {
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
};

/**
 * Extract details from the check__details HTML section
 * @param {string} html - Full HTML content
 * @returns {object} Extracted details
 */
const extractDetails = (html) => {
  const detailsSection = html.match(
    /check__details">([\s\S]*?)<\/div>\s*<div class="y-spacer/,
  );
  if (!detailsSection) return {};

  const section = detailsSection[1];
  const details = {};

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

/**
 * Extract annual reports from HTML
 * @param {string} html - Full HTML content
 * @returns {Array} Array of report objects
 */
const extractAnnualReports = (html) => {
  // Updated regex to match new PIPA site structure:
  // - Date in report__date
  // - Report No in report__number
  // - Inspection Body in report__company
  // - Status in tag tag--small
  const reportRegex =
    /<a class="report report--(\w+)" href="([^"]+)"[^>]*>[\s\S]*?report__date[\s\S]*?report__value">([^<]+)[\s\S]*?report__number[\s\S]*?report__value">([^<]+)[\s\S]*?report__company[\s\S]*?report__value">([^<]+)[\s\S]*?tag tag--small">([^<]+)/g;

  const matches = html.matchAll(reportRegex);
  const reports = [];

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

/**
 * Parse the PIPA tag details page HTML and extract data
 * @param {string} html - The HTML content of the tag page
 * @param {string} tagId - The tag ID being searched
 * @returns {object} Parsed tag data
 */
export const parseTagPage = (html, tagId) => {
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

/**
 * Search for a PIPA tag by ID
 * @param {string} tagId - The tag ID to search for
 * @param {object} options - Options
 * @param {Function} options.fetcher - Custom fetch function (for testing)
 * @returns {Promise<object>} The tag data or error
 */
export const searchTag = async (tagId, options = {}) => {
  const fetcher = options.fetcher || fetch;

  if (!isAllNumbers(tagId)) {
    return { found: false, error: "Invalid tag ID - must be all numbers" };
  }

  const searchUrl = `${BASE_URL}${SEARCH_API}?Tag=${tagId}&PageId=1133`;
  const searchResponse = await fetcher(searchUrl, {
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
  const tagResponse = await fetcher(tagUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!tagResponse.ok) {
    return { found: false, error: `Tag page error: ${tagResponse.status}` };
  }

  const html = await tagResponse.text();
  return parseTagPage(html, tagId);
};

/**
 * Get the cache file path for a tag
 * @param {string} tagId - The tag ID
 * @param {string} cacheDir - Base cache directory
 * @returns {string} Full path to the cache file
 */
export const getCachePath = (tagId, cacheDir = "cache/pipa") =>
  `${cacheDir}/${tagId}.json`;

/**
 * Read cached tag data if it exists
 * @param {string} tagId - The tag ID
 * @param {string} cacheDir - Base cache directory
 * @returns {Promise<object|null>} Cached data or null
 */
export const readCache = async (tagId, cacheDir = "cache/pipa") => {
  try {
    const path = getCachePath(tagId, cacheDir);
    const data = await readFile(path, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
};

/**
 * Write tag data to cache
 * @param {string} tagId - The tag ID
 * @param {object} data - The tag data to cache
 * @param {string} cacheDir - Base cache directory
 * @returns {Promise<void>}
 */
export const writeCache = async (tagId, data, cacheDir = "cache/pipa") => {
  const path = getCachePath(tagId, cacheDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
};

/**
 * Check if cached data needs details fetched
 * @param {object} cached - Cached tag data
 * @param {boolean} includeReportDetails - Whether details are requested
 * @returns {boolean} True if details need to be fetched
 */
const needsDetailsFetch = (cached, includeReportDetails) => {
  if (!includeReportDetails) return false;
  if (!cached.annualReports?.length) return false;
  return !cached.annualReports[0]?.details;
};

/**
 * Handle cache hit - return cached data or fetch missing details
 * @param {object} cached - Cached tag data
 * @param {string} tagId - The tag ID
 * @param {object} options - Options
 * @returns {Promise<object>} Tag data with fromCache flag
 */
const handleCacheHit = async (cached, tagId, options) => {
  const { includeReportDetails = false, cacheDir = "cache/pipa" } = options;

  if (needsDetailsFetch(cached, includeReportDetails)) {
    const withDetails = await fetchAllReportDetails(cached, options);
    await writeCache(tagId, withDetails, cacheDir);
    return { ...withDetails, fromCache: false };
  }
  return { ...cached, fromCache: true };
};

/**
 * Fetch fresh tag data and optionally include report details
 * @param {string} tagId - The tag ID
 * @param {object} options - Options
 * @returns {Promise<object>} Tag data
 */
const fetchFreshData = async (tagId, options) => {
  const { includeReportDetails = false, cacheDir = "cache/pipa" } = options;

  const data = await searchTag(tagId, options);

  const finalData =
    data.found && includeReportDetails
      ? await fetchAllReportDetails(data, options)
      : data;

  if (finalData.found) {
    await writeCache(tagId, finalData, cacheDir);
  }

  return finalData;
};

/**
 * Search for a PIPA tag, using cache if available
 * @param {string} tagId - The tag ID to search for
 * @param {object} options - Options
 * @param {boolean} options.useCache - Whether to use cached data (default: true)
 * @param {boolean} options.includeReportDetails - Whether to fetch detailed reports
 * @param {string} options.cacheDir - Cache directory (default: "cache/pipa")
 * @returns {Promise<object>} The tag data
 */
export const searchTagWithCache = async (tagId, options = {}) => {
  const { useCache = true, cacheDir = "cache/pipa" } = options;

  if (useCache) {
    const cached = await readCache(tagId, cacheDir);
    if (cached) {
      return handleCacheHit(cached, tagId, options);
    }
  }

  return fetchFreshData(tagId, options);
};

/**
 * Fetch detailed report data for a single annual report
 * @param {object} report - Report object with url property
 * @param {object} options - Options
 * @param {Function} options.fetcher - Custom fetch function (for testing)
 * @returns {Promise<object>} Report with details added
 */
export const fetchReportDetails = async (report, options = {}) => {
  if (!report?.url) {
    return { ...report, details: null, detailsError: "No report URL" };
  }

  const details = await fetchReport(report.url, options);

  if (!details.found) {
    return { ...report, details: null, detailsError: details.error };
  }

  return { ...report, details };
};

/**
 * Fetch detailed reports for all annual reports of a tag
 * @param {object} tagData - Tag data with annualReports array
 * @param {object} options - Options
 * @param {Function} options.fetcher - Custom fetch function (for testing)
 * @returns {Promise<object>} Tag data with detailed reports
 */
export const fetchAllReportDetails = async (tagData, options = {}) => {
  if (!tagData?.found || !tagData?.annualReports?.length) {
    return tagData;
  }

  const detailedReports = await Promise.all(
    tagData.annualReports.map((report) => fetchReportDetails(report, options)),
  );

  return { ...tagData, annualReports: detailedReports };
};

/**
 * Search for a tag and optionally fetch detailed report data
 * @param {string} tagId - The tag ID to search for
 * @param {object} options - Options
 * @param {boolean} options.includeReportDetails - Whether to fetch detailed reports
 * @param {Function} options.fetcher - Custom fetch function (for testing)
 * @returns {Promise<object>} Tag data with optional detailed reports
 */
export const searchTagWithReports = async (tagId, options = {}) => {
  const { includeReportDetails = false, ...searchOptions } = options;

  const tagData = await searchTag(tagId, searchOptions);

  if (!tagData.found || !includeReportDetails) {
    return tagData;
  }

  return fetchAllReportDetails(tagData, searchOptions);
};

// Re-export fetchReport for convenience
export { fetchReport };
