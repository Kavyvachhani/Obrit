import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { encrypt } from "../crypto/credentials.js";
import { query } from "../db/client.js";
import type { ConnectAccountRequest, ConnectedAccountSummary } from "@orbit/core";

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/accounts — Connect a new AWS account.
   * Encrypts credentials before storing. Never returns secrets.
   */
  app.post<{ Body: ConnectAccountRequest }>("/api/accounts", async (request, reply) => {
    const { alias, provider, region, accessKeyId, secretAccessKey } = request.body;

    // Validate required fields
    if (!alias || !region || !accessKeyId || !secretAccessKey) {
      return reply.status(400).send({
        error: "Missing required fields: alias, region, accessKeyId, secretAccessKey",
      });
    }

    // Validate access key format (basic check)
    if (!/^(AKIA|ASIA)[A-Z0-9]{16}$/.test(accessKeyId)) {
      return reply.status(400).send({
        error: "Invalid AWS Access Key ID format",
      });
    }

    const id = nanoid();
    const encryptedAccessKeyId = encrypt(accessKeyId);
    const encryptedSecretKey = encrypt(secretAccessKey);

    await query(
      `INSERT INTO connected_accounts (id, alias, provider, auth_method, encrypted_access_key_id, encrypted_secret_key, region)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, alias, provider || "aws", "access_key", encryptedAccessKeyId, encryptedSecretKey, region]
    );

    const summary: ConnectedAccountSummary = {
      id,
      alias,
      provider: provider || "aws",
      authMethod: "access_key",
      regions: [region],
      createdAt: new Date().toISOString(),
    };

    return reply.status(201).send(summary);
  });

  /**
   * GET /api/accounts — List connected accounts (no secrets).
   */
  app.get("/api/accounts", async (_request, reply) => {
    const result = await query<{
      id: string;
      alias: string;
      provider: string;
      auth_method: string;
      region: string;
      created_at: Date;
    }>("SELECT id, alias, provider, auth_method, region, created_at FROM connected_accounts ORDER BY created_at DESC");

    const accounts: ConnectedAccountSummary[] = result.rows.map((row) => ({
      id: row.id,
      alias: row.alias,
      provider: row.provider as "aws",
      authMethod: row.auth_method as "access_key" | "assume_role",
      regions: [row.region],
      createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    }));

    return reply.send(accounts);
  });

  /**
   * DELETE /api/accounts/:id — Disconnect an account and remove all its data.
   */
  app.delete<{ Params: { id: string } }>("/api/accounts/:id", async (request, reply) => {
    const { id } = request.params;

    // Delete in order: edges → resources → scan_runs → audit_log → account
    await query("DELETE FROM edges WHERE scan_run_id IN (SELECT id FROM scan_runs WHERE account_id = $1)", [id]);
    await query("DELETE FROM resources WHERE account_id = $1", [id]);
    await query("DELETE FROM scan_runs WHERE account_id = $1", [id]);
    await query("DELETE FROM audit_log WHERE account_id = $1", [id]);
    await query("DELETE FROM connected_accounts WHERE id = $1", [id]);

    return reply.status(204).send();
  });
}
