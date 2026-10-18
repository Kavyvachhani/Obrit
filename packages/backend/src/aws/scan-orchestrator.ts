import { EC2Client } from "@aws-sdk/client-ec2";
import { ElasticLoadBalancingV2Client } from "@aws-sdk/client-elastic-load-balancing-v2";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { RDSClient } from "@aws-sdk/client-rds";
import { S3Client } from "@aws-sdk/client-s3";
import { IAMClient } from "@aws-sdk/client-iam";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";
import { SNSClient } from "@aws-sdk/client-sns";
import { APIGatewayClient } from "@aws-sdk/client-api-gateway";
import { CloudFrontClient } from "@aws-sdk/client-cloudfront";
import { ECSClient } from "@aws-sdk/client-ecs";
import { EKSClient } from "@aws-sdk/client-eks";
import { SFNClient } from "@aws-sdk/client-sfn";
import { ElastiCacheClient } from "@aws-sdk/client-elasticache";
import { CostExplorerClient } from "@aws-sdk/client-cost-explorer";

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
import { discoverDynamoDb } from "./discovery/dynamodb.js";
import { discoverSqs } from "./discovery/sqs.js";
import { discoverSns } from "./discovery/sns.js";
import { discoverApiGateway } from "./discovery/apigateway.js";
import { discoverCloudFront } from "./discovery/cloudfront.js";
import { discoverEcs } from "./discovery/ecs.js";
import { discoverEks } from "./discovery/eks.js";
import { discoverStepFunctions } from "./discovery/stepfunctions.js";
import { discoverElastiCache } from "./discovery/elasticache.js";
import { getActiveBillingServices, findUnplannedServices } from "./discovery/cost-explorer.js";

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

  const globalConfig = {
    ...config,
    region: "us-east-1",
  };

  return {
    ec2: new EC2Client(config),
    elb: new ElasticLoadBalancingV2Client(config),
    lambda: new LambdaClient(config),
    rds: new RDSClient(config),
    s3: new S3Client(config),
    iam: new IAMClient(globalConfig),
    dynamodb: new DynamoDBClient(config),
    sqs: new SQSClient(config),
    sns: new SNSClient(config),
    apigateway: new APIGatewayClient(config),
    cloudfront: new CloudFrontClient(globalConfig),
    ecs: new ECSClient(config),
    eks: new EKSClient(config),
    sfn: new SFNClient(config),
    elasticache: new ElastiCacheClient(config),
    ce: new CostExplorerClient(globalConfig),
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

  logger.info({ scanId, accountId, region: creds.region }, "Starting full-account scan");

  // ─── Config-driven discovery module list ──────────────────────────────────
  const discoveries = [
    { name: "ec2", fn: () => discoverEc2(clients.ec2, accountId, creds.region) },
    { name: "elb", fn: () => discoverElb(clients.elb, accountId, creds.region) },
    { name: "lambda", fn: () => discoverLambda(clients.lambda, accountId, creds.region) },
    { name: "rds", fn: () => discoverRds(clients.rds, accountId, creds.region) },
    { name: "s3", fn: () => discoverS3(clients.s3, accountId, creds.region) },
    { name: "iam", fn: () => discoverIam(clients.iam, accountId) },
    { name: "dynamodb", fn: () => discoverDynamoDb(clients.dynamodb, accountId, creds.region) },
    { name: "sqs", fn: () => discoverSqs(clients.sqs, accountId, creds.region) },
    { name: "sns", fn: () => discoverSns(clients.sns, accountId, creds.region) },
    { name: "apigateway", fn: () => discoverApiGateway(clients.apigateway, accountId, creds.region) },
    { name: "cloudfront", fn: () => discoverCloudFront(clients.cloudfront, accountId, creds.region) },
    { name: "ecs", fn: () => discoverEcs(clients.ecs, accountId, creds.region) },
    { name: "eks", fn: () => discoverEks(clients.eks, accountId, creds.region) },
    { name: "stepfunctions", fn: () => discoverStepFunctions(clients.sfn, accountId, creds.region) },
    { name: "elasticache", fn: () => discoverElastiCache(clients.elasticache, accountId, creds.region) },
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

  // ─── Unplanned / Unmapped Services Detector (via Cost Explorer) ───────────
  let unplannedServices: string[] = [];
  try {
    const activeBillingServices = await getActiveBillingServices(clients.ce, accountId);
    const mappedTypes = new Set(allResources.map((r) => r.type));
    unplannedServices = findUnplannedServices(activeBillingServices, mappedTypes);
    logger.info({ scanId, unplannedServices }, "Unplanned services evaluated from billing data");
  } catch (ceErr) {
    logger.warn({ scanId, ceErr }, "Failed to evaluate unplanned services from Cost Explorer");
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
       errors = $3,
       unplanned_services = $4
     WHERE id = $5`,
    [allResources.length, status, JSON.stringify(errors), JSON.stringify(unplannedServices), scanId]
  );

  logger.info(
    {
      scanId,
      resources: allResources.length,
      edges: allEdges.length,
      errors: errors.length,
      status,
      unplannedServices,
    },
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
    unplannedServices,
  };

  return scanRun;
}
