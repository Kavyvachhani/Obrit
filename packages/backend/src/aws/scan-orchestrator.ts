import { EC2Client } from "@aws-sdk/client-ec2";
import { ElasticLoadBalancingV2Client } from "@aws-sdk/client-elastic-load-balancing-v2";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { RDSClient } from "@aws-sdk/client-rds";
import { S3Client } from "@aws-sdk/client-s3";
import { IAMClient } from "@aws-sdk/client-iam";
import type { Resource, Edge, ScanRun, ScanError } from "@orbit/core";
import { nanoid } from "nanoid";
import pino from "pino";
import { query } from "../db/client.js";
import { decrypt } from "../crypto/credentials.js";
import { discoverEc2 } from "./discovery/ec2.js";
import { discoverElb } from "./discovery/elb.js";
import { discoverLambda } from "./discovery/lambda.js";
import { discoverRds } from "./discovery/rds.js";
import { discoverS3 } from "./discovery/s3.js";
import { discoverIam } from "./discovery/iam.js";

const logger = pino({ name: "scan-orchestrator" });

interface AccountCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

/**
 * Decrypt and retrieve credentials for a connected account.
 * The decrypted values are held in memory only — never logged, never returned to frontend.
 */
async function getCredentials(accountId: string): Promise<AccountCredentials> {
  const result = await query<{
    encrypted_access_key_id: string;
    encrypted_secret_key: string;
    region: string;
  }>(
    "SELECT encrypted_access_key_id, encrypted_secret_key, region FROM connected_accounts WHERE id = $1",
    [accountId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Account ${accountId} not found`);
  }

  return {
    accessKeyId: decrypt(row.encrypted_access_key_id),
    secretAccessKey: decrypt(row.encrypted_secret_key),
    region: row.region,
  };
}

/**
 * Create AWS SDK clients with the provided credentials.
 * Each client is configured for the specified region with the account's creds.
 */
function createClients(creds: AccountCredentials) {
  const config = {
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
  };

  return {
    ec2: new EC2Client(config),
    elb: new ElasticLoadBalancingV2Client(config),
    lambda: new LambdaClient(config),
    rds: new RDSClient(config),
    s3: new S3Client(config),
    iam: new IAMClient({ ...config, region: "us-east-1" }), // IAM is global
  };
}

/**
 * Run a full discovery scan for a connected account.
 * Returns the scan run record once complete.
 */
export async function runScan(accountId: string): Promise<ScanRun> {
  const scanId = nanoid();
  const creds = await getCredentials(accountId);
  const clients = createClients(creds);
  const errors: ScanError[] = [];
  const allResources: Resource[] = [];
  const allEdges: Edge[] = [];

  // Create scan run record
  await query(
    "INSERT INTO scan_runs (id, account_id, region, status) VALUES ($1, $2, $3, $4)",
    [scanId, accountId, creds.region, "running"]
  );

  logger.info({ scanId, accountId, region: creds.region }, "Starting scan");

  // ─── Run all discovery modules ──────────────────────────────────────────
  const discoveries = [
    { name: "ec2", fn: () => discoverEc2(clients.ec2, accountId, creds.region) },
    { name: "elb", fn: () => discoverElb(clients.elb, accountId, creds.region) },
    { name: "lambda", fn: () => discoverLambda(clients.lambda, accountId, creds.region) },
    { name: "rds", fn: () => discoverRds(clients.rds, accountId, creds.region) },
    { name: "s3", fn: () => discoverS3(clients.s3, accountId, creds.region) },
    { name: "iam", fn: () => discoverIam(clients.iam, accountId) },
  ];

  // Run discoveries sequentially to respect rate limits
  for (const disc of discoveries) {
    try {
      logger.info({ scanId, service: disc.name }, `Discovering ${disc.name}...`);
      const result = await disc.fn();
      allResources.push(...result.resources);
      if ("edges" in result && Array.isArray((result as { edges?: Edge[] }).edges)) {
        allEdges.push(...((result as { edges: Edge[] }).edges));
      }
      logger.info(
        { scanId, service: disc.name, resources: result.resources.length },
        `${disc.name} discovery complete`
      );
    } catch (err) {
      const error: ScanError = {
        service: disc.name,
        code: (err as { name?: string })?.name ?? "UnknownError",
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      };
      errors.push(error);
      logger.error({ scanId, service: disc.name, err }, `${disc.name} discovery failed`);
    }
  }

  // ─── Persist resources (upsert on ARN) ──────────────────────────────────
  for (const resource of allResources) {
    await query(
      `INSERT INTO resources (id, provider, account_id, region, type, arn, name, tags, raw_config, status, last_seen_at, scan_run_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (arn) DO UPDATE SET
         name = EXCLUDED.name,
         tags = EXCLUDED.tags,
         raw_config = EXCLUDED.raw_config,
         status = EXCLUDED.status,
         last_seen_at = EXCLUDED.last_seen_at,
         scan_run_id = EXCLUDED.scan_run_id`,
      [
        resource.id,
        resource.provider,
        resource.accountId,
        resource.region,
        resource.type,
        resource.arn,
        resource.name,
        JSON.stringify(resource.tags),
        JSON.stringify(resource.rawConfig),
        resource.status,
        resource.lastSeenAt,
        scanId,
      ]
    );
  }

  // ─── Persist edges (upsert on composite key) ───────────────────────────
  // First, clear old edges for this account
  await query(
    "DELETE FROM edges WHERE scan_run_id IN (SELECT id FROM scan_runs WHERE account_id = $1 AND id != $2)",
    [accountId, scanId]
  );

  for (const edge of allEdges) {
    await query(
      `INSERT INTO edges (id, source_resource_id, target_resource_id, relationship_type, scan_run_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_resource_id, target_resource_id, relationship_type) DO UPDATE SET
         scan_run_id = EXCLUDED.scan_run_id`,
      [edge.id, edge.sourceResourceId, edge.targetResourceId, edge.relationshipType, scanId]
    );
  }

  // ─── Finalize scan run ──────────────────────────────────────────────────
  const status = errors.length > 0 ? (allResources.length > 0 ? "partial" : "failed") : "completed";

  await query(
    `UPDATE scan_runs SET
       finished_at = NOW(),
       resource_count = $1,
       status = $2,
       errors = $3
     WHERE id = $4`,
    [allResources.length, status, JSON.stringify(errors), scanId]
  );

  logger.info(
    { scanId, resources: allResources.length, edges: allEdges.length, errors: errors.length, status },
    "Scan complete"
  );

  const scanRun: ScanRun = {
    id: scanId,
    accountId,
    region: creds.region,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    resourceCount: allResources.length,
    status,
    errors,
  };

  return scanRun;
}
