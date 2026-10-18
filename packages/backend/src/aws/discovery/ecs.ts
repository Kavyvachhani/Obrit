import {
  ECSClient,
  ListClustersCommand,
  DescribeClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
} from "@aws-sdk/client-ecs";
import type { Resource, Edge } from "@orbit/core";
import { RESOURCE_TYPES, RELATIONSHIP_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface EcsDiscoveryResult {
  resources: Resource[];
  edges: Edge[];
}

export async function discoverEcs(
  client: ECSClient,
  accountId: string,
  region: string
): Promise<EcsDiscoveryResult> {
  const resources: Resource[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  let nextToken: string | undefined;
  const clusterArns: string[] = [];

  do {
    const listRes = await withRateLimit("ecs", () =>
      awsReadOnlyCall<{
        clusterArns?: string[];
        nextToken?: string;
      }>(
        client,
        new ListClustersCommand({ nextToken }),
        "ecs",
        accountId
      )
    );

    if (listRes.clusterArns) {
      clusterArns.push(...listRes.clusterArns);
    }
    nextToken = listRes.nextToken;
  } while (nextToken);

  if (clusterArns.length === 0) {
    return { resources, edges };
  }

  // Describe clusters in chunks of 100
  for (let i = 0; i < clusterArns.length; i += 100) {
    const chunk = clusterArns.slice(i, i + 100);
    try {
      const descRes = await withRateLimit("ecs", () =>
        awsReadOnlyCall<{
          clusters?: Array<Record<string, unknown>>;
        }>(
          client,
          new DescribeClustersCommand({ clusters: chunk }),
          "ecs",
          accountId
        )
      );

      for (const cl of descRes.clusters || []) {
        const clusterArn = cl["clusterArn"] as string;
        const clusterName = (cl["clusterName"] as string) || clusterArn.split("/").pop() || clusterArn;
        const status = (cl["status"] as string) === "ACTIVE" ? "healthy" : "unknown";

        resources.push({
          id: clusterName,
          provider: "aws",
          accountId,
          region,
          type: RESOURCE_TYPES.ECS_CLUSTER,
          arn: clusterArn,
          name: clusterName,
          tags: {},
          rawConfig: cl,
          status,
          lastSeenAt: now,
        });

        // Discover services inside this cluster
        try {
          const srvListRes = await withRateLimit("ecs", () =>
            awsReadOnlyCall<{
              serviceArns?: string[];
            }>(
              client,
              new ListServicesCommand({ cluster: clusterArn, maxResults: 10 }),
              "ecs",
              accountId
            )
          );

          if (srvListRes.serviceArns && srvListRes.serviceArns.length > 0) {
            const descSrvRes = await withRateLimit("ecs", () =>
              awsReadOnlyCall<{
                services?: Array<Record<string, unknown>>;
              }>(
                client,
                new DescribeServicesCommand({
                  cluster: clusterArn,
                  services: srvListRes.serviceArns!.slice(0, 10),
                }),
                "ecs",
                accountId
              )
            );

            for (const srv of descSrvRes.services || []) {
              const srvArn = srv["serviceArn"] as string;
              const srvName = (srv["serviceName"] as string) || srvArn.split("/").pop() || srvArn;

              resources.push({
                id: srvName,
                provider: "aws",
                accountId,
                region,
                type: RESOURCE_TYPES.ECS_SERVICE,
                arn: srvArn,
                name: srvName,
                tags: {},
                rawConfig: srv,
                status: (srv["status"] as string) === "ACTIVE" ? "healthy" : "unknown",
                lastSeenAt: now,
              });

              edges.push({
                id: `${srvName}--${RELATIONSHIP_TYPES.CONTAINED_IN}--${clusterName}`,
                sourceResourceId: srvName,
                targetResourceId: clusterName,
                relationshipType: RELATIONSHIP_TYPES.CONTAINED_IN,
              });
            }
          }
        } catch {
          // Ignore service list/describe failure
        }
      }
    } catch {
      // Ignore cluster describe failure
    }
  }

  return { resources, edges };
}
