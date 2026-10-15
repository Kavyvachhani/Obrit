import {
  RDSClient,
  DescribeDBInstancesCommand,
  DescribeDBClustersCommand,
} from "@aws-sdk/client-rds";
import type { Resource, Edge } from "@orbit/core";
import { RESOURCE_TYPES, RELATIONSHIP_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface RdsDiscoveryResult {
  resources: Resource[];
  edges: Edge[];
}

export async function discoverRds(
  client: RDSClient,
  accountId: string,
  region: string
): Promise<RdsDiscoveryResult> {
  const resources: Resource[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  // ─── DB Instances ────────────────────────────────────────────────────────
  const instancesResult = await withRateLimit("rds", () =>
    awsReadOnlyCall<{ DBInstances?: Array<Record<string, unknown>> }>(
      client,
      new DescribeDBInstancesCommand({}),
      "rds",
      accountId
    )
  );

  for (const db of instancesResult.DBInstances ?? []) {
    const dbId = db["DBInstanceIdentifier"] as string;
    const dbArn = db["DBInstanceArn"] as string;
    const status = db["DBInstanceStatus"] as string;

    resources.push({
      id: dbId,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.RDS_INSTANCE,
      arn: dbArn,
      name: dbId,
      tags: {},
      rawConfig: db,
      status: status === "available" ? "healthy" : status === "stopped" ? "degraded" : "unknown",
      lastSeenAt: now,
    });

    // Edge: RDS → Subnets (runs-in, via subnet group)
    const subnetGroup = db["DBSubnetGroup"] as
      | { Subnets?: Array<{ SubnetIdentifier?: string }> ; VpcId?: string }
      | undefined;

    if (subnetGroup?.VpcId) {
      edges.push({
        id: `${dbId}--${RELATIONSHIP_TYPES.RUNS_IN}--${subnetGroup.VpcId}`,
        sourceResourceId: dbId,
        targetResourceId: subnetGroup.VpcId,
        relationshipType: RELATIONSHIP_TYPES.RUNS_IN,
      });
    }

    for (const subnet of subnetGroup?.Subnets ?? []) {
      if (subnet.SubnetIdentifier) {
        edges.push({
          id: `${dbId}--${RELATIONSHIP_TYPES.RUNS_IN}--${subnet.SubnetIdentifier}`,
          sourceResourceId: dbId,
          targetResourceId: subnet.SubnetIdentifier,
          relationshipType: RELATIONSHIP_TYPES.RUNS_IN,
        });
      }
    }

    // Edge: RDS → Security Groups (member-of)
    const sgs = db["VpcSecurityGroups"] as
      | Array<{ VpcSecurityGroupId?: string }>
      | undefined;
    for (const sg of sgs ?? []) {
      if (sg.VpcSecurityGroupId) {
        edges.push({
          id: `${dbId}--${RELATIONSHIP_TYPES.MEMBER_OF}--${sg.VpcSecurityGroupId}`,
          sourceResourceId: dbId,
          targetResourceId: sg.VpcSecurityGroupId,
          relationshipType: RELATIONSHIP_TYPES.MEMBER_OF,
        });
      }
    }
  }

  // ─── DB Clusters (Aurora) ────────────────────────────────────────────────
  try {
    const clustersResult = await withRateLimit("rds", () =>
      awsReadOnlyCall<{ DBClusters?: Array<Record<string, unknown>> }>(
        client,
        new DescribeDBClustersCommand({}),
        "rds",
        accountId
      )
    );

    for (const cluster of clustersResult.DBClusters ?? []) {
      const clusterId = cluster["DBClusterIdentifier"] as string;
      const clusterArn = cluster["DBClusterArn"] as string;
      const status = cluster["Status"] as string;

      resources.push({
        id: clusterId,
        provider: "aws",
        accountId,
        region,
        type: RESOURCE_TYPES.RDS_CLUSTER,
        arn: clusterArn,
        name: clusterId,
        tags: {},
        rawConfig: cluster,
        status: status === "available" ? "healthy" : "degraded",
        lastSeenAt: now,
      });

      // Edge: Cluster → Security Groups
      const sgs = cluster["VpcSecurityGroups"] as
        | Array<{ VpcSecurityGroupId?: string }>
        | undefined;
      for (const sg of sgs ?? []) {
        if (sg.VpcSecurityGroupId) {
          edges.push({
            id: `${clusterId}--${RELATIONSHIP_TYPES.MEMBER_OF}--${sg.VpcSecurityGroupId}`,
            sourceResourceId: clusterId,
            targetResourceId: sg.VpcSecurityGroupId,
            relationshipType: RELATIONSHIP_TYPES.MEMBER_OF,
          });
        }
      }
    }
  } catch {
    // Aurora clusters may not exist in all regions — non-fatal
  }

  return { resources, edges };
}
