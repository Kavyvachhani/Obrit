import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { findLocalUser, saveLocalUser, LocalUserRecord } from "../db/client.js";

// Server-side session secret (ephemeral or from environment)
const SESSION_SECRET =
  process.env["ORBIT_SESSION_SECRET"] ||
  process.env["CREDENTIAL_ENCRYPTION_KEY"] ||
  crypto.randomBytes(32).toString("hex");

// Default fallback admin password hash if not explicitly provided
let cachedPasswordHash: string | null = process.env["ADMIN_PASSWORD_HASH"] || null;

export function getAdminPasswordHash(): string {
  if (!cachedPasswordHash) {
    const rawDefault = process.env["ORBIT_ADMIN_PASSWORD"] || "orbit-admin";
    cachedPasswordHash = bcrypt.hashSync(rawDefault, 10);
  }
  return cachedPasswordHash;
}

export interface SessionUser {
  id: string;
  username: string;
  role: "admin" | "user" | "guest";
}

/**
 * Creates a signed session token using HMAC-SHA256
 */
export function createSessionToken(user: SessionUser = { id: "admin-1", username: "admin", role: "admin" }): string {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    ts: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a signed session token and returns decoded session user
 */
export function verifySessionToken(token: string | undefined): SessionUser | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    // Expire sessions after 7 days
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - payload.ts > maxAgeMs) {
      return null;
    }
    return {
      id: payload.id || "admin-1",
      username: payload.username || "admin",
      role: payload.role || "user",
    };
  } catch {
    return null;
  }
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/auth/register — Anyone can sign up (stores locally in orbit-store.json)
   */
  app.post<{ Body: { username?: string; password?: string; email?: string } }>(
    "/api/auth/register",
    async (request, reply) => {
      const { username, password, email } = request.body || {};

      if (!username || username.trim().length < 2) {
        return reply.status(400).send({ error: "Username must be at least 2 characters" });
      }
      if (!password || password.length < 4) {
        return reply.status(400).send({ error: "Password must be at least 4 characters" });
      }

      const existing = findLocalUser(username.trim());
      if (existing) {
        return reply.status(409).send({ error: "Username or email is already registered" });
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const newUser: LocalUserRecord = {
        id: `usr-${crypto.randomBytes(8).toString("hex")}`,
        username: username.trim(),
        email: email?.trim(),
        passwordHash,
        createdAt: new Date().toISOString(),
      };

      saveLocalUser(newUser);

      const sessionUser: SessionUser = {
        id: newUser.id,
        username: newUser.username,
        role: "user",
      };
      const token = createSessionToken(sessionUser);

      reply.setCookie("orbit_session", token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
      });

      return reply.send({
        success: true,
        authenticated: true,
        token,
        user: sessionUser,
        message: "Account created successfully",
      });
    }
  );

  /**
   * POST /api/auth/login — Sign in with registered local user OR default admin
   */
  app.post<{ Body: { username?: string; password?: string } }>("/api/auth/login", async (request, reply) => {
    const { username, password } = request.body || {};

    if (!password) {
      return reply.status(400).send({ error: "Password is required" });
    }

    let authenticatedUser: SessionUser | null = null;

    // 1. If username was provided, check local database
    if (username && username.trim()) {
      const localUser = findLocalUser(username.trim());
      if (localUser && bcrypt.compareSync(password, localUser.passwordHash)) {
        authenticatedUser = {
          id: localUser.id,
          username: localUser.username,
          role: "user",
        };
      }
    }

    // 2. Also check if password matches default admin password (or if username is 'admin')
    if (!authenticatedUser) {
      const adminHash = getAdminPasswordHash();
      if (bcrypt.compareSync(password, adminHash)) {
        authenticatedUser = {
          id: "admin-1",
          username: username?.trim() || "admin",
          role: "admin",
        };
      }
    }

    if (!authenticatedUser) {
      return reply.status(401).send({ error: "Invalid username or password" });
    }

    const token = createSessionToken(authenticatedUser);

    reply.setCookie("orbit_session", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({
      success: true,
      authenticated: true,
      token,
      user: authenticatedUser,
      message: "Authentication successful",
    });
  });

  /**
   * POST /api/auth/guest — Instant 1-click access for local dev
   */
  app.post("/api/auth/guest", async (_request, reply) => {
    const guestUser: SessionUser = {
      id: "guest-" + crypto.randomBytes(4).toString("hex"),
      username: "developer_guest",
      role: "guest",
    };
    const token = createSessionToken(guestUser);

    reply.setCookie("orbit_session", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({
      success: true,
      authenticated: true,
      token,
      user: guestUser,
      message: "Guest session started",
    });
  });

  /**
   * GET /api/auth/me — Check session status
   */
  app.get("/api/auth/me", async (request, reply) => {
    const cookieToken = request.cookies?.orbit_session;
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    const token = cookieToken || bearerToken;
    const sessionUser = verifySessionToken(token);

    return reply.send({
      authenticated: Boolean(sessionUser),
      user: sessionUser,
    });
  });

  /**
   * POST /api/auth/logout — Invalidate session
   */
  app.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie("orbit_session", { path: "/" });
    return reply.send({ success: true, authenticated: false });
  });
}
