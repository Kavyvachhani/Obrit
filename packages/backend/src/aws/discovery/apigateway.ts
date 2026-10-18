import {
  APIGatewayClient,
  GetRestApisCommand,
} from "@aws-sdk/client-api-gateway";
import type { Resource, Edge } from "@orbit/core";
import { RESOURCE_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface ApiGatewayDiscoveryResult {
  resources: Resource[];
  edges: Edge[];
}

export async function discoverApiGateway(
  client: APIGatewayClient,
  accountId: string,
  region: string
): Promise<ApiGatewayDiscoveryResult> {
  const resources: Resource[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  let position: string | undefined;
  const items: Array<Record<string, unknown>> = [];

  do {
    const listRes = await withRateLimit("apigateway", () =>
      awsReadOnlyCall<{
        items?: Array<Record<string, unknown>>;
        position?: string;
      }>(
        client,
        new GetRestApisCommand({ position, limit: 100 }),
        "apigateway",
        accountId
      )
    );

    if (listRes.items) {
      items.push(...listRes.items);
    }
    position = listRes.position;
  } while (position);

  for (const item of items) {
    const apiId = item["id"] as string;
    if (!apiId) continue;
    const name = (item["name"] as string) || apiId;
    const arn = `arn:aws:apigateway:${region}::/restapis/${apiId}`;

    resources.push({
      id: apiId,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.API_GATEWAY,
      arn,
      name,
      tags: (item["tags"] as Record<string, string>) || {},
      rawConfig: item,
      status: "healthy",
      lastSeenAt: now,
    });
  }

  return { resources, edges };
}
