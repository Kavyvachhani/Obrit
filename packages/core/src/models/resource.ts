// ─── Provider & Auth ─────────────────────────────────────────────────────────

export type Provider = "aws"; // Room for "gcp" | "azure" later

export type AuthMethod = "access_key" | "assume_role";

// ─── Resource ────────────────────────────────────────────────────────────────

export type ResourceStatus = "healthy" | "degraded" | "failed" | "exposed" | "incomplete" | "unknown";

export interface ScanErrorInfo {
  code: "AccessDenied" | "Timeout" | "RateLimited" | "PartialResponse" | "Unknown" | string;
  operation?: string; // e.g. "ec2:DescribeNetworkInterfaces"
  message: string; // Plain language: e.g. "ec2:DescribeNetworkInterfaces returned AccessDenied for this resource"
  lastSuccessScan?: string; // e.g. "3 cycles ago"
  cyclesFailing?: number;
  suggestedFix?: string; // e.g. "Attach policy with ec2:DescribeNetworkInterfaces to scan IAM role"
}

export interface Resource {
  id: string;
  provider: Provider;
  accountId: string;
  region: string;
  type: string; // e.g. "ec2:instance", "vpc:subnet"
  arn: string;
  name: string;
  tags: Record<string, string>;
  rawConfig: Record<string, unknown>;
  status: ResourceStatus;
  lastSeenAt: string; // ISO 8601 timestamp
  scanError?: ScanErrorInfo; // Detailed pipeline scan gap info if status is "incomplete"
}

// ─── Edge ────────────────────────────────────────────────────────────────────

export interface LiveMetric {
  value: number;
  unit: string;
  asOf: string; // ISO 8601 timestamp
}

export interface Edge {
  id: string;
  sourceResourceId: string;
  targetResourceId: string;
  relationshipType: string;
  liveMetric?: LiveMetric;
  isInferred?: boolean; // True if connection is inferred/unverified (e.g. touches an incomplete node)
  unverifiedReason?: string; // Plain-language explanation for inferred status
}

// ─── Graph Data (what the renderer consumes) ─────────────────────────────────

export interface GraphNode extends Resource {
  // Additional rendering hints
  group?: string; // VPC ID for grouping
  subGroup?: string; // Subnet ID or AZ
  x?: number;
  y?: number;
  z?: number;
  fx?: number; // Fixed x position (for pinned nodes)
  fy?: number;
  fz?: number;
}

export interface GraphLink extends Edge {
  source: string; // sourceResourceId
  target: string; // targetResourceId
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ─── Scan Run ────────────────────────────────────────────────────────────────

export type ScanStatus = "running" | "completed" | "failed" | "partial";

export interface ScanError {
  service: string;
  code: string;
  message: string;
  timestamp: string;
}

export interface ScanRun {
  id: string;
  accountId: string;
  region: string;
  startedAt: string;
  finishedAt?: string;
  resourceCount: number;
  status: ScanStatus;
  errors: ScanError[];
  unplannedServices?: string[];
}

// ─── Connected Account ───────────────────────────────────────────────────────

export interface ConnectedAccount {
  id: string;
  alias: string;
  provider: Provider;
  authMethod: AuthMethod;
  externalId?: string;
  encryptedSecretRef?: string; // Internal reference, never sent to frontend
  regions: string[];
  createdAt: string;
}

/** What the frontend sends to connect an account (Phase 1: access key only) */
export interface ConnectAccountRequest {
  alias: string;
  provider: Provider;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** What the frontend receives back (no secrets) */
export interface ConnectedAccountSummary {
  id: string;
  alias: string;
  provider: Provider;
  authMethod: AuthMethod;
  regions: string[];
  createdAt: string;
}
