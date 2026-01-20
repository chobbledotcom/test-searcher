/**
 * Minimal PIPA Tag Search API Server
 * Usage: bun src/server.js
 */

import { searchTagWithCache } from "#src/pipa-searcher.js";

const PORT = process.env.PORT || 3000;

/**
 * Handle incoming requests
 * @param {Request} req - The incoming request
 * @returns {Promise<Response>} The response
 */
const handleRequest = async (req) => {
  const url = new URL(req.url);

  // GET /tag/:id - Search for a PIPA tag
  if (url.pathname.startsWith("/tag/")) {
    const tagId = url.pathname.slice(5);
    const result = await searchTagWithCache(tagId);
    return Response.json(result);
  }

  // Health check
  if (url.pathname === "/health") {
    return Response.json({ status: "ok" });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
};

/**
 * Start the server
 * @param {number} port - Port to listen on
 * @returns {object} Server instance
 */
export const startServer = (port = PORT) =>
  Bun.serve({
    port,
    fetch: handleRequest,
  });

export { handleRequest };
