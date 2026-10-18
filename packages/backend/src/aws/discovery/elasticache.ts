import {
  ElastiCacheClient,
  DescribeCacheClustersCommand,
} from "@aws-sdk/client-elasticache";
import type { Resource, Edge } from "@orbit/core";
import { RESOURCE_TYPES, RELATIONSHIP_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface ElastiCacheDiscoveryResult {
  resources: Resource[];
  edges: Edge[];
}

export async function discoverElastiCache(
  client: ElastiCacheClient,
  accountId: string,
  region: string
): Promise<ElastiCacheDiscoveryResult> {
  const resources: Resource[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  let marker: string | undefined;
  const clusters: Array<Record<string, unknown>> = [];

  do {
    const listRes = await withRateLimit("elasticache", () =>
      awsReadOnlyCall<{
        CacheClusters?: Array<Record<string, unknown>>;
        Marker?: string;
      }>(
        client,
        new DescribeCacheClustersCommand({ Marker: marker, ShowCacheNodeInfo: true }),
        "elasticache",
        accountId
      )
    );

    if (listRes.CacheClusters) {
      clusters.push(...listRes.CacheClusters);
    }
    marker = listRes.Marker;
  } while (marker);

  for (const cluster of clusters) {
    const clusterId = cluster["CacheClusterId"] as string;
    if (!clusterId) continue;
    const arn = (cluster["ARN"] as string) || `arn:aws:elasticache:${region}:${accountId}:cluster:${clusterId}`;
    const status = (cluster["CacheClusterStatus"] as string) === "available" ? "healthy" : "unknown";

    resources.push({
      id: clusterId,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.ELASTICACHE_CLUSTER,
      arn,
      name: clusterId,
      tags: {},
      rawConfig: cluster,
      status,
      lastSeenAt: now,
    });

    // Edge to Security Group if CacheSecurityGroups or SecurityGroups present
    const sgs = (cluster["SecurityGroups"] as Array<{ SecurityGroupId?: string }>) || [];
    for (const sg of sgs) {
      if (sg.SecurityGroupId) {
        edges.push({
          id: `${clusterId}--${RELATIONSHIP_TYPES.MEMBER_OF}--${sg.SecurityGroupId}`,
          sourceResourceId: clusterId,
          targetResourceId: sg.SecurityGroupId,
          relationshipType: RELATIONSHIP_TYPES.MEMBER_OF,
        });
      }
    }
  }

  return { resources, edges };
}
