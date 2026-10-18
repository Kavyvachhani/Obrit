import type { FastifyInstance } from "fastify";
import { runScan } from "../aws/scan-orchestrator.js";
import { query } from "../db/client.js";
import type { ScanRun } from "@orbit/core";

export async function scanRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/scan — Trigger a scan for a connected account.
   * Phase 1: synchronous — blocks until the scan completes (target < 60s).
   */
  app.post<{ Body: { accountId: string } }>("/api/scan", async (request, reply) => {
    const { accountId } = request.body;

    if (!accountId) {
      return reply.status(400).send({ error: "Missing accountId" });
    }

    // Verify account exists
    const accountResult = await query(
      "SELECT id FROM connected_accounts WHERE id = $1",
      [accountId]
    );
    if (accountResult.rows.length === 0) {
      return reply.status(404).send({ error: "Account not found" });
    }

    try {
      const scanRun = await runScan(accountId);
      return reply.send(scanRun);
    } catch (err) {
      return reply.status(500).send({
        error: "Scan failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  /**
   * GET /api/scan/:id — Get status of a scan run.
   */
  app.get<{ Params: { id: string } }>("/api/scan/:id", async (request, reply) => {
    const { id } = request.params;

    const result = await query<{
      id: string;
      account_id: string;
      region: string;
      started_at: Date;
      finished_at: Date | null;
      resource_count: number;
      status: string;
      errors: string;
      unplanned_services?: string;
    }>("SELECT * FROM scan_runs WHERE id = $1", [id]);

    const row = result.rows[0];
    if (!row) {
      return reply.status(404).send({ error: "Scan not found" });
    }

    const scanRun: ScanRun = {
      id: row.id,
      accountId: row.account_id,
      region: row.region,
      startedAt: row.started_at.toISOString(),
      finishedAt: row.finished_at?.toISOString(),
      resourceCount: row.resource_count,
      status: row.status as ScanRun["status"],
      errors: typeof row.errors === "string" ? JSON.parse(row.errors) : row.errors,
      unplannedServices:
        typeof row.unplanned_services === "string"
          ? JSON.parse(row.unplanned_services)
          : row.unplanned_services || [],
    };

    return reply.send(scanRun);
  });

  /**
   * GET /api/scan/latest/:accountId — Get the most recent scan for an account.
   */
  app.get<{ Params: { accountId: string } }>("/api/scan/latest/:accountId", async (request, reply) => {
    const { accountId } = request.params;

    const result = await query<{
      id: string;
      account_id: string;
      region: string;
      started_at: Date;
      finished_at: Date | null;
      resource_count: number;
      status: string;
      errors: string;
      unplanned_services?: string;
    }>(
      "SELECT * FROM scan_runs WHERE account_id = $1 ORDER BY started_at DESC LIMIT 1",
      [accountId]
    );

    const row = result.rows[0];
    if (!row) {
      return reply.status(404).send({ error: "No scans found for this account" });
    }

    const scanRun: ScanRun = {
      id: row.id,
      accountId: row.account_id,
      region: row.region,
      startedAt: row.started_at.toISOString(),
      finishedAt: row.finished_at?.toISOString(),
      resourceCount: row.resource_count,
      status: row.status as ScanRun["status"],
      errors: typeof row.errors === "string" ? JSON.parse(row.errors) : row.errors,
      unplannedServices:
        typeof row.unplanned_services === "string"
          ? JSON.parse(row.unplanned_services)
          : row.unplanned_services || [],
    };

    return reply.send(scanRun);
  });
}
