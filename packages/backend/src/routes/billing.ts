import type { FastifyInstance } from "fastify";
import { CostExplorerClient } from "@aws-sdk/client-cost-explorer";
import { query } from "../db/client.js";
import { decrypt } from "../crypto/credentials.js";
import { getBillingDataAndForecast, BillingDataResult } from "../aws/discovery/cost-explorer.js";

const DEMO_BILLING_DATA: BillingDataResult = {
  available: true,
  currency: "USD",
  monthToDateTotal: 2845.60,
  estimatedMonthEndTotal: 3950.00,
  services: [
    {
      serviceName: "Amazon Elastic Compute Cloud - Compute",
      shortName: "EC2",
      mtdCost: 1120.40,
      estimatedMonthEndCost: 1540.00,
      resourcePrefixes: ["ec2:instance"],
    },
    {
      serviceName: "Amazon Relational Database Service",
      shortName: "RDS",
      mtdCost: 680.50,
      estimatedMonthEndCost: 920.00,
      resourcePrefixes: ["rds:instance", "rds:cluster"],
    },
    {
      serviceName: "Elastic Load Balancing",
      shortName: "ELB",
      mtdCost: 240.20,
      estimatedMonthEndCost: 340.00,
      resourcePrefixes: ["elb:load-balancer", "elb:target-group"],
    },
    {
      serviceName: "Amazon Simple Storage Service",
      shortName: "S3",
      mtdCost: 195.80,
      estimatedMonthEndCost: 270.00,
      resourcePrefixes: ["s3:bucket"],
    },
    {
      serviceName: "AWS Lambda",
      shortName: "Lambda",
      mtdCost: 164.30,
      estimatedMonthEndCost: 230.00,
      resourcePrefixes: ["lambda:function"],
    },
    {
      serviceName: "Amazon CloudFront",
      shortName: "CloudFront",
      mtdCost: 142.10,
      estimatedMonthEndCost: 200.00,
      resourcePrefixes: ["cloudfront:distribution"],
    },
    {
      serviceName: "Amazon DynamoDB",
      shortName: "DynamoDB",
      mtdCost: 128.50,
      estimatedMonthEndCost: 180.00,
      resourcePrefixes: ["dynamodb:table"],
    },
    {
      serviceName: "Amazon ElastiCache",
      shortName: "ElastiCache",
      mtdCost: 98.40,
      estimatedMonthEndCost: 140.00,
      resourcePrefixes: ["elasticache:cluster"],
    },
    {
      serviceName: "Amazon Virtual Private Cloud",
      shortName: "VPC",
      mtdCost: 45.40,
      estimatedMonthEndCost: 80.00,
      resourcePrefixes: ["vpc:vpc", "vpc:subnet", "vpc:nat-gateway"],
    },
    {
      serviceName: "Amazon Simple Queue Service",
      shortName: "SQS",
      mtdCost: 30.00,
      estimatedMonthEndCost: 50.00,
      resourcePrefixes: ["sqs:queue"],
    },
  ],
};

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/billing/:accountId
   * Returns current month-to-date cost and estimated month-end total per service.
   * If ce:GetCostAndUsage / ce:GetCostForecast permission is not granted,
   * returns { available: false } cleanly without erroring.
   */
  app.get<{ Params: { accountId: string } }>("/api/billing/:accountId", async (request, reply) => {
    const { accountId } = request.params;

    if (!accountId || accountId === "demo" || accountId.startsWith("acc_demo")) {
      return reply.send(DEMO_BILLING_DATA);
    }

    try {
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
        // Fallback to demo billing data if account not in db
        return reply.send(DEMO_BILLING_DATA);
      }

      const client = new CostExplorerClient({
        region: "us-east-1", // Cost Explorer endpoint is global via us-east-1
        credentials: {
          accessKeyId: decrypt(row.encrypted_access_key_id),
          secretAccessKey: decrypt(row.encrypted_secret_key),
        },
      });

      const billingData = await getBillingDataAndForecast(client, accountId);
      return reply.send(billingData);
    } catch (err) {
      // In case of any unhandled issue, return available: false gracefully
      return reply.send({
        available: false,
        reason: "Cost Explorer permissions not granted or account unavailable.",
      });
    }
  });
}
