import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startServer } from "#src/server.js";

describe("PIPA API Server", () => {
  let server;
  let baseUrl;

  beforeAll(() => {
    server = startServer(0); // Port 0 = random available port
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  test("GET / returns homepage with search form", async () => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("<title>PIPA Tag Search</title>");
    expect(html).toContain('select id="host"');
    expect(html).toContain("Please select");
    expect(html).toContain("pipa.org.uk");
    expect(html).toContain('input type="text" id="unitId"');
    expect(html).toContain("API Documentation");
  });

  test("GET /health returns ok status", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
  });

  test("GET /tag/:id with invalid tag returns error", async () => {
    const response = await fetch(`${baseUrl}/tag/abc`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.found).toBe(false);
    expect(data.error).toContain("Invalid tag ID");
  });

  test("GET /tag/:id with valid tag returns data", async () => {
    const response = await fetch(`${baseUrl}/tag/40000`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.found).toBe(true);
    expect(data.tagId).toBe("40000");
    expect(data.status).toBeDefined();
  });

  test("GET /unknown returns 404", async () => {
    const response = await fetch(`${baseUrl}/unknown`);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Not found");
  });
});
