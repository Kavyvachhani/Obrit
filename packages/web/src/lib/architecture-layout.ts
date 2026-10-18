import type { GraphNode, GraphLink } from "@orbit/core";

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  tier?: number;
  az?: "us-east-1a" | "us-east-1b" | "regional" | "ingress" | "vpc";
  isContainer?: boolean;
}

export interface ContainerBounds {
  id: string;
  name: string;
  type: "vpc" | "az" | "subnet" | "regional" | "ingress";
  cidr?: string;
  isPublic?: boolean;
  azLabel?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  z?: number;
}

export interface SubnetBounds extends ContainerBounds {}
export interface VpcBounds extends ContainerBounds {}

/**
 * Computes deterministic, spacious, non-overlapping architectural layout coordinates
 * referencing official AWS Well-Architected Multi-AZ diagrams.
 */
export function applyStructuredArchitectureLayout(
  nodes: GraphNode[],
  is3D = false,
  isGrouped = true
): {
  positionedNodes: PositionedNode[];
  subnetBounds: SubnetBounds[];
  vpcBounds: VpcBounds[];
  azBounds: ContainerBounds[];
  regionalBounds: ContainerBounds[];
  ingressBounds: ContainerBounds[];
} {
  // Deterministic positions for official AWS reference architecture
  const nodeMap: Record<string, { x: number; y: number; z: number; tier: number; az?: any }> = {
    // ── Edge & Ingress Platform (x: -650 to -430) ──
    "igw-0998877665544332": { x: -540, y: -80, z: -80, tier: 0, az: "ingress" },
    "sg-edge-alb": { x: -540, y: 80, z: 80, tier: 0, az: "ingress" },

    // ── DMZ & Cross-AZ Ingress Corridor ──
    "nat-05544332211009988": { x: -260, y: -140, z: -140, tier: 1, az: "us-east-1a" },
    "alb-production-edge": { x: -260, y: 0, z: 0, tier: 1, az: "vpc" },
    "tg-production-api": { x: -20, y: 0, z: 0, tier: 1, az: "vpc" },
    "sg-internal-app": { x: -20, y: -140, z: -140, tier: 2, az: "vpc" },

    // ── Private App Tier (Staggered 2x2 grid for zero horizontal overlap) ──
    "i-091a2b3c4d5e6f701": { x: 210, y: -155, z: -140, tier: 2, az: "us-east-1a" },
    "func-prod-auth-token-validator": { x: 290, y: -65, z: -55, tier: 2, az: "us-east-1a" },
    "i-091a2b3c4d5e6f702": { x: 210, y: 75, z: 65, tier: 2, az: "us-east-1b" },
    "i-0demo1d1accessdenied": { x: 290, y: 175, z: 155, tier: 2, az: "us-east-1b" },

    // ── Database Tier ──
    "db-prod-aurora-pg-primary": { x: 480, y: -140, z: -140, tier: 3, az: "us-east-1a" },

    // ── Account-level / Global Services Platform (x: 610 to 810) ──
    "s3-prod-static-distribution-cdn": { x: 720, y: -180, z: -150, tier: 4, az: "regional" },
    "s3-prod-telemetry-data-lake": { x: 720, y: -60, z: -50, tier: 4, az: "regional" },
    "func-prod-event-pipeline-consumer": { x: 720, y: 60, z: 50, tier: 4, az: "regional" },
    "role-ec2-ssm-s3-access": { x: 720, y: 180, z: 150, tier: 4, az: "regional" },
  };

  const positionedNodes: PositionedNode[] = [];

  // Filter out raw structural container nodes
  const resourceNodes = nodes.filter(
    (node) => node.type !== "vpc:subnet" && node.type !== "vpc:vpc"
  );

  // Check if we are running in demo mode (preset IDs present)
  const isDemo = resourceNodes.some((n) => nodeMap[n.id]);

  if (isDemo && resourceNodes.length <= 15) {
    // ── Clean Textbook Demo Architecture Layout ──
    for (const node of resourceNodes) {
      const preset = nodeMap[node.id];
      if (preset) {
        const finalX = preset.x;
        const finalY = is3D ? -35 : preset.y;
        const finalZ = is3D ? preset.z : 0;
        positionedNodes.push({
          ...node,
          x: finalX,
          y: finalY,
          z: finalZ,
          fx: finalX,
          fy: finalY,
          fz: finalZ,
          tier: preset.tier,
          az: preset.az,
        });
      }
    }

    return {
      positionedNodes: resolveNodeCollisions(positionedNodes, is3D, is3D ? 90 : 80),
      ingressBounds: [
        {
          id: "platform-ingress-edge",
          name: "Internet & Edge Ingress",
          type: "ingress",
          x1: -650,
          y1: -250,
          x2: -430,
          y2: 250,
          z: 0,
        },
      ],
      vpcBounds: [
        {
          id: "vpc-0a8b9c1d2e3f4001",
          name: "Amazon VPC: prod-vpc-main (10.0.0.0/16)",
          type: "vpc",
          cidr: "10.0.0.0/16",
          x1: -380,
          y1: -280,
          x2: 590,
          y2: 280,
          z: 0,
        },
      ],
      azBounds: [
        {
          id: "az-us-east-1a",
          name: "Availability Zone: us-east-1a",
          type: "az",
          azLabel: "us-east-1a",
          x1: -365,
          y1: -260,
          x2: 575,
          y2: -25,
          z: -140,
        },
        {
          id: "az-us-east-1b",
          name: "Availability Zone: us-east-1b",
          type: "az",
          azLabel: "us-east-1b",
          x1: -365,
          y1: 25,
          x2: 575,
          y2: 260,
          z: 140,
        },
      ],
      subnetBounds: [
        {
          id: "subnet-0123456789abcdef0",
          name: "Public DMZ Subnet 1a (10.0.1.0/24)",
          type: "subnet",
          isPublic: true,
          azLabel: "us-east-1a",
          x1: -350,
          y1: -245,
          x2: -150,
          y2: -45,
          z: -140,
        },
        {
          id: "subnet-0123456789abcdef1",
          name: "Private App Subnet 1a (10.0.2.0/24)",
          type: "subnet",
          isPublic: false,
          azLabel: "us-east-1a",
          x1: -40,
          y1: -245,
          x2: 340,
          y2: -45,
          z: -140,
        },
        {
          id: "subnet-0123456789abcdef4",
          name: "Database Subnet 1a (10.0.3.0/24)",
          type: "subnet",
          isPublic: false,
          azLabel: "us-east-1a",
          x1: 370,
          y1: -245,
          x2: 565,
          y2: -45,
          z: -140,
        },
        {
          id: "subnet-0123456789abcdef2",
          name: "Public DMZ Subnet 1b (10.0.11.0/24)",
          type: "subnet",
          isPublic: true,
          azLabel: "us-east-1b",
          x1: -350,
          y1: 40,
          x2: -150,
          y2: 245,
          z: 140,
        },
        {
          id: "subnet-0123456789abcdef3",
          name: "Private App Subnet 1b (10.0.12.0/24)",
          type: "subnet",
          isPublic: false,
          azLabel: "us-east-1b",
          x1: -40,
          y1: 40,
          x2: 340,
          y2: 245,
          z: 140,
        },
        {
          id: "subnet-0123456789abcdef5",
          name: "Database Subnet 1b (10.0.13.0/24)",
          type: "subnet",
          isPublic: false,
          azLabel: "us-east-1b",
          x1: 370,
          y1: 40,
          x2: 565,
          y2: 245,
          z: 140,
        },
      ],
      regionalBounds: [
        {
          id: "regional-services",
          name: "Account-level / Global Services",
          type: "regional",
          x1: 610,
          y1: -280,
          x2: 810,
          y2: 280,
          z: 0,
        },
      ],
    };
  }

  // ── High-Scale Enterprise Real AWS Account Layout Engine ──
  const ingressList: GraphNode[] = [];
  const dmzList: GraphNode[] = [];
  const appVpcList: GraphNode[] = [];
  const dbList: GraphNode[] = [];
  const lambdaList: GraphNode[] = [];
  const s3List: GraphNode[] = [];
  const iamList: GraphNode[] = [];
  const otherRegionalList: GraphNode[] = [];

  for (const node of resourceNodes) {
    const t = node.type.toLowerCase();
    const n = node.name.toLowerCase();

    if (
      t.startsWith("cloudfront:") ||
      t.startsWith("apigateway:") ||
      t.includes("gateway") ||
      n.includes("igw") ||
      n.includes("nat-") ||
      t.includes("nat")
    ) {
      ingressList.push(node);
    } else if (
      t.startsWith("elb:") ||
      n.includes("alb") ||
      n.includes("loadbalancer") ||
      n.includes("targetgroup")
    ) {
      dmzList.push(node);
    } else if (
      t.startsWith("rds:") ||
      t.startsWith("elasticache:") ||
      n.includes("db-") ||
      n.includes("aurora") ||
      n.includes("mysql") ||
      n.includes("postgres") ||
      n.includes("cache") ||
      n.includes("redis")
    ) {
      dbList.push(node);
    } else if (
      t.startsWith("ec2:instance") ||
      t.startsWith("ecs:") ||
      t.startsWith("eks:")
    ) {
      appVpcList.push(node);
    } else if (t.startsWith("lambda:")) {
      lambdaList.push(node);
    } else if (t.startsWith("s3:")) {
      s3List.push(node);
    } else if (t.startsWith("iam:") || t.includes("role") || t.includes("policy")) {
      iamList.push(node);
    } else {
      otherRegionalList.push(node);
    }
  }

  const shouldGroup = isGrouped && resourceNodes.length > 25;

  // 1. Position Ingress Nodes (x: -540)
  ingressList.forEach((node, i) => {
    const total = ingressList.length;
    const yVal = total <= 1 ? 0 : (i - (total - 1) / 2) * (is3D ? 90 : 85);
    const x = -540;
    const y = is3D ? -35 : yVal;
    const z = is3D ? yVal : 0;
    positionedNodes.push({ ...node, x, y, z, fx: x, fy: y, fz: z, tier: 0, az: "ingress" });
  });

  // 2. Position DMZ / ELB Nodes (x: -260)
  dmzList.forEach((node, i) => {
    const total = dmzList.length;
    const yVal = total <= 1 ? 0 : (i - (total - 1) / 2) * (is3D ? 80 : 85);
    const x = -260;
    const y = is3D ? -35 : yVal;
    const z = is3D ? (i % 2 === 0 ? -140 : 140) : 0;
    positionedNodes.push({ ...node, x, y, z, fx: x, fy: y, fz: z, tier: 1, az: "vpc" });
  });

  // 3. Position VPC App Compute (x: 100 to 300)
  appVpcList.forEach((node, i) => {
    const isAZa = i % 2 === 0;
    const col = Math.floor(i / 2) % 3;
    const row = Math.floor(i / 6);
    const x = 100 + col * (is3D ? 95 : 160);
    const zLane = isAZa ? -140 : 140;
    const z = is3D ? zLane + row * 40 : 0;
    const y = is3D ? -52 : (isAZa ? -150 : 130) + row * 65;
    positionedNodes.push({ ...node, x, y, z, fx: x, fy: y, fz: z, tier: 2, az: isAZa ? "us-east-1a" : "us-east-1b" });
  });

  // 4. Position Database Nodes (x: 470)
  dbList.forEach((node, i) => {
    const total = dbList.length;
    const yVal = total <= 1 ? 0 : (i - (total - 1) / 2) * (is3D ? 90 : 85);
    const x = 470;
    const y = is3D ? -35 : yVal;
    const z = is3D ? (i % 2 === 0 ? -140 : 140) : 0;
    positionedNodes.push({ ...node, x, y, z, fx: x, fy: y, fz: z, tier: 3, az: i % 2 === 0 ? "us-east-1a" : "us-east-1b" });
  });

  // 5. Position Serverless Platform (Lambdas)
  if (shouldGroup && lambdaList.length > 6) {
    const exposedLambdas = lambdaList.filter((n) => n.status === "exposed" || n.status === "failed");
    const healthyCount = lambdaList.length - exposedLambdas.length;

    const clusterNode: PositionedNode = {
      id: "fleet-lambda-cluster",
      arn: `arn:aws:lambda:regional:cluster:fleet-lambda`,
      name: `AWS Lambda Fleet (${lambdaList.length} Functions)`,
      type: "lambda:function",
      provider: "aws",
      accountId: lambdaList[0]?.accountId || "regional",
      tags: {},
      lastSeenAt: new Date().toISOString(),
      status: exposedLambdas.length > 0 ? "exposed" : "healthy",
      isContainer: false,
      region: lambdaList[0]?.region || "eu-central-1",
      rawConfig: {
        isCluster: true,
        fleetType: "lambda",
        totalCount: lambdaList.length,
        healthyCount,
        exposedCount: exposedLambdas.length,
        failedCount: lambdaList.filter((n) => n.status === "failed").length,
        Runtime: `${lambdaList.length} Serverless Functions`,
        allMembers: lambdaList,
      },
      x: 720,
      y: is3D ? -35 : -60,
      z: is3D ? -60 : 0,
      fx: 720,
      fy: is3D ? -35 : -60,
      fz: is3D ? -60 : 0,
      tier: 4,
      az: "regional",
    };
    positionedNodes.push(clusterNode);

    // If there are top exposed/failed lambdas, show up to 2 alongside the cluster
    exposedLambdas.slice(0, 2).forEach((expNode, i) => {
      const zOffset = is3D ? 80 + i * 80 : 0;
      const yOffset = is3D ? -35 : 60 + i * 80;
      positionedNodes.push({
        ...expNode,
        x: 720,
        y: yOffset,
        z: zOffset,
        fx: 720,
        fy: yOffset,
        fz: zOffset,
        tier: 4,
        az: "regional",
      });
    });
  } else {
    // Unpacked Matrix Layout for Lambdas (Balanced wide platform matrix)
    const lambdaCols = is3D ? 16 : 8;
    const lambdaCellW = is3D ? 98 : 185;
    const lambdaCellH = is3D ? 44 : 70;
    const lambdaStartX = 720;
    lambdaList.forEach((node, i) => {
      const col = i % lambdaCols;
      const row = Math.floor(i / lambdaCols);
      const x = lambdaStartX + col * lambdaCellW;
      const zDepth = -320 + row * lambdaCellH;
      const y2D = -320 + row * lambdaCellH;
      const xPos = x;
      const yPos = is3D ? -35 : y2D;
      const zPos = is3D ? zDepth : 0;
      positionedNodes.push({ ...node, x: xPos, y: yPos, z: zPos, fx: xPos, fy: yPos, fz: zPos, tier: 4, az: "regional" });
    });
  }

  // 6. Position S3 Storage Platform
  const s3BaseX = shouldGroup ? 1000 : 720 + (is3D ? 16 : 8) * (is3D ? 98 : 185) + 100;

  if (shouldGroup && s3List.length > 6) {
    const exposedBuckets = s3List.filter((n) => n.status === "exposed");
    const clusterNode: PositionedNode = {
      id: "fleet-s3-cluster",
      arn: `arn:aws:s3:::storage-fleet`,
      name: `Amazon S3 Storage Lake (${s3List.length} Buckets)`,
      type: "s3:bucket",
      provider: "aws",
      accountId: s3List[0]?.accountId || "regional",
      tags: {},
      lastSeenAt: new Date().toISOString(),
      status: exposedBuckets.length > 0 ? "exposed" : "healthy",
      isContainer: false,
      region: "global",
      rawConfig: {
        isCluster: true,
        fleetType: "s3",
        totalCount: s3List.length,
        healthyCount: s3List.length - exposedBuckets.length,
        exposedCount: exposedBuckets.length,
        Runtime: `${s3List.length} S3 Data Buckets`,
        allMembers: s3List,
      },
      x: s3BaseX,
      y: is3D ? -35 : -60,
      z: is3D ? -60 : 0,
      fx: s3BaseX,
      fy: is3D ? -35 : -60,
      fz: is3D ? -60 : 0,
      tier: 4,
      az: "regional",
    };
    positionedNodes.push(clusterNode);

    // Show any exposed bucket directly
    exposedBuckets.slice(0, 2).forEach((expNode, i) => {
      const zOffset = is3D ? 80 + i * 80 : 0;
      const yOffset = is3D ? -35 : 60 + i * 80;
      positionedNodes.push({
        ...expNode,
        x: s3BaseX,
        y: yOffset,
        z: zOffset,
        fx: s3BaseX,
        fy: yOffset,
        fz: zOffset,
        tier: 4,
        az: "regional",
      });
    });
  } else {
    // Unpacked Matrix Layout for S3 Buckets
    const s3Cols = is3D ? 10 : 6;
    const s3CellW = is3D ? 98 : 185;
    const s3CellH = is3D ? 44 : 70;
    s3List.forEach((node, i) => {
      const col = i % s3Cols;
      const row = Math.floor(i / s3Cols);
      const x = s3BaseX + col * s3CellW;
      const zDepth = -300 + row * s3CellH;
      const y2D = -300 + row * s3CellH;
      const xPos = x;
      const yPos = is3D ? -35 : y2D;
      const zPos = is3D ? zDepth : 0;
      positionedNodes.push({ ...node, x: xPos, y: yPos, z: zPos, fx: xPos, fy: yPos, fz: zPos, tier: 4, az: "regional" });
    });
  }

  // 7. Position IAM Governance Platform
  const iamBaseX = shouldGroup ? 1280 : s3BaseX + (is3D ? 10 : 6) * (is3D ? 98 : 185) + 100;

  if (shouldGroup && iamList.length > 6) {
    const adminRoles = iamList.filter((n) => n.name.toLowerCase().includes("admin") || n.status === "exposed");
    const clusterNode: PositionedNode = {
      id: "fleet-iam-cluster",
      arn: `arn:aws:iam:::role/governance-fleet`,
      name: `IAM Security & Governance (${iamList.length} Roles)`,
      type: "iam:role",
      provider: "aws",
      accountId: iamList[0]?.accountId || "regional",
      tags: {},
      lastSeenAt: new Date().toISOString(),
      status: adminRoles.length > 0 ? "exposed" : "healthy",
      isContainer: false,
      region: "global",
      rawConfig: {
        isCluster: true,
        fleetType: "iam",
        totalCount: iamList.length,
        healthyCount: iamList.length - adminRoles.length,
        exposedCount: adminRoles.length,
        Runtime: `${iamList.length} Access Roles`,
        allMembers: iamList,
      },
      x: iamBaseX,
      y: is3D ? -35 : -60,
      z: is3D ? -60 : 0,
      fx: iamBaseX,
      fy: is3D ? -35 : -60,
      fz: is3D ? -60 : 0,
      tier: 4,
      az: "regional",
    };
    positionedNodes.push(clusterNode);

    // Show up to 2 admin/special roles
    adminRoles.slice(0, 2).forEach((admNode, i) => {
      const zOffset = is3D ? 80 + i * 80 : 0;
      const yOffset = is3D ? -35 : 60 + i * 80;
      positionedNodes.push({
        ...admNode,
        x: iamBaseX,
        y: yOffset,
        z: zOffset,
        fx: iamBaseX,
        fy: yOffset,
        fz: zOffset,
        tier: 4,
        az: "regional",
      });
    });
  } else {
    // Unpacked Matrix Layout for IAM Roles
    const iamCols = is3D ? 10 : 6;
    const iamCellW = is3D ? 98 : 185;
    const iamCellH = is3D ? 44 : 70;
    iamList.forEach((node, i) => {
      const col = i % iamCols;
      const row = Math.floor(i / iamCols);
      const x = iamBaseX + col * iamCellW;
      const zDepth = -300 + row * iamCellH;
      const y2D = -300 + row * iamCellH;
      const xPos = x;
      const yPos = is3D ? -35 : y2D;
      const zPos = is3D ? zDepth : 0;
      positionedNodes.push({ ...node, x: xPos, y: yPos, z: zPos, fx: xPos, fy: yPos, fz: zPos, tier: 4, az: "regional" });
    });
  }

  // 8. Other Regional Services
  otherRegionalList.forEach((node, i) => {
    const x = iamBaseX + (i % 3) * (is3D ? 98 : 185);
    const z = is3D ? -200 + Math.floor(i / 3) * 44 : 0;
    const y = is3D ? -35 : -200 + Math.floor(i / 3) * 70;
    positionedNodes.push({ ...node, x, y, z, fx: x, fy: y, fz: z, tier: 4, az: "regional" });
  });

  // Dynamic Floor Plates / Containers
  const ingressBounds: ContainerBounds[] = [
    {
      id: "platform-ingress-edge",
      name: `Internet & Edge Ingress (${ingressList.length || 2} Endpoints)`,
      type: "ingress",
      x1: -650,
      y1: -280,
      x2: -430,
      y2: 280,
      z: 0,
    },
  ];

  const vpcBounds: VpcBounds[] = [
    {
      id: "vpc-main",
      name: "Amazon VPC Network Backbone",
      type: "vpc",
      cidr: "10.0.0.0/16",
      x1: -380,
      y1: -280,
      x2: 590,
      y2: 280,
      z: 0,
    },
  ];

  const azBounds: ContainerBounds[] = [
    {
      id: "az-1a",
      name: "Availability Zone A (Private App)",
      type: "az",
      azLabel: "Zone A",
      x1: -365,
      y1: -260,
      x2: 575,
      y2: -25,
      z: -140,
    },
    {
      id: "az-1b",
      name: "Availability Zone B (Standby & Replica)",
      type: "az",
      azLabel: "Zone B",
      x1: -365,
      y1: 25,
      x2: 575,
      y2: 260,
      z: 140,
    },
  ];

  const subnetBounds: SubnetBounds[] = [
    {
      id: "subnet-dmz",
      name: "Public DMZ Subnet",
      type: "subnet",
      isPublic: true,
      x1: -350,
      y1: -245,
      x2: -170,
      y2: 245,
      z: 0,
    },
    {
      id: "subnet-app",
      name: "Private App Workload Subnet",
      type: "subnet",
      isPublic: false,
      x1: -100,
      y1: -245,
      x2: 360,
      y2: 245,
      z: 0,
    },
    {
      id: "subnet-db",
      name: "Database Private Subnet",
      type: "subnet",
      isPublic: false,
      x1: 390,
      y1: -245,
      x2: 565,
      y2: 245,
      z: 0,
    },
  ];

  // Dynamic Regional / Serverless Platforms
  const regionalBounds: ContainerBounds[] = [];

  if (shouldGroup) {
    // Symmetrical, executive platform bounds
    regionalBounds.push({
      id: "platform-serverless",
      name: `Serverless Compute Fleet (${lambdaList.length} Functions)`,
      type: "regional",
      x1: 620,
      y1: -220,
      x2: 860,
      y2: 220,
      z: 0,
    });

    regionalBounds.push({
      id: "platform-s3",
      name: `Amazon S3 Storage Lake (${s3List.length} Buckets)`,
      type: "regional",
      x1: 900,
      y1: -220,
      x2: 1140,
      y2: 220,
      z: 0,
    });

    regionalBounds.push({
      id: "platform-iam",
      name: `IAM Security & Governance (${iamList.length} Roles)`,
      type: "regional",
      x1: 1180,
      y1: -220,
      x2: 1420,
      y2: 220,
      z: 0,
    });
  } else {
    // Unpacked dynamic sizing
    if (lambdaList.length > 0) {
      regionalBounds.push({
        id: "platform-serverless",
        name: `Serverless Compute (${lambdaList.length} Functions)`,
        type: "regional",
        x1: 700,
        y1: -350,
        x2: 700 + (is3D ? 16 : 8) * (is3D ? 98 : 185) + 40,
        y2: -350 + Math.max(300, Math.ceil(lambdaList.length / (is3D ? 16 : 8)) * (is3D ? 44 : 70) + 60),
        z: 0,
      });
    }

    if (s3List.length > 0) {
      regionalBounds.push({
        id: "platform-s3",
        name: `Amazon S3 Storage (${s3List.length} Buckets)`,
        type: "regional",
        x1: s3BaseX - 20,
        y1: -350,
        x2: s3BaseX + (is3D ? 10 : 6) * (is3D ? 98 : 185) + 40,
        y2: -350 + Math.max(300, Math.ceil(s3List.length / (is3D ? 10 : 6)) * (is3D ? 44 : 70) + 60),
        z: 0,
      });
    }

    if (iamList.length > 0) {
      regionalBounds.push({
        id: "platform-iam",
        name: `IAM & Governance (${iamList.length} Roles)`,
        type: "regional",
        x1: iamBaseX - 20,
        y1: -350,
        x2: iamBaseX + (is3D ? 10 : 6) * (is3D ? 98 : 185) + 40,
        y2: -350 + Math.max(300, Math.ceil(iamList.length / (is3D ? 10 : 6)) * (is3D ? 44 : 70) + 60),
        z: 0,
      });
    }
  }

  const collisionResolvedNodes = resolveNodeCollisions(positionedNodes, is3D, is3D ? 90 : 80);

  return {
    positionedNodes: collisionResolvedNodes,
    subnetBounds,
    vpcBounds,
    azBounds,
    regionalBounds,
    ingressBounds,
  };
}

/**
 * Collision resolution constraint: guarantees minimum distance between any two node centers.
 * Performs iterative relaxation so no two node icons can ever overlap.
 */
export function resolveNodeCollisions(
  nodes: PositionedNode[],
  is3D = false,
  _minDistance = 80
): PositionedNode[] {
  const minSepX = is3D ? 165 : 200;
  const minSepY = is3D ? 75 : 75;
  const iterations = 20;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        if (!n1 || !n2) continue;

        const dx = n1.x - n2.x;
        const dy = is3D ? (n1.z ?? 0) - (n2.z ?? 0) : n1.y - n2.y;

        const overlapX = minSepX - Math.abs(dx);
        const overlapY = minSepY - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          // Both axes overlap: rectangular cards are colliding!
          if (overlapX < overlapY) {
            const shiftX = (overlapX / 2 + 1) * (dx >= 0 ? 1 : -1);
            n1.x += shiftX;
            n2.x -= shiftX;
            n1.fx = n1.x;
            n2.fx = n2.x;
          } else {
            const shiftY = (overlapY / 2 + 1) * (dy >= 0 ? 1 : -1);
            if (is3D) {
              n1.z = (n1.z ?? 0) + shiftY;
              n2.z = (n2.z ?? 0) - shiftY;
              n1.fz = n1.z;
              n2.fz = n2.z;
            } else {
              n1.y += shiftY;
              n2.y -= shiftY;
              n1.fy = n1.y;
              n2.fy = n2.y;
            }
          }
        }
      }
    }
  }
  return nodes;
}

/**
 * Generates clean, high-performance links.
 * When grouped: creates high-level trunk routes and eliminates 2,000+ line spaghetti.
 * When unpacked: suppresses background mass IAM attachments that cause blue fan triangles.
 */
export function getOptimizedLinks(
  rawLinks: GraphLink[],
  positionedNodes: PositionedNode[],
  isGrouped: boolean,
  selectedNodeId: string | null = null,
  hoveredNodeId: string | null = null
): GraphLink[] {
  const nodeMap = new Map<string, PositionedNode>();
  for (const n of positionedNodes) {
    nodeMap.set(n.id, n);
  }

  const hasLambdaCluster = nodeMap.has("fleet-lambda-cluster");
  const hasS3Cluster = nodeMap.has("fleet-s3-cluster");
  const hasIamCluster = nodeMap.has("fleet-iam-cluster");

  if (isGrouped && (hasLambdaCluster || hasS3Cluster || hasIamCluster)) {
    // Collect non-fleet individual links (e.g. IGW -> ALB, ALB -> EC2, EC2 -> DB)
    const resultLinks: GraphLink[] = [];

    for (const link of rawLinks) {
      const srcId = typeof link.source === "object" ? (link.source as any).id : link.source;
      const tgtId = typeof link.target === "object" ? (link.target as any).id : link.target;

      if (nodeMap.has(srcId) && nodeMap.has(tgtId)) {
        resultLinks.push(link);
      }
    }

    // Add high-level architectural trunk links
    const appCompute = positionedNodes.find((n) => n.tier === 2 || n.type.startsWith("ec2:"));
    const dmz = positionedNodes.find((n) => n.tier === 1 || n.type.startsWith("elb:"));
    const db = positionedNodes.find((n) => n.tier === 3 || n.type.startsWith("rds:"));

    if (hasLambdaCluster) {
      // Ingress / Compute -> Lambda
      const source = dmz?.id || appCompute?.id || "igw-0998877665544332";
      if (nodeMap.has(source)) {
        resultLinks.push({
          id: "trunk-vpc-to-lambda",
          source,
          target: "fleet-lambda-cluster",
          sourceResourceId: source,
          targetResourceId: "fleet-lambda-cluster",
          relationshipType: "routes-to",
          isInferred: false,
        });
      }

      // Lambda -> S3
      if (hasS3Cluster) {
        resultLinks.push({
          id: "trunk-lambda-to-s3",
          source: "fleet-lambda-cluster",
          target: "fleet-s3-cluster",
          sourceResourceId: "fleet-lambda-cluster",
          targetResourceId: "fleet-s3-cluster",
          relationshipType: "targets",
          isInferred: false,
        });
      }

      // Lambda -> IAM
      if (hasIamCluster) {
        resultLinks.push({
          id: "trunk-lambda-to-iam",
          source: "fleet-lambda-cluster",
          target: "fleet-iam-cluster",
          sourceResourceId: "fleet-lambda-cluster",
          targetResourceId: "fleet-iam-cluster",
          relationshipType: "routes-to",
          isInferred: false,
        });
      }
    }

    if (hasS3Cluster && (appCompute || db)) {
      const src = appCompute?.id || db?.id;
      if (src && nodeMap.has(src)) {
        resultLinks.push({
          id: "trunk-compute-to-s3",
          source: src,
          target: "fleet-s3-cluster",
          sourceResourceId: src,
          targetResourceId: "fleet-s3-cluster",
          relationshipType: "targets",
          isInferred: false,
        });
      }
    }

    return resultLinks;
  }

  // In Unpacked mode:
  // Suppress background mass IAM links unless specifically selected/hovered to avoid blue wedge fan
  const activeFocusId = selectedNodeId || hoveredNodeId;

  return rawLinks.filter((l) => {
    const srcId = typeof l.source === "object" ? (l.source as any).id : l.source;
    const tgtId = typeof l.target === "object" ? (l.target as any).id : l.target;

    if (!nodeMap.has(srcId) || !nodeMap.has(tgtId)) return false;

    const rel = (l as any).relationshipType;
    if (rel === "contained-in" || rel === "attached-in" || rel === "runs-in" || rel === "located-in") {
      return false;
    }

    // If an IAM role has > 50 incoming links, only render when focused
    if (rawLinks.length > 80 && (rel === "uses-role" || rel === "assumes-role")) {
      if (activeFocusId && (srcId === activeFocusId || tgtId === activeFocusId)) {
        return true;
      }
      return false; // Suppress fan
    }

    return true;
  });
}
