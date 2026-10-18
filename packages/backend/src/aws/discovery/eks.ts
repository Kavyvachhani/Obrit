import {
  EKSClient,
  ListClustersCommand,
  DescribeClusterCommand,
} from "@aws-sdk/client-eks";
import type { Resource, Edge } from "@orbit/core";
import { RESOURCE_TYPES, RELATIONSHIP_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface EksDiscoveryResult {
  resources: Resource[];
  edges: Edge[];
}

export async function discoverEks(
  client: EKSClient,
  accountId: string,
  region: string
): Promise<EksDiscoveryResult> {
  const resources: Resource[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  let nextToken: string | undefined;
  const clusterNames: string[] = [];

  do {
    const listRes = await withRateLimit("eks", () =>
      awsReadOnlyCall<{
        clusters?: string[];
        nextToken?: string;
      }>(
        client,
        new ListClustersCommand({ nextToken }),
        "eks",
        accountId
      )
    );

    if (listRes.clusters) {
      clusterNames.push(...listRes.clusters);
    }
    nextToken = listRes.nextToken;
  } while (nextToken);

  for (const clusterName of clusterNames) {
    try {
      const descRes = await withRateLimit("eks", () =>
        awsReadOnlyCall<{
          cluster?: Record<string, unknown>;
        }>(
          client,
          new DescribeClusterCommand({ name: clusterName }),
          "eks",
          accountId
        )
      );

      const cluster = descRes.cluster || {};
      const arn = (cluster["arn"] as string) || `arn:aws:eks:${region}:${accountId}:cluster/${clusterName}`;
      const status = (cluster["status"] as string) === "ACTIVE" ? "healthy" : "unknown";

      resources.push({
        id: clusterName,
        provider: "aws",
        accountId,
        region,
        type: RESOURCE_TYPES.EKS_CLUSTER,
        arn,
        name: clusterName,
        tags: (cluster["tags"] as Record<string, string>) || {},
        rawConfig: cluster,
        status,
        lastSeenAt: now,
      });

      // Edge to VPC if resourcesVpcConfig exists
      const vpcConfig = cluster["resourcesVpcConfig"] as { vpcId?: string; subnetIds?: string[] } | undefined;
      if (vpcConfig?.vpcId) {
        edges.push({
          id: `${clusterName}--${RELATIONSHIP_TYPES.RUNS_IN}--${vpcConfig.vpcId}`,
          sourceResourceId: clusterName,
          targetResourceId: vpcConfig.vpcId,
          relationshipType: RELATIONSHIP_TYPES.RUNS_IN,
        });
      }
    } catch {
      // Basic fallback
      resources.push({
        id: clusterName,
        provider: "aws",
        accountId,
        region,
        type: RESOURCE_TYPES.EKS_CLUSTER,
        arn: `arn:aws:eks:${region}:${accountId}:cluster/${clusterName}`,
        name: clusterName,
        tags: {},
        rawConfig: {},
        status: "healthy",
        lastSeenAt: now,
      });
    }
  }

  return { resources, edges };
}
