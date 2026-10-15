import pino from "pino";
import { query } from "../db/client.js";

const logger = pino({ name: "audit" });

export interface AuditEntry {
  accountId: string;
  service: string;
  action: string;
  region: string;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * Log every AWS API call Orbit makes — visible to the user for auditing (§10).
 * This is both an in-memory log (pino) and a persistent DB record.
 */
export async function logAuditEntry(entry: AuditEntry): Promise<void> {
  // Structured log for immediate visibility
  if (entry.success) {
    logger.info(
      { service: entry.service, action: entry.action, region: entry.region, durationMs: entry.durationMs },
      `AWS API call: ${entry.service}:${entry.action}`
    );
  } else {
    logger.warn(
      { service: entry.service, action: entry.action, region: entry.region, error: entry.errorMessage },
      `AWS API call FAILED: ${entry.service}:${entry.action}`
    );
  }

  // Persist to DB for user-facing audit trail
  try {
    await query(
      `INSERT INTO audit_log (account_id, service, action, region, duration_ms, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.accountId,
        entry.service,
        entry.action,
        entry.region,
        entry.durationMs,
        entry.success,
        entry.errorMessage || null,
      ]
    );
  } catch (err) {
    // Don't let audit logging failures break the scan
    logger.error({ err }, "Failed to persist audit log entry");
  }
}
