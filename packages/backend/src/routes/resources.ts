import type { FastifyInstance } from "fastify";
import { query } from "../db/client.js";
import type { Resource } from "@orbit/core";

export async function resourceRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/resources/:id — Get full resource detail including rawConfig and tags
   */
  app.get<{ Params: { id: string } }>("/api/resources/:id", async (request, reply) => {
    const { id } = request.params;

    const result = await query<{
      id: string;
      provider: string;
      account_id: string;
      region: string;
      type: string;
      arn: string;
      name: string;
      tags: Record<string, string>;
      raw_config: Record<string, unknown>;
      status: string;
      last_seen_at: Date;
    }>("SELECT * FROM resources WHERE id = $1", [id]);

    const row = result.rows[0];
    if (!row) {
      return reply.status(404).send({ error: "Resource not found" });
    }

    const resource: Resource = {
      id: row.id,
      provider: row.provider as "aws",
      accountId: row.account_id,
      region: row.region,
      type: row.type,
      arn: row.arn,
      name: row.name,
      tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags,
      rawConfig: typeof row.raw_config === "string" ? JSON.parse(row.raw_config) : row.raw_config,
      status: row.status as "healthy" | "degraded" | "unknown",
      lastSeenAt: row.last_seen_at.toISOString(),
    };

    return reply.send(resource);
  });

  /**
   * GET /api/audit — Get recent AWS API audit logs
   */
  app.get<{ Querystring: { accountId?: string; limit?: string } }>("/api/audit", async (request, reply) => {
    const { accountId, limit = "100" } = request.query;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);

    let sql = "SELECT * FROM audit_log";
    const params: unknown[] = [];

    if (accountId) {
      sql += " WHERE account_id = $1";
      params.push(accountId);
    }

    sql += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limitNum);

    const result = await query(sql, params);
    return reply.send(result.rows);
  });
}
