import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import {
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
    <a class="report report--green" href="https://hub.pipa.org.uk/public/reports/report/abc123">
      <div class="report__date">
        <div class="report__label">Date:</div>
        <div class="report__value">04 November 2025</div>
      </div>
      <div>
        <div class="report__label">Inspector:</div>
        <div class="report__value">Test Inspector</div>
      </div>
      <div>
        <div class="report__label">Status:</div>
        <div class="report__value">Pass</div>
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
    expect(result.annualReports[0].inspector).toBe("Test Inspector");
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
});
