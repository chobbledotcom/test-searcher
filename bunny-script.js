/**
 * PIPA Tag Search API - Bunny Edge Script
 * Adapted for Bunny Edge Scripting runtime
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.10.0";

const BASE_URL = "https://www.pipa.org.uk";
const SEARCH_API = "/umbraco/Surface/searchSurface/SearchTag";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const isAllNumbers = (str) => {
  if (!str || str.length === 0) return false;
  return /^\d+$/.test(str);
};

const extractText = (html, pattern) => {
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
};

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

const extractAnnualReports = (html) => {
  const reportRegex =
    /<a class="report report--(\w+)" href="([^"]+)"[^>]*>[\s\S]*?Date:<\/div>\s*<div[^>]*>([^<]+)[\s\S]*?Inspector:<\/div>\s*<div[^>]*>([^<]+)[\s\S]*?Status:<\/div>\s*<div[^>]*>([^<]+)/g;

  const matches = html.matchAll(reportRegex);
  const reports = [];

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

const parseTagPage = (html, tagId) => {
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

const searchTag = async (tagId) => {
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

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

BunnySDK.net.http.serve(async (request) => {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/tag/")) {
    const tagId = url.pathname.slice(5);
    const result = await searchTag(tagId);
    return jsonResponse(result);
  }

  if (url.pathname === "/health") {
    return jsonResponse({ status: "ok" });
  }

  return jsonResponse({ error: "Not found" }, 404);
});
