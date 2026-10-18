import type { FastifyInstance } from "fastify";
import { query } from "../db/client.js";
import { nanoid } from "nanoid";
import type { Resource, Edge, ScanRun } from "@orbit/core";

export async function demoRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/demo/seed — Generates a rich, realistic AWS production architecture
   * in us-east-1 for immediate 2D/3D visualization and inspector testing.
   */
  app.post("/api/demo/seed", async (_request, reply) => {
    const demoAccountId = "acc_demo_production";
    const demoAccountAlias = "Production-AWS-Orbit";
    const region = "us-east-1";
    const scanId = "scan_demo_" + nanoid(8);
    const now = new Date().toISOString();

    // 1. Ensure connected account exists
    await query(
      `INSERT INTO connected_accounts (id, alias, provider, auth_method, region, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET alias = EXCLUDED.alias, region = EXCLUDED.region`,
      [demoAccountId, demoAccountAlias, "aws", "access_key", region]
    );

    // 2. Resources definition
    const resources: Resource[] = [
      // VPC
      {
        id: "vpc-0a8b9c1d2e3f4001",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "vpc:vpc",
        arn: `arn:aws:ec2:${region}:123456789012:vpc/vpc-0a8b9c1d2e3f4001`,
        name: "orbit-prod-vpc (10.0.0.0/16)",
        tags: { Environment: "production", Project: "Orbit", ManagedBy: "Terraform", Tier: "Network" },
        rawConfig: {
          VpcId: "vpc-0a8b9c1d2e3f4001",
          CidrBlock: "10.0.0.0/16",
          State: "available",
          EnableDnsHostnames: true,
          EnableDnsSupport: true,
          IsDefault: false,
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // Internet Gateway
      {
        id: "igw-0998877665544332",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "vpc:internet-gateway",
        arn: `arn:aws:ec2:${region}:123456789012:internet-gateway/igw-0998877665544332`,
        name: "orbit-prod-igw",
        tags: { Environment: "production", Project: "Orbit" },
        rawConfig: {
          InternetGatewayId: "igw-0998877665544332",
          Attachments: [{ State: "available", VpcId: "vpc-0a8b9c1d2e3f4001" }],
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // Public Subnet 1a
      {
        id: "subnet-01public1a",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "vpc:subnet",
        arn: `arn:aws:ec2:${region}:123456789012:subnet/subnet-01public1a`,
        name: "prod-public-us-east-1a (10.0.1.0/24)",
        tags: { Environment: "production", "orbit:tier": "public", Tier: "Public-DMZ" },
        rawConfig: {
          SubnetId: "subnet-01public1a",
          VpcId: "vpc-0a8b9c1d2e3f4001",
          CidrBlock: "10.0.1.0/24",
          AvailabilityZone: "us-east-1a",
          AvailableIpAddressCount: 250,
          MapPublicIpOnLaunch: true,
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // Private App Subnet 1a
      {
        id: "subnet-02private1a",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "vpc:subnet",
        arn: `arn:aws:ec2:${region}:123456789012:subnet/subnet-02private1a`,
        name: "prod-app-private-us-east-1a (10.0.10.0/24)",
        tags: { Environment: "production", "orbit:tier": "private", Tier: "App" },
        rawConfig: {
          SubnetId: "subnet-02private1a",
          VpcId: "vpc-0a8b9c1d2e3f4001",
          CidrBlock: "10.0.10.0/24",
          AvailabilityZone: "us-east-1a",
          AvailableIpAddressCount: 248,
          MapPublicIpOnLaunch: false,
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // Private App Subnet 1b
      {
        id: "subnet-03private1b",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "vpc:subnet",
        arn: `arn:aws:ec2:${region}:123456789012:subnet/subnet-03private1b`,
        name: "prod-app-private-us-east-1b (10.0.11.0/24)",
        tags: { Environment: "production", "orbit:tier": "private", Tier: "App" },
        rawConfig: {
          SubnetId: "subnet-03private1b",
          VpcId: "vpc-0a8b9c1d2e3f4001",
          CidrBlock: "10.0.11.0/24",
          AvailabilityZone: "us-east-1b",
          AvailableIpAddressCount: 247,
          MapPublicIpOnLaunch: false,
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // Private DB Subnet 1a
      {
        id: "subnet-04db1a",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "vpc:subnet",
        arn: `arn:aws:ec2:${region}:123456789012:subnet/subnet-04db1a`,
        name: "prod-db-private-us-east-1a (10.0.20.0/24)",
        tags: { Environment: "production", "orbit:tier": "database", Tier: "Database" },
        rawConfig: {
          SubnetId: "subnet-04db1a",
          VpcId: "vpc-0a8b9c1d2e3f4001",
          CidrBlock: "10.0.20.0/24",
          AvailabilityZone: "us-east-1a",
          AvailableIpAddressCount: 251,
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // NAT Gateway
      {
        id: "nat-05544332211009988",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "vpc:nat-gateway",
        arn: `arn:aws:ec2:${region}:123456789012:natgateway/nat-05544332211009988`,
        name: "orbit-prod-nat-1a",
        tags: { Environment: "production" },
        rawConfig: {
          NatGatewayId: "nat-05544332211009988",
          VpcId: "vpc-0a8b9c1d2e3f4001",
          SubnetId: "subnet-01public1a",
          State: "available",
          PublicIp: "52.204.14.89",
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // Security Groups
      {
        id: "sg-01alb",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "ec2:security-group",
        arn: `arn:aws:ec2:${region}:123456789012:security-group/sg-01alb`,
        name: "orbit-alb-ingress-sg",
        tags: { Tier: "ALB-Security" },
        rawConfig: {
          GroupId: "sg-01alb",
          GroupName: "orbit-alb-ingress-sg",
          Description: "Allow HTTPS from anywhere (0.0.0.0/0)",
          VpcId: "vpc-0a8b9c1d2e3f4001",
          InboundRulesCount: 2,
        },
        status: "healthy",
        lastSeenAt: now,
      },
      {
        id: "sg-02app",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "ec2:security-group",
        arn: `arn:aws:ec2:${region}:123456789012:security-group/sg-02app`,
        name: "orbit-app-internal-sg",
        tags: { Tier: "App-Security" },
        rawConfig: {
          GroupId: "sg-02app",
          GroupName: "orbit-app-internal-sg",
          Description: "Allow port 8080 from ALB SG only",
          VpcId: "vpc-0a8b9c1d2e3f4001",
          InboundRulesCount: 1,
        },
        status: "healthy",
        lastSeenAt: now,
      },
      {
        id: "sg-03db",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "ec2:security-group",
        arn: `arn:aws:ec2:${region}:123456789012:security-group/sg-03db`,
        name: "orbit-database-rds-sg",
        tags: { Tier: "DB-Security" },
        rawConfig: {
          GroupId: "sg-03db",
          GroupName: "orbit-database-rds-sg",
          Description: "Allow port 5432 from App SG only",
          VpcId: "vpc-0a8b9c1d2e3f4001",
          InboundRulesCount: 1,
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // Application Load Balancer
      {
        id: "alb-orbit-prod-web",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "elb:load-balancer",
        arn: `arn:aws:elasticloadbalancing:${region}:123456789012:loadbalancer/app/orbit-prod-web/50dc6c495c0c9188`,
        name: "orbit-prod-alb",
        tags: { Environment: "production", Tier: "Ingress", CostCenter: "Production-Web" },
        rawConfig: {
          DNSName: "orbit-prod-web-123456.us-east-1.elb.amazonaws.com",
          Scheme: "internet-facing",
          VpcId: "vpc-0a8b9c1d2e3f4001",
          State: { Code: "active" },
          Type: "application",
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // Target Group
      {
        id: "tg-orbit-prod-app",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "elb:target-group",
        arn: `arn:aws:elasticloadbalancing:${region}:123456789012:targetgroup/orbit-prod-app-tg/73e2d6bc24d8a067`,
        name: "orbit-prod-app-tg",
        tags: { Environment: "production" },
        rawConfig: {
          TargetType: "instance",
          Protocol: "HTTP",
          Port: 8080,
          VpcId: "vpc-0a8b9c1d2e3f4001",
          HealthCheckPath: "/healthz",
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // EC2 Instances
      {
        id: "i-091a2b3c4d5e6f701",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "ec2:instance",
        arn: `arn:aws:ec2:${region}:123456789012:instance/i-091a2b3c4d5e6f701`,
        name: "orbit-api-worker-01",
        tags: { Name: "orbit-api-worker-01", Role: "api-backend", Environment: "production" },
        rawConfig: {
          InstanceId: "i-091a2b3c4d5e6f701",
          InstanceType: "c6i.xlarge",
          State: { Name: "running" },
          PrivateIpAddress: "10.0.10.14",
          VpcId: "vpc-0a8b9c1d2e3f4001",
          SubnetId: "subnet-02private1a",
          AvailabilityZone: "us-east-1a",
          Architecture: "x86_64",
          CpuCores: 4,
          MemoryGib: 8,
        },
        status: "healthy",
        lastSeenAt: now,
      },
      {
        id: "i-091a2b3c4d5e6f702",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "ec2:instance",
        arn: `arn:aws:ec2:${region}:123456789012:instance/i-091a2b3c4d5e6f702`,
        name: "orbit-api-worker-02",
        tags: { Name: "orbit-api-worker-02", Role: "api-backend", Environment: "production" },
        rawConfig: {
          InstanceId: "i-091a2b3c4d5e6f702",
          InstanceType: "c6i.xlarge",
          State: { Name: "running" },
          PrivateIpAddress: "10.0.11.88",
          VpcId: "vpc-0a8b9c1d2e3f4001",
          SubnetId: "subnet-03private1b",
          AvailabilityZone: "us-east-1b",
          Architecture: "x86_64",
          CpuCores: 4,
          MemoryGib: 8,
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // Lambda Functions
      {
        id: "func-orbit-telemetry-digest",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "lambda:function",
        arn: `arn:aws:lambda:${region}:123456789012:function:orbit-telemetry-digest`,
        name: "orbit-telemetry-digest",
        tags: { Runtime: "nodejs20.x", Service: "Analytics" },
        rawConfig: {
          FunctionName: "orbit-telemetry-digest",
          Runtime: "nodejs20.x",
          MemorySize: 512,
          Timeout: 30,
          VpcConfig: {
            VpcId: "vpc-0a8b9c1d2e3f4001",
            SubnetIds: ["subnet-02private1a"],
            SecurityGroupIds: ["sg-02app"],
          },
        },
        status: "healthy",
        lastSeenAt: now,
      },
      {
        id: "func-orbit-image-optimizer",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "lambda:function",
        arn: `arn:aws:lambda:${region}:123456789012:function:orbit-image-optimizer`,
        name: "orbit-image-optimizer",
        tags: { Runtime: "python3.11", Trigger: "S3" },
        rawConfig: {
          FunctionName: "orbit-image-optimizer",
          Runtime: "python3.11",
          MemorySize: 1024,
          Timeout: 60,
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // RDS Database
      {
        id: "db-orbit-aurora-pg-prod",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "rds:db-instance",
        arn: `arn:aws:rds:${region}:123456789012:db:orbit-aurora-pg-prod`,
        name: "orbit-aurora-postgres-primary",
        tags: { Engine: "aurora-postgresql", Environment: "production", Tier: "Database" },
        rawConfig: {
          DBInstanceIdentifier: "orbit-aurora-pg-prod",
          Engine: "aurora-postgresql",
          EngineVersion: "16.1",
          DBInstanceClass: "db.r6g.2xlarge",
          Status: "available",
          Endpoint: "orbit-aurora-pg-prod.cluster-cxyz123.us-east-1.rds.amazonaws.com:5432",
          VpcId: "vpc-0a8b9c1d2e3f4001",
          SubnetId: "subnet-04db1a",
          MultiAZ: true,
          AllocatedStorage: 500,
          StorageEncrypted: true,
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // S3 Buckets
      {
        id: "s3-orbit-app-assets-production",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "s3:bucket",
        arn: "arn:aws:s3:::orbit-app-assets-production",
        name: "orbit-app-assets-production",
        tags: { Access: "Public-CDN", BucketType: "StaticHosting" },
        rawConfig: {
          Name: "orbit-app-assets-production",
          Region: "us-east-1",
          Versioning: "Enabled",
          Encryption: "AES256",
          ObjectCount: 14200,
        },
        status: "healthy",
        lastSeenAt: now,
      },
      {
        id: "s3-orbit-backups-vault-glacier",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "s3:bucket",
        arn: "arn:aws:s3:::orbit-backups-vault-glacier",
        name: "orbit-backups-vault-glacier",
        tags: { Compliance: "HIPAA", Tier: "ColdStorage" },
        rawConfig: {
          Name: "orbit-backups-vault-glacier",
          Region: "us-east-1",
          Versioning: "Enabled",
          Encryption: "aws:kms",
        },
        status: "healthy",
        lastSeenAt: now,
      },
      // IAM Roles
      {
        id: "role-orbit-ec2-backend-access",
        provider: "aws",
        accountId: demoAccountId,
        region,
        type: "iam:role",
        arn: "arn:aws:iam::123456789012:role/orbit-ec2-backend-access",
        name: "orbit-ec2-backend-access",
        tags: { ServiceRole: "EC2" },
        rawConfig: {
          RoleName: "orbit-ec2-backend-access",
          Path: "/",
          AssumeRolePolicyDocument: {
            Version: "2012-10-17",
            Statement: [{ Effect: "Allow", Principal: { Service: "ec2.amazonaws.com" }, Action: "sts:AssumeRole" }],
          },
        },
        status: "healthy",
        lastSeenAt: now,
      },
    ];

    // 3. Edges definition
    const edges: Edge[] = [
      // IGW -> VPC
      {
        id: "edge-igw-vpc",
        sourceResourceId: "igw-0998877665544332",
        targetResourceId: "vpc-0a8b9c1d2e3f4001",
        relationshipType: "attached-to",
      },
      // Subnets -> VPC (contained-in)
      { id: "edge-sub1-vpc", sourceResourceId: "subnet-01public1a", targetResourceId: "vpc-0a8b9c1d2e3f4001", relationshipType: "contained-in" },
      { id: "edge-sub2-vpc", sourceResourceId: "subnet-02private1a", targetResourceId: "vpc-0a8b9c1d2e3f4001", relationshipType: "contained-in" },
      { id: "edge-sub3-vpc", sourceResourceId: "subnet-03private1b", targetResourceId: "vpc-0a8b9c1d2e3f4001", relationshipType: "contained-in" },
      { id: "edge-sub4-vpc", sourceResourceId: "subnet-04db1a", targetResourceId: "vpc-0a8b9c1d2e3f4001", relationshipType: "contained-in" },
      // NAT Gateway in public subnet
      { id: "edge-nat-sub1", sourceResourceId: "nat-05544332211009988", targetResourceId: "subnet-01public1a", relationshipType: "located-in" },
      // ALB in public subnet and attached to SG
      { id: "edge-alb-sub1", sourceResourceId: "alb-orbit-prod-web", targetResourceId: "subnet-01public1a", relationshipType: "runs-in" },
      { id: "edge-alb-sg", sourceResourceId: "alb-orbit-prod-web", targetResourceId: "sg-01alb", relationshipType: "member-of" },
      // ALB routes to TargetGroup
      { id: "edge-alb-tg", sourceResourceId: "alb-orbit-prod-web", targetResourceId: "tg-orbit-prod-app", relationshipType: "routes-to" },
      // TargetGroup targets EC2 instances
      { id: "edge-tg-ec2-1", sourceResourceId: "tg-orbit-prod-app", targetResourceId: "i-091a2b3c4d5e6f701", relationshipType: "targets" },
      { id: "edge-tg-ec2-2", sourceResourceId: "tg-orbit-prod-app", targetResourceId: "i-091a2b3c4d5e6f702", relationshipType: "targets" },
      // Instances in subnets
      { id: "edge-ec2-1-sub2", sourceResourceId: "i-091a2b3c4d5e6f701", targetResourceId: "subnet-02private1a", relationshipType: "attached-in" },
      { id: "edge-ec2-2-sub3", sourceResourceId: "i-091a2b3c4d5e6f702", targetResourceId: "subnet-03private1b", relationshipType: "attached-in" },
      // Instances member of SG
      { id: "edge-ec2-1-sg", sourceResourceId: "i-091a2b3c4d5e6f701", targetResourceId: "sg-02app", relationshipType: "member-of" },
      { id: "edge-ec2-2-sg", sourceResourceId: "i-091a2b3c4d5e6f702", targetResourceId: "sg-02app", relationshipType: "member-of" },
      // Lambda VPC attachment
      { id: "edge-lambda-sub2", sourceResourceId: "func-orbit-telemetry-digest", targetResourceId: "subnet-02private1a", relationshipType: "runs-in" },
      { id: "edge-lambda-sg", sourceResourceId: "func-orbit-telemetry-digest", targetResourceId: "sg-02app", relationshipType: "member-of" },
      // Lambda trigger from S3
      { id: "edge-s3-lambda", sourceResourceId: "s3-orbit-app-assets-production", targetResourceId: "func-orbit-image-optimizer", relationshipType: "routes-to" },
      // RDS in DB Subnet & SG
      { id: "edge-rds-sub4", sourceResourceId: "db-orbit-aurora-pg-prod", targetResourceId: "subnet-04db1a", relationshipType: "runs-in" },
      { id: "edge-rds-sg", sourceResourceId: "db-orbit-aurora-pg-prod", targetResourceId: "sg-03db", relationshipType: "member-of" },
      // IAM role assume
      { id: "edge-role-ec2", sourceResourceId: "i-091a2b3c4d5e6f701", targetResourceId: "role-orbit-ec2-backend-access", relationshipType: "member-of" },
    ];

    // 4. Create scan record
    const unplannedDemoServices = ["DynamoDB", "SQS", "CloudFront"];
    await query(
      `INSERT INTO scan_runs (id, account_id, region, started_at, finished_at, resource_count, status, errors, unplanned_services)
       VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, '[]'::jsonb, $6)
       ON CONFLICT (id) DO NOTHING`,
      [scanId, demoAccountId, region, resources.length, "completed", JSON.stringify(unplannedDemoServices)]
    );

    // 5. Upsert resources
    for (const r of resources) {
      await query(
        `INSERT INTO resources (id, provider, account_id, region, type, arn, name, tags, raw_config, status, last_seen_at, scan_run_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (arn) DO UPDATE SET
           name = EXCLUDED.name,
           tags = EXCLUDED.tags,
           raw_config = EXCLUDED.raw_config,
           status = EXCLUDED.status,
           last_seen_at = EXCLUDED.last_seen_at,
           scan_run_id = EXCLUDED.scan_run_id`,
        [
          r.id,
          r.provider,
          r.accountId,
          r.region,
          r.type,
          r.arn,
          r.name,
          JSON.stringify(r.tags),
          JSON.stringify(r.rawConfig),
          r.status,
          r.lastSeenAt,
          scanId,
        ]
      );
    }

    // 6. Upsert edges
    await query(
      "DELETE FROM edges WHERE scan_run_id IN (SELECT id FROM scan_runs WHERE account_id = $1 AND id != $2)",
      [demoAccountId, scanId]
    );

    for (const e of edges) {
      await query(
        `INSERT INTO edges (id, source_resource_id, target_resource_id, relationship_type, scan_run_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (source_resource_id, target_resource_id, relationship_type) DO UPDATE SET
           scan_run_id = EXCLUDED.scan_run_id`,
        [e.id, e.sourceResourceId, e.targetResourceId, e.relationshipType, scanId]
      );
    }

    const scanRun: ScanRun = {
      id: scanId,
      accountId: demoAccountId,
      region,
      startedAt: now,
      finishedAt: now,
      resourceCount: resources.length,
      status: "completed",
      errors: [],
      unplannedServices: unplannedDemoServices,
    };

    return reply.status(201).send({
      message: "Demo architecture seeded successfully",
      account: {
        id: demoAccountId,
        alias: demoAccountAlias,
        region,
      },
      scanRun,
      resourceCount: resources.length,
      edgeCount: edges.length,
    });
  });
}
