import {
  DynamoDBClient,
  ListTablesCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import type { Resource, Edge } from "@orbit/core";
import { RESOURCE_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface DynamoDbDiscoveryResult {
  resources: Resource[];
  edges: Edge[];
}

export async function discoverDynamoDb(
  client: DynamoDBClient,
  accountId: string,
  region: string
): Promise<DynamoDbDiscoveryResult> {
  const resources: Resource[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  let startTableName: string | undefined;
  const tableNames: string[] = [];

  do {
    const listRes = await withRateLimit("dynamodb", () =>
      awsReadOnlyCall<{
        TableNames?: string[];
        LastEvaluatedTableName?: string;
      }>(
        client,
        new ListTablesCommand({ ExclusiveStartTableName: startTableName, Limit: 100 }),
        "dynamodb",
        accountId
      )
    );

    if (listRes.TableNames) {
      tableNames.push(...listRes.TableNames);
    }
    startTableName = listRes.LastEvaluatedTableName;
  } while (startTableName);

  for (const tableName of tableNames) {
    try {
      const descRes = await withRateLimit("dynamodb", () =>
        awsReadOnlyCall<{
          Table?: Record<string, unknown>;
        }>(
          client,
          new DescribeTableCommand({ TableName: tableName }),
          "dynamodb",
          accountId
        )
      );

      const table = descRes.Table || {};
      const tableArn = (table["TableArn"] as string) || `arn:aws:dynamodb:${region}:${accountId}:table/${tableName}`;
      const status = (table["TableStatus"] as string) === "ACTIVE" ? "healthy" : "unknown";

      resources.push({
        id: tableName,
        provider: "aws",
        accountId,
        region,
        type: RESOURCE_TYPES.DYNAMODB_TABLE,
        arn: tableArn,
        name: tableName,
        tags: {},
        rawConfig: table,
        status,
        lastSeenAt: now,
      });
    } catch {
      // If DescribeTable fails, record table with basic info
      resources.push({
        id: tableName,
        provider: "aws",
        accountId,
        region,
        type: RESOURCE_TYPES.DYNAMODB_TABLE,
        arn: `arn:aws:dynamodb:${region}:${accountId}:table/${tableName}`,
        name: tableName,
        tags: {},
        rawConfig: {},
        status: "healthy",
        lastSeenAt: now,
      });
    }
  }

  return { resources, edges };
}
