import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let useFallback = false;

export interface LocalUserRecord {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  createdAt: string;
}

// In-memory + disk-persisted fallback store when PostgreSQL is not running
const memoryStore = {
  connected_accounts: new Map<string, Record<string, unknown>>(),
  scan_runs: new Map<string, Record<string, unknown>>(),
  resources: new Map<string, Record<string, unknown>>(),
  edges: new Map<string, Record<string, unknown>>(),
  audit_log: [] as Record<string, unknown>[],
  users: new Map<string, LocalUserRecord>(),
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "orbit-store.json");

// Load stored data from disk on startup
try {
  if (fs.existsSync(STORE_FILE)) {
    const raw = fs.readFileSync(STORE_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (data.connected_accounts) {
      for (const [k, v] of Object.entries(data.connected_accounts)) {
        memoryStore.connected_accounts.set(k, v as Record<string, unknown>);
      }
    }
    if (data.scan_runs) {
      for (const [k, v] of Object.entries(data.scan_runs)) {
        memoryStore.scan_runs.set(k, v as Record<string, unknown>);
      }
    }
    if (data.resources) {
      for (const [k, v] of Object.entries(data.resources)) {
        memoryStore.resources.set(k, v as Record<string, unknown>);
      }
    }
    if (data.edges) {
      for (const [k, v] of Object.entries(data.edges)) {
        memoryStore.edges.set(k, v as Record<string, unknown>);
      }
    }
    if (Array.isArray(data.audit_log)) {
      memoryStore.audit_log = data.audit_log;
    }
    if (data.users) {
      for (const [k, v] of Object.entries(data.users)) {
        memoryStore.users.set(k, v as LocalUserRecord);
      }
    }
    console.log(`[Store] Loaded ${memoryStore.connected_accounts.size} account(s), ${memoryStore.resources.size} resource(s), ${memoryStore.users.size} user(s) from persistent storage.`);
  }
} catch (e) {
  console.warn("[Store] Could not read existing store file:", e);
}

let saveTimeout: NodeJS.Timeout | null = null;
function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const serializable = {
        connected_accounts: Object.fromEntries(memoryStore.connected_accounts),
        scan_runs: Object.fromEntries(memoryStore.scan_runs),
        resources: Object.fromEntries(memoryStore.resources),
        edges: Object.fromEntries(memoryStore.edges),
        audit_log: memoryStore.audit_log,
        users: Object.fromEntries(memoryStore.users),
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(serializable, null, 2), "utf-8");
    } catch (e) {
      console.error("[Store] Failed to save store to disk:", e);
    }
  }, 100);
}

export function findLocalUser(username: string): LocalUserRecord | undefined {
  const norm = username.trim().toLowerCase();
  for (const user of memoryStore.users.values()) {
    if (user.username.toLowerCase() === norm || (user.email && user.email.toLowerCase() === norm)) {
      return user;
    }
  }
  return undefined;
}

export function saveLocalUser(user: LocalUserRecord): void {
  memoryStore.users.set(user.id, user);
  scheduleSave();
}

export function getLocalUsersList(): LocalUserRecord[] {
  return Array.from(memoryStore.users.values());
}

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env["DATABASE_URL"] ||
        "postgresql://orbit:orbit@localhost:5432/orbit",
      max: 10,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 2_000,
    });

    pool.on("error", () => {
      useFallback = true;
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  if (!useFallback) {
    try {
      return await getPool().query<T>(text, params);
    } catch (err) {
      console.warn("PostgreSQL connection offline. Switching to zero-config in-memory store for local mode.");
      useFallback = true;
    }
  }

  // Resilient In-Memory Fallback Processor
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Handle table creation / indexes (no-op in memory)
  if (lower.startsWith("create table") || lower.startsWith("create index")) {
    return { rows: [], command: "CREATE", rowCount: 0, oid: 0, fields: [] };
  }

  // Handle DELETE
  if (lower.startsWith("delete from edges")) {
    memoryStore.edges.clear();
    scheduleSave();
    return { rows: [], command: "DELETE", rowCount: 0, oid: 0, fields: [] };
  }
  if (lower.startsWith("delete from resources")) {
    if (params && params[0]) {
      for (const [k, v] of memoryStore.resources.entries()) {
        if (v["account_id"] === params[0]) memoryStore.resources.delete(k);
      }
    } else {
      memoryStore.resources.clear();
    }
    scheduleSave();
    return { rows: [], command: "DELETE", rowCount: 0, oid: 0, fields: [] };
  }
  if (lower.startsWith("delete from connected_accounts")) {
    if (params && params[0]) memoryStore.connected_accounts.delete(params[0] as string);
    scheduleSave();
    return { rows: [], command: "DELETE", rowCount: 1, oid: 0, fields: [] };
  }

  // Handle INSERT / UPSERT into connected_accounts
  if (lower.startsWith("insert into connected_accounts")) {
    const p = params || [];
    const acc = {
      id: p[0],
      alias: p[1],
      provider: p[2] || "aws",
      auth_method: p[3] || "access_key",
      encrypted_access_key_id: p[4],
      encrypted_secret_key: p[5],
      region: p[6] || "us-east-1",
      created_at: new Date(),
    };
    memoryStore.connected_accounts.set(p[0] as string, acc);
    scheduleSave();
    return { rows: [acc as unknown as T], command: "INSERT", rowCount: 1, oid: 0, fields: [] };
  }

  // Handle INSERT / UPSERT into scan_runs
  if (lower.startsWith("insert into scan_runs")) {
    const p = params || [];
    const scan = {
      id: p[0],
      account_id: p[1],
      region: p[2],
      status: p[3] || "completed",
      resource_count: p[4] || 0,
      errors: p[5] || "[]",
      started_at: new Date(),
      finished_at: new Date(),
    };
    memoryStore.scan_runs.set(p[0] as string, scan);
    scheduleSave();
    return { rows: [scan as unknown as T], command: "INSERT", rowCount: 1, oid: 0, fields: [] };
  }

  // Handle UPDATE scan_runs
  if (lower.startsWith("update scan_runs")) {
    const p = params || [];
    const scanId = p[3] as string;
    const scan = memoryStore.scan_runs.get(scanId) || {};
    scan["resource_count"] = p[0];
    scan["status"] = p[1];
    scan["errors"] = p[2];
    scan["finished_at"] = new Date();
    memoryStore.scan_runs.set(scanId, scan);
    scheduleSave();
    return { rows: [scan as unknown as T], command: "UPDATE", rowCount: 1, oid: 0, fields: [] };
  }

  // Handle INSERT / UPSERT into resources
  if (lower.startsWith("insert into resources")) {
    const p = params || [];
    const res = {
      id: p[0],
      provider: p[1],
      account_id: p[2],
      region: p[3],
      type: p[4],
      arn: p[5],
      name: p[6],
      tags: typeof p[7] === "string" ? JSON.parse(p[7]) : p[7],
      raw_config: typeof p[8] === "string" ? JSON.parse(p[8]) : p[8],
      status: p[9],
      last_seen_at: new Date(),
      scan_run_id: p[11],
    };
    memoryStore.resources.set(p[0] as string, res);
    scheduleSave();
    return { rows: [res as unknown as T], command: "INSERT", rowCount: 1, oid: 0, fields: [] };
  }

  // Handle INSERT / UPSERT into edges
  if (lower.startsWith("insert into edges")) {
    const p = params || [];
    const edge = {
      id: p[0],
      source_resource_id: p[1],
      target_resource_id: p[2],
      relationship_type: p[3],
      scan_run_id: p[4],
    };
    memoryStore.edges.set(p[0] as string, edge);
    scheduleSave();
    return { rows: [edge as unknown as T], command: "INSERT", rowCount: 1, oid: 0, fields: [] };
  }

  // Handle INSERT into audit_log
  if (lower.startsWith("insert into audit_log")) {
    const p = params || [];
    const entry = {
      account_id: p[0],
      service: p[1],
      action: p[2],
      region: p[3],
      duration_ms: p[4],
      success: p[5],
      error_message: p[6],
      timestamp: new Date(),
    };
    memoryStore.audit_log.push(entry);
    return { rows: [], command: "INSERT", rowCount: 1, oid: 0, fields: [] };
  }

  // Handle SELECT from connected_accounts
  if (lower.startsWith("select") && lower.includes("from connected_accounts")) {
    const rows = Array.from(memoryStore.connected_accounts.values());
    if (params && params[0]) {
      const filtered = rows.filter((r) => r["id"] === params[0]);
      return { rows: filtered as unknown as T[], command: "SELECT", rowCount: filtered.length, oid: 0, fields: [] };
    }
    return { rows: rows as unknown as T[], command: "SELECT", rowCount: rows.length, oid: 0, fields: [] };
  }

  // Handle SELECT from resources
  if (lower.startsWith("select") && lower.includes("from resources")) {
    const rows = Array.from(memoryStore.resources.values());
    if (params && params[0]) {
      const filtered = rows.filter((r) => r["id"] === params[0] || r["account_id"] === params[0]);
      return { rows: filtered as unknown as T[], command: "SELECT", rowCount: filtered.length, oid: 0, fields: [] };
    }
    return { rows: rows as unknown as T[], command: "SELECT", rowCount: rows.length, oid: 0, fields: [] };
  }

  // Handle SELECT from edges
  if (lower.startsWith("select") && lower.includes("from edges")) {
    const rows = Array.from(memoryStore.edges.values());
    return { rows: rows as unknown as T[], command: "SELECT", rowCount: rows.length, oid: 0, fields: [] };
  }

  // Handle SELECT from scan_runs
  if (lower.startsWith("select") && lower.includes("from scan_runs")) {
    const rows = Array.from(memoryStore.scan_runs.values());
    if (params && params[0]) {
      const filtered = rows.filter((r) => r["id"] === params[0] || r["account_id"] === params[0]);
      return { rows: filtered as unknown as T[], command: "SELECT", rowCount: filtered.length, oid: 0, fields: [] };
    }
    return { rows: rows as unknown as T[], command: "SELECT", rowCount: rows.length, oid: 0, fields: [] };
  }

  // Handle SELECT from audit_log
  if (lower.startsWith("select") && lower.includes("from audit_log")) {
    return { rows: memoryStore.audit_log as unknown as T[], command: "SELECT", rowCount: memoryStore.audit_log.length, oid: 0, fields: [] };
  }

  return { rows: [], command: "SELECT", rowCount: 0, oid: 0, fields: [] };
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
