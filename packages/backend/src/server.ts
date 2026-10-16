import fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { runMigrations } from "./db/migrations.js";
import { accountRoutes } from "./routes/accounts.js";
import { scanRoutes } from "./routes/scan.js";
import { graphRoutes } from "./routes/graph.js";
import { resourceRoutes } from "./routes/resources.js";
import { demoRoutes } from "./routes/demo.js";

const PORT = parseInt(process.env["PORT"] || "4000", 10);
const HOST = process.env["HOST"] || "0.0.0.0";

export async function buildServer() {
  const app = fastify({
    logger: false,
  });

  // Security headers via Helmet with relaxed CSP for dev
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  // CORS for frontend dev server
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  });

  // Rate limiting (100 req/min per IP)
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });

  // Health check
  app.get("/api/health", async () => {
    return {
      status: "ok",
      service: "orbit-backend",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
    };
  });

  // Register domain routes
  await app.register(accountRoutes);
  await app.register(scanRoutes);
  await app.register(graphRoutes);
  await app.register(resourceRoutes);
  await app.register(demoRoutes);

  // Serve static frontend assets if built
  const fs = await import("fs");
  const path = await import("path");
  const url = await import("url");
  let dirname = process.cwd();
  if (typeof __dirname !== "undefined") {
    dirname = __dirname;
  } else {
    try {
      if (typeof import.meta !== "undefined" && (import.meta as any).url) {
        dirname = path.dirname(url.fileURLToPath((import.meta as any).url));
      }
    } catch {
      dirname = process.cwd();
    }
  }
  const candidateDirs = [
    path.resolve(process.cwd(), "packages/web/dist"),
    path.resolve(process.cwd(), "public"),
    path.resolve(process.cwd(), "dist/web"),
    path.resolve(dirname, "../../web/dist"),
    path.resolve(dirname, "./public"),
  ];

  let webDistDir: string | null = null;
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, "index.html"))) {
      webDistDir = dir;
      break;
    }
  }

  if (webDistDir) {
    const staticDir = webDistDir;
    app.setNotFoundHandler(async (request, reply) => {
      // If it's an API request, return 404 JSON
      if (request.url.startsWith("/api")) {
        return reply.status(404).send({ error: "API endpoint not found" });
      }

      // Try serving static asset file directly
      const relativePath = (request.url.split("?")[0] ?? "").replace(/^\//, "");
      const filePath = path.join(staticDir, relativePath);

      if (relativePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mimeTypes: Record<string, string> = {
          ".html": "text/html",
          ".js": "application/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".json": "application/json",
          ".woff2": "font/woff2",
        };
        reply.header("Content-Type", mimeTypes[ext] || "application/octet-stream");
        return reply.send(fs.createReadStream(filePath));
      }

      // Otherwise serve SPA index.html
      const indexPath = path.join(staticDir, "index.html");
      reply.header("Content-Type", "text/html");
      return reply.send(fs.createReadStream(indexPath));
    });
  }

  return app;
}

async function start() {
  try {
    // Run database migrations on startup if DB is configured
    try {
      await runMigrations();
      console.log("Database migrations applied successfully.");
    } catch (dbErr) {
      console.warn("DB migration warning (DB might be offline or starting up):", dbErr);
    }

    const app = await buildServer();
    await app.listen({ port: PORT, host: HOST });
    console.log(`Orbit Backend listening on http://${HOST}:${PORT}`);
  } catch (err) {
    console.error("Failed to start Orbit backend:", err);
    if (process.env["ORBIT_DESKTOP"] !== "true") {
      process.exit(1);
    }
  }
}

if (process.env["NODE_ENV"] !== "test") {
  start();
}
