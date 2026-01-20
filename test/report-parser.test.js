import { describe, expect, test } from "bun:test";
import {
  extractDeviceInfo,
  extractDimensions,
  extractInspectionSections,
  extractIntroFields,
  extractNotes,
  extractReportDetails,
  extractUserLimits,
  fetchReport,
  parseReportPage,
} from "#src/report-parser.js";

// Sample report HTML fixture based on real PIPA report structure
const sampleReportHtml = `
<!DOCTYPE html>
<html>
<head><title>PIPA - Report</title></head>
<body>
    <table class="report-header">
        <tr>
            <td colspan="3">
                <h1>Inspection Report 431119-v1 </h1>
            </td>
        </tr>
    </table>

    <table width="100%">
        <tr>
            <td width="240px">
                <div class="label" style="margin: 8px 0;">ID:</div>
            </td>
            <td>
                <div class="detail" style="margin: 8px 0;">
                    431119-v1
                </div>
            </td>
        </tr>
        <tr>
            <td width="240px">
                <div class="label" style="margin: 8px 0;">Inspection Valid from:</div>
            </td>
            <td>
                <div class="detail" style="margin: 8px 0;">
                    04 November 2025
                </div>
            </td>
        </tr>
        <tr>
            <td width="240px">
                <div class="label" style="margin: 8px 0;">Expiry Date:</div>
            </td>
            <td>
                <div class="detail" style="margin: 8px 0;">
                    03 November 2026
                </div>
            </td>
        </tr>
        <tr>
            <td width="240px">
                <div class="label" style="margin: 8px 0;">Status:</div>
            </td>
            <td>
                <div class="badge badge--green" style="margin: 8px 0;">Pass</div>
            </td>
        </tr>
        <tr>
            <td width="240px">
                <div class="label" style="margin: 8px 0;">Inspection Body:</div>
            </td>
            <td>
                <div class="detail" style="margin: 8px 0;">Andy J Leisure Ltd</div>
            </td>
        </tr>
        <tr>
            <td width="240px">
                <div class="label" style="margin: 8px 0;">Tag No:</div>
            </td>
            <td>
                <div class="detail" style="margin: 8px 0;">40000</div>
            </td>
        </tr>
        <tr>
            <td width="240px">
                <div class="label" style="margin: 8px 0;">Device Type:</div>
            </td>
            <td>
                <div class="detail" style="margin: 8px 0;">Bounce/Slide Combo</div>
            </td>
        </tr>
        <tr>
            <td width="240px">
                <div class="label" style="margin: 8px 0;">Serial Number:</div>
            </td>
            <td>
                <div class="detail" style="margin: 8px 0;">P31206</div>
            </td>
        </tr>
        <td width="50%">
            <img style="width: 100%;" src="https://hub.pipa.org.uk/content-files/50/431119/60/image.jpg?width=620&amp;height=465" alt="" />
        </td>
    </table>

    <table class="table">
        <thead>
            <tr style="background-color: #007AFF;">
                <th colspan="4">Report Details</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="padding: 14px 20px;">
                    <div class="label">Creation Date:</div>
                </td>
                <td colspan="2">
                    <div class="detail">04/11/2025</div>
                </td>
                <td><div class="text">&nbsp;</div></td>
            </tr>
            <tr>
                <td style="padding: 14px 20px;">
                    <div class="label">Inspection Date:</div>
                </td>
                <td colspan="2">
                    <div class="detail">04/11/2025</div>
                </td>
                <td><div class="text">&nbsp;</div></td>
            </tr>
            <tr>
                <td style="padding: 14px 20px;">
                    <div class="label">Place of Inspection:</div>
                </td>
                <td colspan="2">
                    <div class="detail">Tarbock Green (AJL)</div>
                </td>
                <td><div class="text">&nbsp;</div></td>
            </tr>
            <tr>
                <td style="padding: 14px 20px;">
                    <div class="label">Inspector:</div>
                </td>
                <td colspan="2">
                    <div class="detail">4: Matthew Hardwick</div>
                </td>
                <td><div class="text">&nbsp;</div></td>
            </tr>
            <tr>
                <td style="padding: 14px 20px;">
                    <div class="label">Structure version:</div>
                </td>
                <td colspan="2">
                    <div class="detail">202505</div>
                </td>
                <td><div class="text">&nbsp;</div></td>
            </tr>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Tested for Indoor Use Only:</div>
                </td>
                <td colspan="2" valign="top" style="padding: 14px 20px 14px 0;">
                    <div class="detail">No</div>
                </td>
                <td><div class="text"></div></td>
            </tr>
        </tbody>
    </table>

    <table class="table">
        <thead>
            <tr style="background-color: #007AFF;">
                <th colspan="4">Device</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="padding: 14px 20px;">
                    <div class="label">PIPA Reference Number:</div>
                </td>
                <td colspan="2">
                    <div class="detail">40000</div>
                </td>
                <td><div class="text">&nbsp;</div></td>
            </tr>
            <tr>
                <td style="padding: 14px 20px;">
                    <div class="label">Tag Number:</div>
                </td>
                <td colspan="2">
                    <div class="detail">40000</div>
                </td>
                <td><div class="text">&nbsp;</div></td>
            </tr>
            <tr>
                <td style="padding: 14px 20px;">
                    <div class="label">Type:</div>
                </td>
                <td colspan="2">
                    <div class="detail">Bounce/Slide Combo</div>
                </td>
                <td><div class="text">&nbsp;</div></td>
            </tr>
            <tr>
                <td style="padding: 14px 20px;">
                    <div class="label">Name:</div>
                </td>
                <td colspan="2">
                    <div class="detail">BOX JUMP PARTY SLIDE</div>
                </td>
                <td><div class="text">&nbsp;</div></td>
            </tr>
            <tr>
                <td style="padding: 14px 20px;">
                    <div class="label">Manufacturer:</div>
                </td>
                <td colspan="2">
                    <div class="detail">Airquee Ltd</div>
                </td>
                <td><div class="text">&nbsp;</div></td>
            </tr>
            <tr>
                <td style="padding: 14px 20px;">
                    <div class="label">Serial Number:</div>
                </td>
                <td colspan="2">
                    <div class="detail">P31206</div>
                </td>
                <td><div class="text">&nbsp;</div></td>
            </tr>
            <tr>
                <td style="padding: 14px 20px;">
                    <div class="label">Date Manufactured:</div>
                </td>
                <td colspan="2">
                    <div class="detail">Unknown</div>
                </td>
                <td><div class="text">&nbsp;</div></td>
            </tr>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Is the manufacturer's operation manual present?:</div>
                </td>
                <td width="120px" valign="top" style="padding: 14px 20px 14px 0;">
                    <div class="badge badge--green">Pass</div>
                </td>
                <td width="310px" valign="top"><div class="detail"></div></td>
                <td><div class="text"></div></td>
            </tr>
        </tbody>
    </table>

    <table class="table">
        <thead>
            <tr style="background-color: #007AFF;">
                <th colspan="4">Structure</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Length:</div>
                </td>
                <td colspan="2" valign="top">
                    <div class="detail">5.5m</div>
                </td>
                <td><div class="text"></div></td>
            </tr>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Width:</div>
                </td>
                <td colspan="2" valign="top">
                    <div class="detail">3.9m</div>
                </td>
                <td><div class="text"></div></td>
            </tr>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Height:</div>
                </td>
                <td colspan="2" valign="top">
                    <div class="detail">3m</div>
                </td>
                <td><div class="text"></div></td>
            </tr>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Trough Depth:</div>
                </td>
                <td width="120px" valign="top">
                    <div class="badge badge--green">Pass</div>
                </td>
                <td width="310px" valign="top">
                    <div class="detail">0.15m</div>
                </td>
                <td><div class="text">10/45s 16/53</div></td>
            </tr>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Seam Security:</div>
                </td>
                <td width="120px" valign="top">
                    <div class="badge badge--green">Pass</div>
                </td>
                <td width="310px" valign="top">
                    <div class="detail"></div>
                </td>
                <td><div class="text"></div></td>
            </tr>
        </tbody>
    </table>

    <table class="table">
        <thead>
            <tr style="background-color: #007AFF;">
                <th colspan="4">Materials</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Fabric Material and Condition:</div>
                </td>
                <td width="120px" valign="top">
                    <div class="badge badge--green">Pass</div>
                </td>
                <td width="310px" valign="top">
                    <div class="detail"></div>
                </td>
                <td><div class="text"></div></td>
            </tr>
        </tbody>
    </table>

    <table class="table">
        <thead>
            <tr style="background-color: #007AFF;">
                <th colspan="4">Users</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Max Number of Users of Height up to 1.0m:</div>
                </td>
                <td colspan="2" valign="top">
                    <div class="detail">7</div>
                </td>
                <td><div class="text"></div></td>
            </tr>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Max Number of Users of Height up to 1.2m:</div>
                </td>
                <td colspan="2" valign="top">
                    <div class="detail">6</div>
                </td>
                <td><div class="text"></div></td>
            </tr>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Max Number of Users of Height up to 1.5m:</div>
                </td>
                <td colspan="2" valign="top">
                    <div class="detail">5</div>
                </td>
                <td><div class="text"></div></td>
            </tr>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Max Number of Users of Height up to 1.8m:</div>
                </td>
                <td colspan="2" valign="top">
                    <div class="detail">4</div>
                </td>
                <td><div class="text"></div></td>
            </tr>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Custom Max User Height:</div>
                </td>
                <td colspan="2" valign="top">
                    <div class="detail">2.0m</div>
                </td>
                <td><div class="text"></div></td>
            </tr>
        </tbody>
    </table>

    <table class="table">
        <thead>
            <tr style="background-color: #007AFF;">
                <th colspan="4">Notes</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Additional Notes:</div>
                </td>
                <td colspan="2" valign="top">
                    <div class="detail">PLEASE USE MATS&#xA;ALWAYS USE ANCHORS</div>
                </td>
                <td><div class="text"></div></td>
            </tr>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Risk Assessment Notes:</div>
                </td>
                <td colspan="2" valign="top">
                    <div class="detail">Check daily</div>
                </td>
                <td><div class="text"></div></td>
            </tr>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Repairs needed to pass inspection:</div>
                </td>
                <td colspan="2" valign="top">
                    <div class="detail">None</div>
                </td>
                <td><div class="text"></div></td>
            </tr>
            <tr>
                <td width="260px" style="padding: 14px 20px;" valign="top">
                    <div class="label">Advisory items :</div>
                </td>
                <td colspan="2" valign="top">
                    <div class="detail">Monitor seams</div>
                </td>
                <td><div class="text"></div></td>
            </tr>
        </tbody>
    </table>
</body>
</html>
`;

describe("extractIntroFields", () => {
  test("extracts report ID from header", () => {
    const result = extractIntroFields(sampleReportHtml);
    expect(result.reportId).toBe("431119-v1");
  });

  test("extracts ID from intro table", () => {
    const result = extractIntroFields(sampleReportHtml);
    expect(result.id).toBe("431119-v1");
  });

  test("extracts validity dates", () => {
    const result = extractIntroFields(sampleReportHtml);
    expect(result.validFrom).toBe("04 November 2025");
    expect(result.expiryDate).toBe("03 November 2026");
  });

  test("extracts status with class", () => {
    const result = extractIntroFields(sampleReportHtml);
    expect(result.status).toBe("Pass");
    expect(result.statusClass).toBe("green");
  });

  test("extracts inspection body", () => {
    const result = extractIntroFields(sampleReportHtml);
    expect(result.inspectionBody).toBe("Andy J Leisure Ltd");
  });

  test("extracts tag number", () => {
    const result = extractIntroFields(sampleReportHtml);
    expect(result.tagNo).toBe("40000");
  });

  test("extracts device type", () => {
    const result = extractIntroFields(sampleReportHtml);
    expect(result.deviceType).toBe("Bounce/Slide Combo");
  });

  test("extracts serial number", () => {
    const result = extractIntroFields(sampleReportHtml);
    expect(result.serialNumber).toBe("P31206");
  });

  test("extracts image URL", () => {
    const result = extractIntroFields(sampleReportHtml);
    expect(result.imageUrl).toContain("hub.pipa.org.uk/content-files");
    expect(result.imageUrl).not.toContain("&amp;");
  });

  test("returns empty object for invalid HTML", () => {
    const result = extractIntroFields("<html><body>Not a report</body></html>");
    expect(Object.keys(result).length).toBe(0);
  });

  test("handles badge with invalid class format", () => {
    const html = `
      <table>
        <tr>
          <td><div class="label">Status:</div></td>
          <td><div class="badge">Pass</div></td>
        </tr>
      </table>
    `;
    const result = extractIntroFields(html);
    expect(result.status).toBeUndefined();
    expect(result.statusClass).toBeUndefined();
  });
});

describe("extractReportDetails", () => {
  test("extracts creation date", () => {
    const result = extractReportDetails(sampleReportHtml);
    expect(result.creationDate).toBe("04/11/2025");
  });

  test("extracts inspection date", () => {
    const result = extractReportDetails(sampleReportHtml);
    expect(result.inspectionDate).toBe("04/11/2025");
  });

  test("extracts place of inspection", () => {
    const result = extractReportDetails(sampleReportHtml);
    expect(result.placeOfInspection).toBe("Tarbock Green (AJL)");
  });

  test("extracts inspector name", () => {
    const result = extractReportDetails(sampleReportHtml);
    expect(result.inspector).toBe("4: Matthew Hardwick");
  });

  test("extracts structure version", () => {
    const result = extractReportDetails(sampleReportHtml);
    expect(result.structureVersion).toBe("202505");
  });

  test("extracts indoor use only flag", () => {
    const result = extractReportDetails(sampleReportHtml);
    expect(result.indoorUseOnly).toBe("No");
  });

  test("returns empty object for invalid HTML", () => {
    const result = extractReportDetails(
      "<html><body>Not a report</body></html>",
    );
    expect(Object.keys(result).length).toBe(0);
  });
});

describe("extractDeviceInfo", () => {
  test("extracts PIPA reference number", () => {
    const result = extractDeviceInfo(sampleReportHtml);
    expect(result.pipaReferenceNumber).toBe("40000");
  });

  test("extracts tag number", () => {
    const result = extractDeviceInfo(sampleReportHtml);
    expect(result.tagNumber).toBe("40000");
  });

  test("extracts device type", () => {
    const result = extractDeviceInfo(sampleReportHtml);
    expect(result.type).toBe("Bounce/Slide Combo");
  });

  test("extracts device name", () => {
    const result = extractDeviceInfo(sampleReportHtml);
    expect(result.name).toBe("BOX JUMP PARTY SLIDE");
  });

  test("extracts manufacturer", () => {
    const result = extractDeviceInfo(sampleReportHtml);
    expect(result.manufacturer).toBe("Airquee Ltd");
  });

  test("extracts serial number", () => {
    const result = extractDeviceInfo(sampleReportHtml);
    expect(result.deviceSerialNumber).toBe("P31206");
  });

  test("extracts date manufactured", () => {
    const result = extractDeviceInfo(sampleReportHtml);
    expect(result.dateManufactured).toBe("Unknown");
  });

  test("extracts operation manual status", () => {
    const result = extractDeviceInfo(sampleReportHtml);
    expect(result.operationManualPresent).toEqual({
      statusClass: "green",
      status: "Pass",
    });
  });

  test("returns empty object for invalid HTML", () => {
    const result = extractDeviceInfo("<html><body>Not a report</body></html>");
    expect(Object.keys(result).length).toBe(0);
  });

  test("handles Device header outside of table element", () => {
    // Edge case: "Device" th with colspan but not inside a table
    const html = `
      <div>
        <th colspan="4">Device</th>
      </div>
      <table>
        <tr>
          <td><div class="label">PIPA Reference Number:</div></td>
          <td><div class="detail">12345</div></td>
        </tr>
      </table>
    `;
    const result = extractDeviceInfo(html);
    // Should fall back to root search and find the field
    expect(result.pipaReferenceNumber).toBe("12345");
  });
});

describe("extractDimensions", () => {
  test("extracts length", () => {
    const result = extractDimensions(sampleReportHtml);
    expect(result.length).toBe("5.5m");
  });

  test("extracts width", () => {
    const result = extractDimensions(sampleReportHtml);
    expect(result.width).toBe("3.9m");
  });

  test("extracts height", () => {
    const result = extractDimensions(sampleReportHtml);
    expect(result.height).toBe("3m");
  });

  test("returns empty object for invalid HTML", () => {
    const result = extractDimensions("<html><body>Not a report</body></html>");
    expect(Object.keys(result).length).toBe(0);
  });
});

describe("extractUserLimits", () => {
  test("extracts user limits by height", () => {
    const result = extractUserLimits(sampleReportHtml);
    expect(result.upTo1_0m).toBe(7);
    expect(result.upTo1_2m).toBe(6);
    expect(result.upTo1_5m).toBe(5);
    expect(result.upTo1_8m).toBe(4);
  });

  test("extracts custom max height", () => {
    const result = extractUserLimits(sampleReportHtml);
    expect(result.customMaxHeight).toBe("2.0m");
  });

  test("returns empty object for invalid HTML", () => {
    const result = extractUserLimits("<html><body>Not a report</body></html>");
    expect(Object.keys(result).length).toBe(0);
  });
});

describe("extractNotes", () => {
  test("extracts additional notes with newline conversion", () => {
    const result = extractNotes(sampleReportHtml);
    expect(result.additionalNotes).toContain("PLEASE USE MATS");
    expect(result.additionalNotes).toContain("\n");
  });

  test("extracts risk assessment notes", () => {
    const result = extractNotes(sampleReportHtml);
    expect(result.riskAssessmentNotes).toBe("Check daily");
  });

  test("extracts repairs needed", () => {
    const result = extractNotes(sampleReportHtml);
    expect(result.repairsNeeded).toBe("None");
  });

  test("extracts advisory items", () => {
    const result = extractNotes(sampleReportHtml);
    expect(result.advisoryItems).toBe("Monitor seams");
  });

  test("returns empty object for invalid HTML", () => {
    const result = extractNotes("<html><body>Not a report</body></html>");
    expect(Object.keys(result).length).toBe(0);
  });
});

describe("extractInspectionSections", () => {
  test("extracts structure section with fields", () => {
    const result = extractInspectionSections(sampleReportHtml);
    expect(result.structure).toBeDefined();
    expect(result.structure.length).toBeGreaterThan(0);
  });

  test("extracts field with status badge", () => {
    const result = extractInspectionSections(sampleReportHtml);
    const troughDepth = result.structure.find(
      (f) => f.label === "Trough Depth",
    );
    expect(troughDepth).toBeDefined();
    expect(troughDepth.status).toBe("Pass");
    expect(troughDepth.statusClass).toBe("green");
    expect(troughDepth.value).toBe("0.15m");
    expect(troughDepth.notes).toBe("10/45s 16/53");
  });

  test("extracts materials section", () => {
    const result = extractInspectionSections(sampleReportHtml);
    expect(result.materials).toBeDefined();
    expect(result.materials.length).toBeGreaterThan(0);
  });

  test("excludes Report Details and Device sections", () => {
    const result = extractInspectionSections(sampleReportHtml);
    expect(result.reportDetails).toBeUndefined();
    expect(result.device).toBeUndefined();
  });

  test("returns empty object for invalid HTML", () => {
    const result = extractInspectionSections(
      "<html><body>Not a report</body></html>",
    );
    expect(Object.keys(result).length).toBe(0);
  });

  test("converts multi-word section names to camelCase", () => {
    const html = `
      <table class="table">
        <thead>
          <tr><th colspan="4">Area & surround</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><div class="label">Play Area m²:</div></td>
            <td><div class="detail">25</div></td>
            <td><div class="text"></div></td>
          </tr>
        </tbody>
      </table>
    `;
    const result = extractInspectionSections(html);
    expect(result.areaSurround).toBeDefined();
    expect(result.areaSurround[0].label).toBe("Play Area m²");
  });

  test("handles th[colspan] outside of table element", () => {
    // Edge case: th with colspan but not inside a table (malformed HTML)
    const html = `
      <div>
        <th colspan="4">Orphan Header</th>
      </div>
      <table class="table">
        <thead>
          <tr><th colspan="4">Valid Section</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><div class="label">Test Field:</div></td>
            <td><div class="detail">Value</div></td>
          </tr>
        </tbody>
      </table>
    `;
    const result = extractInspectionSections(html);
    // Should skip the orphan th and still find the valid section
    expect(result.validSection).toBeDefined();
    expect(result.orphanHeader).toBeUndefined();
  });
});

describe("parseReportPage", () => {
  test("parses complete report successfully", () => {
    const result = parseReportPage(sampleReportHtml);

    expect(result.found).toBe(true);
    expect(result.id).toBe("431119-v1");
    expect(result.status).toBe("Pass");
    expect(result.tagNo).toBe("40000");
    expect(result.fetchedAt).toBeDefined();
  });

  test("includes all sections", () => {
    const result = parseReportPage(sampleReportHtml);

    expect(result.reportDetails).toBeDefined();
    expect(result.device).toBeDefined();
    expect(result.dimensions).toBeDefined();
    expect(result.userLimits).toBeDefined();
    expect(result.notes).toBeDefined();
    expect(result.inspectionSections).toBeDefined();
  });

  test("returns found: false for non-report page", () => {
    const result = parseReportPage("<html><body>Not a report</body></html>");
    expect(result.found).toBe(false);
  });

  test("returns found: false for empty HTML", () => {
    const result = parseReportPage("");
    expect(result.found).toBe(false);
  });
});

describe("fetchReport", () => {
  test("returns error for invalid URL", async () => {
    const result = await fetchReport("https://example.com/report");
    expect(result.found).toBe(false);
    expect(result.error).toBe("Invalid report URL");
  });

  test("returns error for null URL", async () => {
    const result = await fetchReport(null);
    expect(result.found).toBe(false);
    expect(result.error).toBe("Invalid report URL");
  });

  test("returns error for empty URL", async () => {
    const result = await fetchReport("");
    expect(result.found).toBe(false);
    expect(result.error).toBe("Invalid report URL");
  });

  test("handles redirect as PDF", async () => {
    const mockFetch = () =>
      Promise.resolve({
        status: 301,
        headers: new Map([
          ["location", "https://hub.pipa.org.uk/download/file.pdf"],
        ]),
      });

    const result = await fetchReport(
      "https://hub.pipa.org.uk/public/reports/report/abc",
      {
        fetcher: mockFetch,
      },
    );

    expect(result.found).toBe(false);
    expect(result.isPdf).toBe(true);
    expect(result.redirectUrl).toBe(
      "https://hub.pipa.org.uk/download/file.pdf",
    );
  });

  test("handles HTTP error", async () => {
    const mockFetch = () =>
      Promise.resolve({
        ok: false,
        status: 404,
      });

    const result = await fetchReport(
      "https://hub.pipa.org.uk/public/reports/report/abc",
      {
        fetcher: mockFetch,
      },
    );

    expect(result.found).toBe(false);
    expect(result.error).toBe("Report fetch error: 404");
  });

  test("handles PDF content type", async () => {
    const mockFetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "application/pdf"]]),
      });

    const result = await fetchReport(
      "https://hub.pipa.org.uk/public/reports/report/abc",
      {
        fetcher: mockFetch,
      },
    );

    expect(result.found).toBe(false);
    expect(result.isPdf).toBe(true);
  });

  test("parses valid HTML response", async () => {
    const mockFetch = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "text/html"]]),
        text: () => Promise.resolve(sampleReportHtml),
      });

    const result = await fetchReport(
      "https://hub.pipa.org.uk/public/reports/report/abc",
      {
        fetcher: mockFetch,
      },
    );

    expect(result.found).toBe(true);
    expect(result.id).toBe("431119-v1");
  });
});
