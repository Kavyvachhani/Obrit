import {
  EC2Client,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeRouteTablesCommand,
  DescribeInternetGatewaysCommand,
  DescribeNatGatewaysCommand,
  DescribeSecurityGroupsCommand,
  DescribeInstancesCommand,
  DescribeNetworkInterfacesCommand,
} from "@aws-sdk/client-ec2";
import type { Resource, Edge } from "@orbit/core";
import { RESOURCE_TYPES, RELATIONSHIP_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

function extractName(tags?: Array<{ Key?: string; Value?: string }>): string {
  return tags?.find((t) => t.Key === "Name")?.Value ?? "";
}

function extractTags(tags?: Array<{ Key?: string; Value?: string }>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const tag of tags ?? []) {
    if (tag.Key) result[tag.Key] = tag.Value ?? "";
  }
  return result;
}

export interface Ec2DiscoveryResult {
  resources: Resource[];
  edges: Edge[];
}

async function safeEc2Call<T>(
  actionName: string,
  fn: () => Promise<T>,
  fallback: T,
  serviceType: string,
  accountId: string,
  region: string,
  resources: Resource[]
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const errName = err?.name || "AccessDenied";
    const errMsg = err?.message || String(err);
    resources.push({
      id: `gap-${actionName.toLowerCase()}-${accountId}`,
      provider: "aws",
      accountId,
      region,
      type: serviceType,
      arn: `arn:aws:ec2:${region}:${accountId}:scan-gap/${actionName.toLowerCase()}`,
      name: `${actionName.replace(/^Describe/, "")} (Scan Gap)`,
      tags: { Status: "Incomplete", Permission: "AccessDenied" },
      rawConfig: { action: actionName, error: errMsg },
      status: "incomplete",
      lastSeenAt: new Date().toISOString(),
      scanError: {
        code: errName.includes("Unauthorized") || errName.includes("AccessDenied") ? "AccessDenied" : errName,
        operation: `ec2:${actionName}`,
        message: `ec2:${actionName} returned ${errName} under current IAM role`,
        suggestedFix: `Attach policy granting ec2:${actionName} to scan IAM role`,
      },
    });
    return fallback;
  }
}

export async function discoverEc2(
  client: EC2Client,
  accountId: string,
  region: string
): Promise<Ec2DiscoveryResult> {
  const resources: Resource[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  // ─── VPCs ────────────────────────────────────────────────────────────────
  const vpcsResult = await safeEc2Call(
    "DescribeVpcs",
    () =>
      withRateLimit("ec2", () =>
        awsReadOnlyCall<{ Vpcs?: Array<Record<string, unknown>> }>(
          client,
          new DescribeVpcsCommand({}),
          "ec2",
          accountId
        )
      ),
    { Vpcs: [] },
    RESOURCE_TYPES.VPC,
    accountId,
    region,
    resources
  );

  for (const vpc of vpcsResult.Vpcs ?? []) {
    const vpcId = vpc["VpcId"] as string;
    resources.push({
      id: vpcId,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.VPC,
      arn: `arn:aws:ec2:${region}:${accountId}:vpc/${vpcId}`,
      name: extractName(vpc["Tags"] as Array<{ Key?: string; Value?: string }>),
      tags: extractTags(vpc["Tags"] as Array<{ Key?: string; Value?: string }>),
      rawConfig: vpc,
      status: (vpc["State"] as string) === "available" ? "healthy" : "unknown",
      lastSeenAt: now,
    });
  }

  // ─── Subnets ─────────────────────────────────────────────────────────────
  const subnetsResult = await safeEc2Call(
    "DescribeSubnets",
    () =>
      withRateLimit("ec2", () =>
        awsReadOnlyCall<{ Subnets?: Array<Record<string, unknown>> }>(
          client,
          new DescribeSubnetsCommand({}),
          "ec2",
          accountId
        )
      ),
    { Subnets: [] },
    RESOURCE_TYPES.SUBNET,
    accountId,
    region,
    resources
  );

  for (const subnet of subnetsResult.Subnets ?? []) {
    const subnetId = subnet["SubnetId"] as string;
    const vpcId = subnet["VpcId"] as string;
    resources.push({
      id: subnetId,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.SUBNET,
      arn: `arn:aws:ec2:${region}:${accountId}:subnet/${subnetId}`,
      name: extractName(subnet["Tags"] as Array<{ Key?: string; Value?: string }>),
      tags: extractTags(subnet["Tags"] as Array<{ Key?: string; Value?: string }>),
      rawConfig: subnet,
      status: (subnet["State"] as string) === "available" ? "healthy" : "unknown",
      lastSeenAt: now,
    });

    // Edge: Subnet → VPC (contained-in)
    edges.push({
      id: `${subnetId}--${RELATIONSHIP_TYPES.CONTAINED_IN}--${vpcId}`,
      sourceResourceId: subnetId,
      targetResourceId: vpcId,
      relationshipType: RELATIONSHIP_TYPES.CONTAINED_IN,
    });
  }

  // ─── Route Tables ────────────────────────────────────────────────────────
  const rtResult = await safeEc2Call(
    "DescribeRouteTables",
    () =>
      withRateLimit("ec2", () =>
        awsReadOnlyCall<{ RouteTables?: Array<Record<string, unknown>> }>(
          client,
          new DescribeRouteTablesCommand({}),
          "ec2",
          accountId
        )
      ),
    { RouteTables: [] },
    RESOURCE_TYPES.ROUTE_TABLE,
    accountId,
    region,
    resources
  );

  for (const rt of rtResult.RouteTables ?? []) {
    const rtId = rt["RouteTableId"] as string;
    const vpcId = rt["VpcId"] as string;
    resources.push({
      id: rtId,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.ROUTE_TABLE,
      arn: `arn:aws:ec2:${region}:${accountId}:route-table/${rtId}`,
      name: extractName(rt["Tags"] as Array<{ Key?: string; Value?: string }>),
      tags: extractTags(rt["Tags"] as Array<{ Key?: string; Value?: string }>),
      rawConfig: rt,
      status: "healthy",
      lastSeenAt: now,
    });

    // Edge: RouteTable → VPC (contained-in)
    edges.push({
      id: `${rtId}--${RELATIONSHIP_TYPES.CONTAINED_IN}--${vpcId}`,
      sourceResourceId: rtId,
      targetResourceId: vpcId,
      relationshipType: RELATIONSHIP_TYPES.CONTAINED_IN,
    });

    // Edge: RouteTable → Subnet (associated-to)
    const associations = rt["Associations"] as
      | Array<{ SubnetId?: string; Main?: boolean }>
      | undefined;
    for (const assoc of associations ?? []) {
      if (assoc.SubnetId) {
        edges.push({
          id: `${rtId}--${RELATIONSHIP_TYPES.ASSOCIATED_TO}--${assoc.SubnetId}`,
          sourceResourceId: rtId,
          targetResourceId: assoc.SubnetId,
          relationshipType: RELATIONSHIP_TYPES.ASSOCIATED_TO,
        });
      }
    }
  }

  // ─── Internet Gateways ───────────────────────────────────────────────────
  const igwResult = await safeEc2Call(
    "DescribeInternetGateways",
    () =>
      withRateLimit("ec2", () =>
        awsReadOnlyCall<{ InternetGateways?: Array<Record<string, unknown>> }>(
          client,
          new DescribeInternetGatewaysCommand({}),
          "ec2",
          accountId
        )
      ),
    { InternetGateways: [] },
    RESOURCE_TYPES.INTERNET_GATEWAY,
    accountId,
    region,
    resources
  );

  for (const igw of igwResult.InternetGateways ?? []) {
    const igwId = igw["InternetGatewayId"] as string;
    resources.push({
      id: igwId,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.INTERNET_GATEWAY,
      arn: `arn:aws:ec2:${region}:${accountId}:internet-gateway/${igwId}`,
      name: extractName(igw["Tags"] as Array<{ Key?: string; Value?: string }>),
      tags: extractTags(igw["Tags"] as Array<{ Key?: string; Value?: string }>),
      rawConfig: igw,
      status: "healthy",
      lastSeenAt: now,
    });

    // Edge: IGW → VPC (attached-to)
    const attachments = igw["Attachments"] as
      | Array<{ VpcId?: string; State?: string }>
      | undefined;
    for (const att of attachments ?? []) {
      if (att.VpcId) {
        edges.push({
          id: `${igwId}--${RELATIONSHIP_TYPES.ATTACHED_TO}--${att.VpcId}`,
          sourceResourceId: igwId,
          targetResourceId: att.VpcId,
          relationshipType: RELATIONSHIP_TYPES.ATTACHED_TO,
        });
      }
    }
  }

  // ─── NAT Gateways ───────────────────────────────────────────────────────
  const natResult = await safeEc2Call(
    "DescribeNatGateways",
    () =>
      withRateLimit("ec2", () =>
        awsReadOnlyCall<{ NatGateways?: Array<Record<string, unknown>> }>(
          client,
          new DescribeNatGatewaysCommand({}),
          "ec2",
          accountId
        )
      ),
    { NatGateways: [] },
    RESOURCE_TYPES.NAT_GATEWAY,
    accountId,
    region,
    resources
  );

  for (const nat of natResult.NatGateways ?? []) {
    const natId = nat["NatGatewayId"] as string;
    const subnetId = nat["SubnetId"] as string;
    const vpcId = nat["VpcId"] as string;
    resources.push({
      id: natId,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.NAT_GATEWAY,
      arn: `arn:aws:ec2:${region}:${accountId}:natgateway/${natId}`,
      name: extractName(nat["Tags"] as Array<{ Key?: string; Value?: string }>),
      tags: extractTags(nat["Tags"] as Array<{ Key?: string; Value?: string }>),
      rawConfig: nat,
      status: (nat["State"] as string) === "available" ? "healthy" : "degraded",
      lastSeenAt: now,
    });

    // Edge: NatGW → Subnet (located-in)
    if (subnetId) {
      edges.push({
        id: `${natId}--${RELATIONSHIP_TYPES.LOCATED_IN}--${subnetId}`,
        sourceResourceId: natId,
        targetResourceId: subnetId,
        relationshipType: RELATIONSHIP_TYPES.LOCATED_IN,
      });
    }

    // Edge: NatGW → VPC (contained-in)
    if (vpcId) {
      edges.push({
        id: `${natId}--${RELATIONSHIP_TYPES.CONTAINED_IN}--${vpcId}`,
        sourceResourceId: natId,
        targetResourceId: vpcId,
        relationshipType: RELATIONSHIP_TYPES.CONTAINED_IN,
      });
    }
  }

  // ─── Security Groups ─────────────────────────────────────────────────────
  const sgResult = await safeEc2Call(
    "DescribeSecurityGroups",
    () =>
      withRateLimit("ec2", () =>
        awsReadOnlyCall<{ SecurityGroups?: Array<Record<string, unknown>> }>(
          client,
          new DescribeSecurityGroupsCommand({}),
          "ec2",
          accountId
        )
      ),
    { SecurityGroups: [] },
    RESOURCE_TYPES.SECURITY_GROUP,
    accountId,
    region,
    resources
  );

  for (const sg of sgResult.SecurityGroups ?? []) {
    const sgId = sg["GroupId"] as string;
    const vpcId = sg["VpcId"] as string;
    resources.push({
      id: sgId,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.SECURITY_GROUP,
      arn: `arn:aws:ec2:${region}:${accountId}:security-group/${sgId}`,
      name: (sg["GroupName"] as string) ?? "",
      tags: extractTags(sg["Tags"] as Array<{ Key?: string; Value?: string }>),
      rawConfig: sg,
      status: "healthy",
      lastSeenAt: now,
    });

    // Edge: SG → VPC (contained-in)
    if (vpcId) {
      edges.push({
        id: `${sgId}--${RELATIONSHIP_TYPES.CONTAINED_IN}--${vpcId}`,
        sourceResourceId: sgId,
        targetResourceId: vpcId,
        relationshipType: RELATIONSHIP_TYPES.CONTAINED_IN,
      });
    }
  }

  // ─── EC2 Instances ───────────────────────────────────────────────────────
  const instancesResult = await safeEc2Call(
    "DescribeInstances",
    () =>
      withRateLimit("ec2", () =>
        awsReadOnlyCall<{ Reservations?: Array<{ Instances?: Array<Record<string, unknown>> }> }>(
          client,
          new DescribeInstancesCommand({}),
          "ec2",
          accountId
        )
      ),
    { Reservations: [] },
    RESOURCE_TYPES.EC2_INSTANCE,
    accountId,
    region,
    resources
  );

  for (const reservation of instancesResult.Reservations ?? []) {
    for (const instance of reservation.Instances ?? []) {
      const instanceId = instance["InstanceId"] as string;
      const subnetId = instance["SubnetId"] as string | undefined;
      const vpcId = instance["VpcId"] as string | undefined;
      const state = (instance["State"] as { Name?: string })?.Name;

      resources.push({
        id: instanceId,
        provider: "aws",
        accountId,
        region,
        type: RESOURCE_TYPES.EC2_INSTANCE,
        arn: `arn:aws:ec2:${region}:${accountId}:instance/${instanceId}`,
        name: extractName(instance["Tags"] as Array<{ Key?: string; Value?: string }>),
        tags: extractTags(instance["Tags"] as Array<{ Key?: string; Value?: string }>),
        rawConfig: instance,
        status: state === "running" ? "healthy" : state === "stopped" ? "degraded" : "unknown",
        lastSeenAt: now,
      });

      // Edge: Instance → Subnet (contained-in)
      if (subnetId) {
        edges.push({
          id: `${instanceId}--${RELATIONSHIP_TYPES.CONTAINED_IN}--${subnetId}`,
          sourceResourceId: instanceId,
          targetResourceId: subnetId,
          relationshipType: RELATIONSHIP_TYPES.CONTAINED_IN,
        });
      }

      // Edge: Instance → VPC (contained-in)
      if (vpcId) {
        edges.push({
          id: `${instanceId}--${RELATIONSHIP_TYPES.CONTAINED_IN}--${vpcId}`,
          sourceResourceId: instanceId,
          targetResourceId: vpcId,
          relationshipType: RELATIONSHIP_TYPES.CONTAINED_IN,
        });
      }

      // Edge: Instance → Security Groups (member-of)
      const sgs = instance["SecurityGroups"] as
        | Array<{ GroupId?: string }>
        | undefined;
      for (const sg of sgs ?? []) {
        if (sg.GroupId) {
          edges.push({
            id: `${instanceId}--${RELATIONSHIP_TYPES.MEMBER_OF}--${sg.GroupId}`,
            sourceResourceId: instanceId,
            targetResourceId: sg.GroupId,
            relationshipType: RELATIONSHIP_TYPES.MEMBER_OF,
          });
        }
      }

      // Edge: Instance → ENIs (has-interface)
      const enis = instance["NetworkInterfaces"] as
        | Array<{ NetworkInterfaceId?: string }>
        | undefined;
      for (const eni of enis ?? []) {
        if (eni.NetworkInterfaceId) {
          edges.push({
            id: `${instanceId}--${RELATIONSHIP_TYPES.HAS_INTERFACE}--${eni.NetworkInterfaceId}`,
            sourceResourceId: instanceId,
            targetResourceId: eni.NetworkInterfaceId,
            relationshipType: RELATIONSHIP_TYPES.HAS_INTERFACE,
          });
        }
      }
    }
  }

  // ─── Network Interfaces ──────────────────────────────────────────────────
  const eniResult = await safeEc2Call(
    "DescribeNetworkInterfaces",
    () =>
      withRateLimit("ec2", () =>
        awsReadOnlyCall<{ NetworkInterfaces?: Array<Record<string, unknown>> }>(
          client,
          new DescribeNetworkInterfacesCommand({}),
          "ec2",
          accountId
        )
      ),
    { NetworkInterfaces: [] },
    RESOURCE_TYPES.NETWORK_INTERFACE,
    accountId,
    region,
    resources
  );

  for (const eni of eniResult.NetworkInterfaces ?? []) {
    const eniId = eni["NetworkInterfaceId"] as string;
    const subnetId = eni["SubnetId"] as string | undefined;
    const vpcId = eni["VpcId"] as string | undefined;

    resources.push({
      id: eniId,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.NETWORK_INTERFACE,
      arn: `arn:aws:ec2:${region}:${accountId}:network-interface/${eniId}`,
      name: (eni["Description"] as string) ?? "",
      tags: extractTags(eni["Tags"] as Array<{ Key?: string; Value?: string }>),
      rawConfig: eni,
      status: (eni["Status"] as string) === "in-use" ? "healthy" : "unknown",
      lastSeenAt: now,
    });

    // Edge: ENI → Subnet (contained-in)
    if (subnetId) {
      edges.push({
        id: `${eniId}--${RELATIONSHIP_TYPES.CONTAINED_IN}--${subnetId}`,
        sourceResourceId: eniId,
        targetResourceId: subnetId,
        relationshipType: RELATIONSHIP_TYPES.CONTAINED_IN,
      });
    }

    // Edge: ENI → VPC (contained-in)
    if (vpcId) {
      edges.push({
        id: `${eniId}--${RELATIONSHIP_TYPES.CONTAINED_IN}--${vpcId}`,
        sourceResourceId: eniId,
        targetResourceId: vpcId,
        relationshipType: RELATIONSHIP_TYPES.CONTAINED_IN,
      });
    }

    // Edge: ENI → Security Groups (attached-to)
    const sgs = eni["Groups"] as Array<{ GroupId?: string }> | undefined;
    for (const sg of sgs ?? []) {
      if (sg.GroupId) {
        edges.push({
          id: `${eniId}--${RELATIONSHIP_TYPES.ATTACHED_TO}--${sg.GroupId}`,
          sourceResourceId: eniId,
          targetResourceId: sg.GroupId,
          relationshipType: RELATIONSHIP_TYPES.ATTACHED_TO,
        });
      }
    }
  }

  return { resources, edges };
}
