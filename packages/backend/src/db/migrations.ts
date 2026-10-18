import { query } from "./client.js";

/**
 * Run all database migrations.
 * In Phase 1, we use a simple sequential approach — no migration framework.
 */
export async function runMigrations(): Promise<void> {
  // Create tables if they don't exist
  await query(`
    CREATE TABLE IF NOT EXISTS connected_accounts (
      id              TEXT PRIMARY KEY,
      alias           TEXT NOT NULL,
      provider        TEXT NOT NULL DEFAULT 'aws',
      auth_method     TEXT NOT NULL DEFAULT 'access_key',
      encrypted_access_key_id   TEXT,
      encrypted_secret_key      TEXT,
      external_id     TEXT,
      region          TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS scan_runs (
      id              TEXT PRIMARY KEY,
      account_id      TEXT NOT NULL REFERENCES connected_accounts(id),
      region          TEXT NOT NULL,
      started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at     TIMESTAMPTZ,
      resource_count  INTEGER NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'running',
      errors          JSONB NOT NULL DEFAULT '[]'::jsonb,
      unplanned_services JSONB NOT NULL DEFAULT '[]'::jsonb
    );
  `);

  await query(`
    ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS unplanned_services JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS resources (
      id              TEXT PRIMARY KEY,
      provider        TEXT NOT NULL DEFAULT 'aws',
      account_id      TEXT NOT NULL,
      region          TEXT NOT NULL,
      type            TEXT NOT NULL,
      arn             TEXT NOT NULL,
      name            TEXT NOT NULL DEFAULT '',
      tags            JSONB NOT NULL DEFAULT '{}'::jsonb,
      raw_config      JSONB NOT NULL DEFAULT '{}'::jsonb,
      status          TEXT NOT NULL DEFAULT 'unknown',
      last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      scan_run_id     TEXT REFERENCES scan_runs(id),
      UNIQUE(arn)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS edges (
      id                    TEXT PRIMARY KEY,
      source_resource_id    TEXT NOT NULL,
      target_resource_id    TEXT NOT NULL,
      relationship_type     TEXT NOT NULL,
      scan_run_id           TEXT REFERENCES scan_runs(id),
      UNIQUE(source_resource_id, target_resource_id, relationship_type)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id              SERIAL PRIMARY KEY,
      account_id      TEXT NOT NULL,
      service         TEXT NOT NULL,
      action          TEXT NOT NULL,
      region          TEXT NOT NULL,
      timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms     INTEGER,
      success         BOOLEAN NOT NULL DEFAULT true,
      error_message   TEXT
    );
  `);

  // Indexes for common query patterns
  await query(`CREATE INDEX IF NOT EXISTS idx_resources_account ON resources(account_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_resources_arn ON resources(arn);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_resource_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_resource_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_scan_runs_account ON scan_runs(account_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_log_account ON audit_log(account_id);`);
}
