import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
} from "@aws-sdk/client-cost-explorer";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";
import pino from "pino";

const logger = pino({ name: "cost-explorer" });

/**
 * Normalizes AWS Cost Explorer service names to common short labels.
 */
export const SERVICE_NORMALIZATION: Record<string, { shortName: string; resourcePrefixes: string[] }> = {
  "Amazon Elastic Compute Cloud - Compute": { shortName: "EC2", resourcePrefixes: ["ec2:instance"] },
  "Amazon EC2": { shortName: "EC2", resourcePrefixes: ["ec2:instance"] },
  "AWS Lambda": { shortName: "Lambda", resourcePrefixes: ["lambda:function"] },
  "Amazon Relational Database Service": { shortName: "RDS", resourcePrefixes: ["rds:instance", "rds:cluster"] },
  "Amazon Simple Storage Service": { shortName: "S3", resourcePrefixes: ["s3:bucket"] },
  "Amazon DynamoDB": { shortName: "DynamoDB", resourcePrefixes: ["dynamodb:table"] },
  "Amazon Simple Queue Service": { shortName: "SQS", resourcePrefixes: ["sqs:queue"] },
  "Amazon Simple Notification Service": { shortName: "SNS", resourcePrefixes: ["sns:topic"] },
  "Amazon API Gateway": { shortName: "API Gateway", resourcePrefixes: ["apigateway:api"] },
  "Amazon CloudFront": { shortName: "CloudFront", resourcePrefixes: ["cloudfront:distribution"] },
  "Amazon Elastic Container Service": { shortName: "ECS", resourcePrefixes: ["ecs:cluster", "ecs:service"] },
  "Amazon Elastic Kubernetes Service": { shortName: "EKS", resourcePrefixes: ["eks:cluster"] },
  "AWS Step Functions": { shortName: "Step Functions", resourcePrefixes: ["stepfunctions:state-machine"] },
  "Amazon ElastiCache": { shortName: "ElastiCache", resourcePrefixes: ["elasticache:cluster"] },
  "Elastic Load Balancing": { shortName: "ELB", resourcePrefixes: ["elb:load-balancer", "elb:target-group"] },
  "Amazon Virtual Private Cloud": { shortName: "VPC", resourcePrefixes: ["vpc:vpc", "vpc:subnet", "vpc:nat-gateway"] },
};

/**
 * Query Cost Explorer for services with active usage/cost in the last 14 days.
 * Strictly read-only via ce:GetCostAndUsage.
 */
export async function getActiveBillingServices(
  client: CostExplorerClient,
  accountId: string
): Promise<string[]> {
  try {
    const now = new Date();
    const endDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const response = await withRateLimit("ce", () =>
      awsReadOnlyCall<{
        ResultsByTime?: Array<{
          Groups?: Array<{
            Keys?: string[];
            Metrics?: {
              UnblendedCost?: { Amount?: string };
              UsageQuantity?: { Amount?: string };
            };
          }>;
        }>;
      }>(
        client,
        new GetCostAndUsageCommand({
          TimePeriod: { Start: startDate, End: endDate },
          Granularity: "MONTHLY",
          Metrics: ["UnblendedCost", "UsageQuantity"],
          GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
        }),
        "ce",
        accountId
      )
    );

    const activeServices = new Set<string>();

    for (const timeBlock of response.ResultsByTime || []) {
      for (const group of timeBlock.Groups || []) {
        const rawServiceName = group.Keys?.[0];
        if (!rawServiceName) continue;

        const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || "0");
        const usage = parseFloat(group.Metrics?.UsageQuantity?.Amount || "0");

        if (cost > 0 || usage > 0) {
          activeServices.add(rawServiceName);
        }
      }
    }

    return Array.from(activeServices);
  } catch (err) {
    logger.warn({ accountId, err }, "Cost Explorer query skipped or unavailable");
    return [];
  }
}

/**
 * Compare services detected in billing with actual mapped resources in the scan.
 * Returns services that have real billing usage but 0 mapped resources in Orbit.
 */
export function findUnplannedServices(
  activeBillingServices: string[],
  mappedResourceTypes: Set<string>
): string[] {
  const unplanned = new Set<string>();

  for (const rawService of activeBillingServices) {
    const mapping = SERVICE_NORMALIZATION[rawService];
    if (mapping) {
      // Check if any corresponding resource type was discovered
      const hasResource = mapping.resourcePrefixes.some((prefix) => mappedResourceTypes.has(prefix));
      if (!hasResource) {
        unplanned.add(mapping.shortName);
      }
    } else {
      // Unmapped generic service (e.g. "Amazon Kinesis", "Amazon Redshift", "Amazon OpenSearch")
      // Extract a clean short name
      const cleanName = rawService.replace(/^(Amazon|AWS)\s+/i, "");
      unplanned.add(cleanName);
    }
  }

  return Array.from(unplanned);
}

export interface ServiceCostSummary {
  serviceName: string;
  shortName: string;
  mtdCost: number;
  estimatedMonthEndCost: number;
  resourcePrefixes: string[];
}

export interface BillingDataResult {
  available: boolean;
  reason?: string;
  currency?: string;
  monthToDateTotal?: number;
  estimatedMonthEndTotal?: number;
  services?: ServiceCostSummary[];
}

/**
 * Retrieve current month-to-date cost and estimated month-end total per service.
 * Requires optional ce:GetCostAndUsage and ce:GetCostForecast permissions.
 * If not granted, returns { available: false } cleanly without erroring.
 */
export async function getBillingDataAndForecast(
  client: CostExplorerClient,
  accountId: string
): Promise<BillingDataResult> {
  try {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth(); // 0-indexed
    const day = now.getUTCDate();

    const mtdStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const mtdEnd = tomorrow.toISOString().split("T")[0];

    // 1. Month-to-date spend grouped by service
    const usageResponse = await withRateLimit("ce", () =>
      awsReadOnlyCall<{
        ResultsByTime?: Array<{
          Groups?: Array<{
            Keys?: string[];
            Metrics?: {
              UnblendedCost?: { Amount?: string };
            };
          }>;
        }>;
      }>(
        client,
        new GetCostAndUsageCommand({
          TimePeriod: { Start: mtdStart, End: mtdEnd },
          Granularity: "MONTHLY",
          Metrics: ["UnblendedCost"],
          GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
        }),
        "ce",
        accountId
      )
    );

    const serviceMap = new Map<string, { mtdCost: number; shortName: string; prefixes: string[] }>();
    let mtdTotal = 0;

    for (const timeBlock of usageResponse.ResultsByTime || []) {
      for (const group of timeBlock.Groups || []) {
        const rawServiceName = group.Keys?.[0] || "Other";
        const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || "0");
        if (cost <= 0) continue;

        mtdTotal += cost;
        const norm = SERVICE_NORMALIZATION[rawServiceName] || {
          shortName: rawServiceName.replace(/^(Amazon|AWS)\s+/i, ""),
          resourcePrefixes: [],
        };

        const existing = serviceMap.get(rawServiceName) || {
          mtdCost: 0,
          shortName: norm.shortName,
          prefixes: norm.resourcePrefixes,
        };
        existing.mtdCost += cost;
        serviceMap.set(rawServiceName, existing);
      }
    }

    // 2. Month-end forecast
    let estimatedTotal = mtdTotal;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysRemaining = Math.max(1, daysInMonth - day);

    try {
      const nextMonthYear = month === 11 ? year + 1 : year;
      const nextMonthNum = month === 11 ? 1 : month + 2;
      const forecastEnd = `${nextMonthYear}-${String(nextMonthNum).padStart(2, "0")}-01`;

      const forecastResponse = await withRateLimit("ce", () =>
        awsReadOnlyCall<{
          Total?: { Amount?: string };
        }>(
          client,
          new GetCostForecastCommand({
            TimePeriod: { Start: mtdEnd, End: forecastEnd },
            Metric: "UNBLENDED_COST",
            Granularity: "MONTHLY",
          }),
          "ce",
          accountId
        )
      );

      const forecastRemaining = parseFloat(forecastResponse.Total?.Amount || "0");
      estimatedTotal = mtdTotal + forecastRemaining;
    } catch (fcErr) {
      // Fallback: simple linear run-rate projection if forecast API lacks history
      logger.debug({ accountId, fcErr }, "ce:GetCostForecast unavailable; falling back to linear run-rate");
      const currentDay = Math.max(1, day);
      estimatedTotal = (mtdTotal / currentDay) * daysInMonth;
    }

    // Distribute estimated forecast across services based on current share
    const services: ServiceCostSummary[] = [];
    const ratio = mtdTotal > 0 ? estimatedTotal / mtdTotal : 1;

    for (const [rawName, data] of serviceMap.entries()) {
      services.push({
        serviceName: rawName,
        shortName: data.shortName,
        mtdCost: parseFloat(data.mtdCost.toFixed(2)),
        estimatedMonthEndCost: parseFloat((data.mtdCost * ratio).toFixed(2)),
        resourcePrefixes: data.prefixes,
      });
    }

    services.sort((a, b) => b.mtdCost - a.mtdCost);

    return {
      available: true,
      currency: "USD",
      monthToDateTotal: parseFloat(mtdTotal.toFixed(2)),
      estimatedMonthEndTotal: parseFloat(estimatedTotal.toFixed(2)),
      services,
    };
  } catch (err: any) {
    const errName = err?.name || "AccessDenied";
    logger.info({ accountId, errName }, "Optional Cost Explorer billing access not granted");
    return {
      available: false,
      reason: "Optional Cost Explorer permissions (ce:GetCostAndUsage, ce:GetCostForecast) not granted on this account.",
    };
  }
}
