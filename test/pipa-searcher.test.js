import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import {
  fetchAllReportDetails,
  fetchReport,
  fetchReportDetails,
  getCachePath,
  isAllNumbers,
  parseTagPage,
  readCache,
  searchTag,
  searchTagWithCache,
  writeCache,
} from "#src/pipa-searcher.js";

describe("isAllNumbers", () => {
  test("returns true for strings containing only digits", () => {
    expect(isAllNumbers("123")).toBe(true);
    expect(isAllNumbers("0")).toBe(true);
    expect(isAllNumbers("40000")).toBe(true);
    expect(isAllNumbers("9876543210")).toBe(true);
  });

  test("returns false for strings with non-digit characters", () => {
    expect(isAllNumbers("12a3")).toBe(false);
    expect(isAllNumbers("abc")).toBe(false);
    expect(isAllNumbers("12.34")).toBe(false);
    expect(isAllNumbers("12-34")).toBe(false);
    expect(isAllNumbers(" 123")).toBe(false);
    expect(isAllNumbers("123 ")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isAllNumbers("")).toBe(false);
  });

  test("returns false for null/undefined", () => {
    expect(isAllNumbers(null)).toBe(false);
    expect(isAllNumbers(undefined)).toBe(false);
  });
});

describe("parseTagPage", () => {
  // Updated to match new PIPA site structure (2025)
  const samplePassHtml = `
    <div class="check__image check__image--green">
        <div class="check__image-tag check__image-tag--green">Pass</div>
        <div class="check__image-border check__image-border--green"></div>
        <picture>
            <img src="https://hub.pipa.org.uk/content-files/50/431119/60/image.jpg" alt="Report" />
        </picture>
    </div>
    <div class="check__details">
        <div class="color--blue">Unit Reference No:</div>
        <div class="color--dark-blue">40000</div>
        <div class="color--blue">Type:</div>
        <div class="color--dark-blue">Bounce/Slide Combo</div>
        <div class="color--blue">Current Operator:</div>
        <div class="color--dark-blue">Test Operator</div>
        <div class="color--blue">Certificate Expiry Date:</div>
        <div class="color--dark-blue">03 November 2026</div>
    </div>
    <div class="y-spacer"></div>
    <a class="button" href="https://hub.pipa.org.uk/download/reports/certificate/abc123">View Certificate</a>
    <a class="button" href="https://hub.pipa.org.uk/public/reports/report/abc123">View Report</a>
    <a class="report report--green" href="https://hub.pipa.org.uk/public/reports/report/abc123" target="_blank">
      <div class="report__highlight"></div>
      <div class="report__left">
        <div class="report__date">
          <div class="report__label">Date:</div>
          <div class="report__value">04 November 2025</div>
        </div>
        <div class="report__number">
          <div class="report__label">Report No:</div>
          <div class="report__value">424365</div>
        </div>
      </div>
      <div class="report__center">
        <div class="report__company">
          <div class="report__label">Inspection Body:</div>
          <div class="report__value">Test Inspector Ltd</div>
        </div>
      </div>
      <div class="report__right">
        <div class="tag tag--small">Pass</div>
      </div>
    </a>
  `;

  test("parses a valid pass page correctly", () => {
    const result = parseTagPage(samplePassHtml, "40000");

    expect(result.found).toBe(true);
    expect(result.tagId).toBe("40000");
    expect(result.status).toBe("Pass");
    expect(result.statusClass).toBe("green");
    expect(result.unitReferenceNo).toBe("40000");
    expect(result.type).toBe("Bounce/Slide Combo");
    expect(result.currentOperator).toBe("Test Operator");
    expect(result.certificateExpiryDate).toBe("03 November 2026");
    expect(result.certificateUrl).toContain("hub.pipa.org.uk/download");
    expect(result.reportUrl).toContain("hub.pipa.org.uk/public/reports");
    expect(result.imageUrl).toContain("hub.pipa.org.uk/content-files");
    expect(result.fetchedAt).toBeDefined();
  });

  test("extracts annual reports", () => {
    const result = parseTagPage(samplePassHtml, "40000");

    expect(result.annualReports).toHaveLength(1);
    expect(result.annualReports[0].date).toBe("04 November 2025");
    expect(result.annualReports[0].reportNo).toBe("424365");
    expect(result.annualReports[0].inspectionBody).toBe("Test Inspector Ltd");
    expect(result.annualReports[0].status).toBe("Pass");
    expect(result.annualReports[0].statusClass).toBe("green");
  });

  test("returns found: false for invalid page", () => {
    const result = parseTagPage("<html><body>Not found</body></html>", "99999");

    expect(result.found).toBe(false);
    expect(result.tagId).toBe("99999");
  });
});

describe("getCachePath", () => {
  test("returns correct path with default cache dir", () => {
    expect(getCachePath("40000")).toBe("cache/pipa/40000.json");
  });

  test("returns correct path with custom cache dir", () => {
    expect(getCachePath("40000", "custom/cache")).toBe(
      "custom/cache/40000.json",
    );
  });
});

describe("cache operations", () => {
  const testCacheDir = "test-cache-temp";

  beforeEach(async () => {
    await mkdir(testCacheDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testCacheDir, { recursive: true, force: true });
  });

  test("writeCache creates file with correct content", async () => {
    const data = { found: true, tagId: "12345", status: "Pass" };
    await writeCache("12345", data, testCacheDir);

    const content = await readFile(`${testCacheDir}/12345.json`, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed.found).toBe(true);
    expect(parsed.tagId).toBe("12345");
    expect(parsed.status).toBe("Pass");
  });

  test("readCache returns cached data", async () => {
    const data = { found: true, tagId: "12345", status: "Pass" };
    await writeCache("12345", data, testCacheDir);

    const cached = await readCache("12345", testCacheDir);

    expect(cached).toEqual(data);
  });

  test("readCache returns null for non-existent file", async () => {
    const cached = await readCache("nonexistent", testCacheDir);

    expect(cached).toBeNull();
  });
});

describe("searchTag", () => {
  test("returns error for invalid tag ID", async () => {
    const result = await searchTag("abc");

    expect(result.found).toBe(false);
    expect(result.error).toContain("Invalid tag ID");
  });

  test("returns error for empty tag ID", async () => {
    const result = await searchTag("");

    expect(result.found).toBe(false);
    expect(result.error).toContain("Invalid tag ID");
  });

  test("returns not found for non-existent tag", async () => {
    const result = await searchTag("9999999999");

    expect(result.found).toBe(false);
    expect(result.error).toBe("Tag not found");
  });

  test("returns error when search API fails", async () => {
    const mockFetch = () => Promise.resolve({ ok: false, status: 500 });

    const result = await searchTag("12345", { fetcher: mockFetch });

    expect(result.found).toBe(false);
    expect(result.error).toBe("Search API error: 500");
  });

  test("returns error when tag page fails", async () => {
    let callCount = 0;
    const mockFetch = () => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ success: "true", message: "/tags/123/" }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    };

    const result = await searchTag("12345", { fetcher: mockFetch });

    expect(result.found).toBe(false);
    expect(result.error).toBe("Tag page error: 404");
  });
});

describe("searchTagWithCache", () => {
  const testCacheDir = "test-cache-temp-2";

  beforeEach(async () => {
    await mkdir(testCacheDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testCacheDir, { recursive: true, force: true });
  });

  test("returns cached data with fromCache flag", async () => {
    const data = { found: true, tagId: "12345", status: "Pass" };
    await writeCache("12345", data, testCacheDir);

    const result = await searchTagWithCache("12345", {
      cacheDir: testCacheDir,
    });

    expect(result.fromCache).toBe(true);
    expect(result.tagId).toBe("12345");
  });

  test("skips cache when useCache is false", async () => {
    const data = { found: true, tagId: "abc", status: "Pass" };
    await writeCache("abc", data, testCacheDir);

    // This will fail validation since "abc" is not all numbers
    const result = await searchTagWithCache("abc", {
      cacheDir: testCacheDir,
      useCache: false,
    });

    expect(result.fromCache).toBeUndefined();
    expect(result.found).toBe(false);
  });

  test("fetches details when cache exists but has no details", async () => {
    const sampleReportHtml = `
      <h1>Inspection Report 123-v1</h1>
      <div class="badge badge--green">Pass</div>
    `;
    const mockFetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "text/html"]]),
        text: () => Promise.resolve(sampleReportHtml),
      });

    // Cache data without details
    const data = {
      found: true,
      tagId: "12345",
      status: "Pass",
      annualReports: [
        { url: "https://hub.pipa.org.uk/public/reports/report/abc" },
      ],
    };
    await writeCache("12345", data, testCacheDir);

    const result = await searchTagWithCache("12345", {
      cacheDir: testCacheDir,
      fetcher: mockFetch,
    });

    expect(result.fromCache).toBe(false);
    expect(result.annualReports[0].details).toBeDefined();
    expect(result.annualReports[0].details.found).toBe(true);
  });

  test("returns cached data when details already present", async () => {
    const data = {
      found: true,
      tagId: "12345",
      status: "Pass",
      annualReports: [
        {
          url: "https://hub.pipa.org.uk/public/reports/report/abc",
          details: { found: true, reportId: "123" },
        },
      ],
    };
    await writeCache("12345", data, testCacheDir);

    const result = await searchTagWithCache("12345", {
      cacheDir: testCacheDir,
    });

    expect(result.fromCache).toBe(true);
    expect(result.annualReports[0].details.reportId).toBe("123");
  });

  test("returns cached data when no annual reports", async () => {
    const data = {
      found: true,
      tagId: "12345",
      status: "Pass",
      annualReports: [],
    };
    await writeCache("12345", data, testCacheDir);

    const result = await searchTagWithCache("12345", {
      cacheDir: testCacheDir,
    });

    expect(result.fromCache).toBe(true);
    expect(result.annualReports).toHaveLength(0);
  });

  test("fetches fresh data with details when no cache", async () => {
    const sampleTagHtml = `
      <div class="check__image-tag check__image-tag--green">Pass</div>
      <div class="check__details">
        <div class="color--blue">Unit Reference No:</div>
        <div class="color--dark-blue">12345</div>
      </div>
      <div class="y-spacer"></div>
      <a class="report report--green" href="https://hub.pipa.org.uk/public/reports/report/abc" target="_blank">
        <div class="report__date"><div class="report__value">01 Jan 2025</div></div>
        <div class="report__number"><div class="report__value">999</div></div>
        <div class="report__company"><div class="report__value">Test Co</div></div>
        <div class="tag tag--small">Pass</div>
      </a>
    `;
    const sampleReportHtml = `
      <h1>Inspection Report 999-v1</h1>
      <div class="badge badge--green">Pass</div>
    `;

    let callCount = 0;
    const mockFetch = (url) => {
      callCount += 1;
      // First call: search API
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ success: "true", message: "/tags/12345/" }),
        });
      }
      // Second call: tag page
      if (callCount === 2) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(sampleTagHtml),
        });
      }
      // Third call: report details
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "text/html"]]),
        text: () => Promise.resolve(sampleReportHtml),
      });
    };

    const result = await searchTagWithCache("12345", {
      cacheDir: testCacheDir,
      fetcher: mockFetch,
    });

    expect(result.found).toBe(true);
    expect(result.annualReports).toHaveLength(1);
    expect(result.annualReports[0].details).toBeDefined();
    expect(result.annualReports[0].details.found).toBe(true);
  });

  test("does not cache when tag not found", async () => {
    const mockFetch = () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: "false" }),
      });

    const result = await searchTagWithCache("99999", {
      cacheDir: testCacheDir,
      fetcher: mockFetch,
    });

    expect(result.found).toBe(false);

    // Verify nothing was cached
    const cached = await readCache("99999", testCacheDir);
    expect(cached).toBeNull();
  });

  test("fetches and caches fresh data for tag without reports", async () => {
    const sampleTagHtml = `
      <div class="check__image-tag check__image-tag--green">Pass</div>
      <div class="check__details">
        <div class="color--blue">Unit Reference No:</div>
        <div class="color--dark-blue">12345</div>
      </div>
      <div class="y-spacer"></div>
    `;

    let callCount = 0;
    const mockFetch = () => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ success: "true", message: "/tags/12345/" }),
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(sampleTagHtml),
      });
    };

    const result = await searchTagWithCache("12345", {
      cacheDir: testCacheDir,
      fetcher: mockFetch,
    });

    expect(result.found).toBe(true);
    expect(result.unitReferenceNo).toBe("12345");
    expect(result.annualReports).toHaveLength(0);

    // Verify it was cached
    const cached = await readCache("12345", testCacheDir);
    expect(cached).not.toBeNull();
    expect(cached.found).toBe(true);
  });
});

describe("fetchReportDetails", () => {
  const sampleReportHtml = `
    <h1>Inspection Report 123-v1</h1>
    <div class="badge badge--green">Pass</div>
    <div class="label">Tag No:</div>
    <div class="detail">40000</div>
  `;

  test("returns error when report has no URL", async () => {
    const result = await fetchReportDetails({ date: "2025-01-01" });

    expect(result.details).toBeNull();
    expect(result.detailsError).toBe("No report URL");
  });

  test("returns error when report is null", async () => {
    const result = await fetchReportDetails(null);

    expect(result.details).toBeNull();
    expect(result.detailsError).toBe("No report URL");
  });

  test("fetches and parses report details", async () => {
    const mockFetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "text/html"]]),
        text: () => Promise.resolve(sampleReportHtml),
      });

    const report = {
      url: "https://hub.pipa.org.uk/public/reports/report/abc",
      date: "04 Nov 2025",
    };
    const result = await fetchReportDetails(report, { fetcher: mockFetch });

    expect(result.date).toBe("04 Nov 2025");
    expect(result.details).toBeDefined();
    expect(result.details.found).toBe(true);
  });

  test("returns error when fetch fails", async () => {
    const mockFetch = () =>
      Promise.resolve({
        ok: false,
        status: 404,
      });

    const report = {
      url: "https://hub.pipa.org.uk/public/reports/report/abc",
    };
    const result = await fetchReportDetails(report, { fetcher: mockFetch });

    expect(result.details).toBeNull();
    expect(result.detailsError).toBe("Report fetch error: 404");
  });
});

describe("fetchAllReportDetails", () => {
  const sampleReportHtml = `
    <h1>Inspection Report 123-v1</h1>
    <div class="badge badge--green">Pass</div>
  `;

  test("returns unchanged data when not found", async () => {
    const tagData = { found: false, error: "Not found" };
    const result = await fetchAllReportDetails(tagData);

    expect(result).toEqual(tagData);
  });

  test("returns unchanged data when no annual reports", async () => {
    const tagData = { found: true, tagId: "40000", annualReports: [] };
    const result = await fetchAllReportDetails(tagData);

    expect(result).toEqual(tagData);
  });

  test("returns unchanged data when null", async () => {
    const result = await fetchAllReportDetails(null);

    expect(result).toBeNull();
  });

  test("fetches details for all annual reports", async () => {
    const mockFetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "text/html"]]),
        text: () => Promise.resolve(sampleReportHtml),
      });

    const tagData = {
      found: true,
      tagId: "40000",
      annualReports: [
        { url: "https://hub.pipa.org.uk/public/reports/report/abc" },
        { url: "https://hub.pipa.org.uk/public/reports/report/def" },
      ],
    };

    const result = await fetchAllReportDetails(tagData, { fetcher: mockFetch });

    expect(result.annualReports).toHaveLength(2);
    expect(result.annualReports[0].details).toBeDefined();
    expect(result.annualReports[1].details).toBeDefined();
  });
});

describe("fetchReport re-export", () => {
  test("fetchReport is exported from pipa-searcher", () => {
    expect(typeof fetchReport).toBe("function");
  });
});
