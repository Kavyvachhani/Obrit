/**
 * Canonical resource type identifiers used across the codebase.
 * Format: "service:resource" — maps 1:1 with AWS resource types.
 */
export const RESOURCE_TYPES = {
  // VPC & Networking
  VPC: "vpc:vpc",
  SUBNET: "vpc:subnet",
  ROUTE_TABLE: "vpc:route-table",
  INTERNET_GATEWAY: "vpc:internet-gateway",
  NAT_GATEWAY: "vpc:nat-gateway",
  SECURITY_GROUP: "vpc:security-group",
  NETWORK_INTERFACE: "ec2:network-interface",

  // Compute
  EC2_INSTANCE: "ec2:instance",
  LAMBDA_FUNCTION: "lambda:function",

  // Load Balancing
  LOAD_BALANCER: "elb:load-balancer",
  TARGET_GROUP: "elb:target-group",

  // Database
  RDS_INSTANCE: "rds:instance",
  RDS_CLUSTER: "rds:cluster",

  // Storage
  S3_BUCKET: "s3:bucket",

  // Identity
  IAM_ROLE: "iam:role",
} as const;

export type ResourceType = (typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES];

/**
 * Human-readable labels for each resource type.
 */
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  [RESOURCE_TYPES.VPC]: "VPC",
  [RESOURCE_TYPES.SUBNET]: "Subnet",
  [RESOURCE_TYPES.ROUTE_TABLE]: "Route Table",
  [RESOURCE_TYPES.INTERNET_GATEWAY]: "Internet Gateway",
  [RESOURCE_TYPES.NAT_GATEWAY]: "NAT Gateway",
  [RESOURCE_TYPES.SECURITY_GROUP]: "Security Group",
  [RESOURCE_TYPES.NETWORK_INTERFACE]: "Network Interface",
  [RESOURCE_TYPES.EC2_INSTANCE]: "EC2 Instance",
  [RESOURCE_TYPES.LAMBDA_FUNCTION]: "Lambda Function",
  [RESOURCE_TYPES.LOAD_BALANCER]: "Load Balancer",
  [RESOURCE_TYPES.TARGET_GROUP]: "Target Group",
  [RESOURCE_TYPES.RDS_INSTANCE]: "RDS Instance",
  [RESOURCE_TYPES.RDS_CLUSTER]: "RDS Cluster",
  [RESOURCE_TYPES.S3_BUCKET]: "S3 Bucket",
  [RESOURCE_TYPES.IAM_ROLE]: "IAM Role",
};

/**
 * Color palette for each resource type — used by both 2D and 3D renderers.
 * HSL values chosen for visual distinction and accessibility.
 */
export const RESOURCE_TYPE_COLORS: Record<ResourceType, string> = {
  [RESOURCE_TYPES.VPC]: "#6366f1",            // Indigo — container
  [RESOURCE_TYPES.SUBNET]: "#818cf8",          // Lighter indigo — sub-container
  [RESOURCE_TYPES.ROUTE_TABLE]: "#a78bfa",     // Violet
  [RESOURCE_TYPES.INTERNET_GATEWAY]: "#f59e0b", // Amber — gateway to internet
  [RESOURCE_TYPES.NAT_GATEWAY]: "#fbbf24",     // Yellow — NAT
  [RESOURCE_TYPES.SECURITY_GROUP]: "#ef4444",  // Red — security
  [RESOURCE_TYPES.NETWORK_INTERFACE]: "#94a3b8", // Slate — infrastructure
  [RESOURCE_TYPES.EC2_INSTANCE]: "#f97316",    // Orange — compute
  [RESOURCE_TYPES.LAMBDA_FUNCTION]: "#8b5cf6", // Purple — serverless
  [RESOURCE_TYPES.LOAD_BALANCER]: "#06b6d4",   // Cyan — networking
  [RESOURCE_TYPES.TARGET_GROUP]: "#22d3ee",    // Light cyan
  [RESOURCE_TYPES.RDS_INSTANCE]: "#3b82f6",    // Blue — database
  [RESOURCE_TYPES.RDS_CLUSTER]: "#2563eb",     // Darker blue — database cluster
  [RESOURCE_TYPES.S3_BUCKET]: "#10b981",       // Emerald — storage
  [RESOURCE_TYPES.IAM_ROLE]: "#ec4899",        // Pink — identity
};

/**
 * Edge relationship types used in graph construction.
 */
export const RELATIONSHIP_TYPES = {
  CONTAINED_IN: "contained-in",       // Subnet → VPC, Instance → Subnet
  ATTACHED_TO: "attached-to",         // SG → ENI, IGW → VPC
  HAS_INTERFACE: "has-interface",     // Instance → ENI
  MEMBER_OF: "member-of",            // Instance → SG, RDS → SG
  ROUTES_TO: "routes-to",            // LB → TG
  TARGETS: "targets",                // TG → Instance
  ASSOCIATED_TO: "associated-to",    // RT → Subnet
  RUNS_IN: "runs-in",                // Lambda → VPC/Subnet, RDS → Subnet
  LOCATED_IN: "located-in",          // NatGW → Subnet
} as const;

export type RelationshipType =
  (typeof RELATIONSHIP_TYPES)[keyof typeof RELATIONSHIP_TYPES];
