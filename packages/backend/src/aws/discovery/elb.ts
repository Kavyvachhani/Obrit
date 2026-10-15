import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import type { Resource, Edge } from "@orbit/core";
import { RESOURCE_TYPES, RELATIONSHIP_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface ElbDiscoveryResult {
  resources: Resource[];
  edges: Edge[];
}

export async function discoverElb(
  client: ElasticLoadBalancingV2Client,
  accountId: string,
  region: string
): Promise<ElbDiscoveryResult> {
  const resources: Resource[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  // ─── Load Balancers ──────────────────────────────────────────────────────
  const lbResult = await withRateLimit("elb", () =>
    awsReadOnlyCall<{ LoadBalancers?: Array<Record<string, unknown>> }>(
      client,
      new DescribeLoadBalancersCommand({}),
      "elasticloadbalancing",
      accountId
    )
  );

  const lbArnToId = new Map<string, string>();

  for (const lb of lbResult.LoadBalancers ?? []) {
    const lbArn = lb["LoadBalancerArn"] as string;
    const lbName = lb["LoadBalancerName"] as string;
    const lbId = lbArn.split("/").pop() ?? lbName;

    lbArnToId.set(lbArn, lbId);

    resources.push({
      id: lbId,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.LOAD_BALANCER,
      arn: lbArn,
      name: lbName,
      tags: {},
      rawConfig: lb,
      status:
        (lb["State"] as { Code?: string })?.Code === "active"
          ? "healthy"
          : "degraded",
      lastSeenAt: now,
    });

    // Edge: LB → VPC (contained-in)
    const vpcId = lb["VpcId"] as string | undefined;
    if (vpcId) {
      edges.push({
        id: `${lbId}--${RELATIONSHIP_TYPES.CONTAINED_IN}--${vpcId}`,
        sourceResourceId: lbId,
        targetResourceId: vpcId,
        relationshipType: RELATIONSHIP_TYPES.CONTAINED_IN,
      });
    }

    // Edge: LB → Subnets (contained-in)
    const azs = lb["AvailabilityZones"] as
      | Array<{ SubnetId?: string }>
      | undefined;
    for (const az of azs ?? []) {
      if (az.SubnetId) {
        edges.push({
          id: `${lbId}--${RELATIONSHIP_TYPES.CONTAINED_IN}--${az.SubnetId}`,
          sourceResourceId: lbId,
          targetResourceId: az.SubnetId,
          relationshipType: RELATIONSHIP_TYPES.CONTAINED_IN,
        });
      }
    }

    // Edge: LB → Security Groups (member-of)
    const sgs = lb["SecurityGroups"] as string[] | undefined;
    for (const sgId of sgs ?? []) {
      edges.push({
        id: `${lbId}--${RELATIONSHIP_TYPES.MEMBER_OF}--${sgId}`,
        sourceResourceId: lbId,
        targetResourceId: sgId,
        relationshipType: RELATIONSHIP_TYPES.MEMBER_OF,
      });
    }
  }

  // ─── Target Groups ──────────────────────────────────────────────────────
  const tgResult = await withRateLimit("elb", () =>
    awsReadOnlyCall<{ TargetGroups?: Array<Record<string, unknown>> }>(
      client,
      new DescribeTargetGroupsCommand({}),
      "elasticloadbalancing",
      accountId
    )
  );

  for (const tg of tgResult.TargetGroups ?? []) {
    const tgArn = tg["TargetGroupArn"] as string;
    const tgName = tg["TargetGroupName"] as string;
    const tgId = tgArn.split("/").pop() ?? tgName;

    resources.push({
      id: tgId,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.TARGET_GROUP,
      arn: tgArn,
      name: tgName,
      tags: {},
      rawConfig: tg,
      status: "healthy",
      lastSeenAt: now,
    });

    // Edge: LB → TargetGroup (routes-to)
    const lbArns = tg["LoadBalancerArns"] as string[] | undefined;
    for (const lbArn of lbArns ?? []) {
      const lbId = lbArnToId.get(lbArn);
      if (lbId) {
        edges.push({
          id: `${lbId}--${RELATIONSHIP_TYPES.ROUTES_TO}--${tgId}`,
          sourceResourceId: lbId,
          targetResourceId: tgId,
          relationshipType: RELATIONSHIP_TYPES.ROUTES_TO,
        });
      }
    }

    // Edge: TargetGroup → VPC (contained-in)
    const vpcId = tg["VpcId"] as string | undefined;
    if (vpcId) {
      edges.push({
        id: `${tgId}--${RELATIONSHIP_TYPES.CONTAINED_IN}--${vpcId}`,
        sourceResourceId: tgId,
        targetResourceId: vpcId,
        relationshipType: RELATIONSHIP_TYPES.CONTAINED_IN,
      });
    }

    // ─── Target Health (which instances are behind this TG) ─────────────
    try {
      const healthResult = await withRateLimit("elb", () =>
        awsReadOnlyCall<{
          TargetHealthDescriptions?: Array<{
            Target?: { Id?: string };
            TargetHealth?: { State?: string };
          }>;
        }>(
          client,
          new DescribeTargetHealthCommand({ TargetGroupArn: tgArn }),
          "elasticloadbalancing",
          accountId
        )
      );

      for (const desc of healthResult.TargetHealthDescriptions ?? []) {
        const targetId = desc.Target?.Id;
        if (targetId) {
          edges.push({
            id: `${tgId}--${RELATIONSHIP_TYPES.TARGETS}--${targetId}`,
            sourceResourceId: tgId,
            targetResourceId: targetId,
            relationshipType: RELATIONSHIP_TYPES.TARGETS,
          });
        }
      }
    } catch {
      // Non-fatal: some target groups may not have targets
    }
  }

  return { resources, edges };
}
