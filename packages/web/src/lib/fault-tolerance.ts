import type { GraphNode, GraphLink } from "@orbit/core";

export type FaultSeverity = "critical" | "high" | "medium" | "low";
export type FaultCategory = "spof" | "wiring" | "security" | "orphaned";

export interface ResilienceFault {
  id: string;
  title: string;
  category: FaultCategory;
  severity: FaultSeverity;
  affectedNodeId?: string;
  affectedNodeName?: string;
  affectedNodeType?: string;
  description: string;
  impact: string;
  remediation: string;
  cliRemediation?: string;
  terraformRemediation?: string;
  frameworkRef: string; // e.g. "AWS Well-Architected Reliability Pillar REL-03"
  isResolved?: boolean;
}

export interface ThreatScenario {
  id: string;
  title: string;
  threatType: "ingress_exploit" | "data_exfil" | "privilege_escalation" | "az_outage";
  severity: "critical" | "high";
  description: string;
  entryPoint: string;
  targetAsset: string;
  blastRadiusScore: number;
}

export interface ResilienceAuditReport {
  score: number; // 0 - 100
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    spofCount: number;
    wiringFailures: number;
    securityRisks: number;
    orphanedAssets: number;
  };
  faults: ResilienceFault[];
}

/**
 * Enterprise Resilience & Fault Tolerance Audit Algorithm
 * Evaluates topology graph against AWS Well-Architected Reliability & Security Pillars.
 */
export function auditGraphFaultTolerance(
  nodes: GraphNode[],
  links: GraphLink[]
): ResilienceAuditReport {
  const faults: ResilienceFault[] = [];

  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  // Count resources by category
  const ec2Nodes: GraphNode[] = [];
  const rdsNodes: GraphNode[] = [];
  const natNodes: GraphNode[] = [];
  const albNodes: GraphNode[] = [];
  const s3Nodes: GraphNode[] = [];
  const sgNodes: GraphNode[] = [];
  const eniNodes: GraphNode[] = [];
  const iamNodes: GraphNode[] = [];

  for (const n of nodes) {
    const t = n.type.toLowerCase();
    if (t.startsWith("ec2:instance")) ec2Nodes.push(n);
    else if (t.startsWith("rds:")) rdsNodes.push(n);
    else if (t.includes("nat-gateway") || n.name.toLowerCase().includes("nat-")) natNodes.push(n);
    else if (t.startsWith("elb:") || n.name.toLowerCase().includes("alb")) albNodes.push(n);
    else if (t.startsWith("s3:")) s3Nodes.push(n);
    else if (t.includes("security-group")) sgNodes.push(n);
    else if (t.includes("network-interface")) eniNodes.push(n);
    else if (t.startsWith("iam:")) iamNodes.push(n);
  }

  // ─────────────────────────────────────────────────────────────
  // 1. Single Points of Failure (SPOF)
  // ─────────────────────────────────────────────────────────────

  // Check 1.1: Database Multi-AZ Redundancy
  for (const rds of rdsNodes) {
    const raw = (rds.rawConfig as any) || {};
    const isMultiAz = raw.MultiAZ === true || raw.EngineMode === "cluster" || rds.name.toLowerCase().includes("aurora");
    const hasReplica = nodes.some(
      (n) => n.id !== rds.id && n.type.startsWith("rds:") && n.subGroup === rds.subGroup
    );

    if (!isMultiAz && !hasReplica) {
      faults.push({
        id: `spof-db-${rds.id}`,
        title: `RDS Primary Database Lacks Multi-AZ Standby`,
        category: "spof",
        severity: "critical",
        affectedNodeId: rds.id,
        affectedNodeName: rds.name,
        affectedNodeType: rds.type,
        description: `Database instance '${rds.name}' is deployed in a single Availability Zone without automated Multi-AZ standby failover or read replicas.`,
        impact: `If the host Availability Zone suffers physical power loss, network partition, or degradation, the database will go offline with estimated RTO > 45 minutes.`,
        remediation: `Modify DB instance settings to enable 'Multi-AZ Deployment' to synchronously replicate data to a standby instance in an alternative AZ.`,
        cliRemediation: `aws rds modify-db-instance \\\n  --db-instance-identifier ${rds.name} \\\n  --multi-az \\\n  --apply-immediately`,
        terraformRemediation: `resource "aws_db_instance" "database" {\n  identifier = "${rds.name}"\n  multi_az   = true\n}`,
        frameworkRef: "AWS Well-Architected Framework: Reliability Pillar (REL-03: Multi-AZ Databases)",
      });
    }
  }

  // Check 1.2: Compute Fleet AZ Distribution
  const ec2Azs = new Set(
    ec2Nodes.map((n) => (n.rawConfig as any)?.Placement?.AvailabilityZone || n.subGroup || "unknown")
  );
  if (ec2Nodes.length > 0 && ec2Azs.size === 1) {
    const singleAz = Array.from(ec2Azs)[0];
    faults.push({
      id: "spof-ec2-single-az",
      title: `Compute Workload Concentrated in Single AZ (${singleAz})`,
      category: "spof",
      severity: "high",
      affectedNodeId: ec2Nodes[0]?.id,
      affectedNodeName: `EC2 Instance Cluster (${ec2Nodes.length} nodes)`,
      affectedNodeType: "ec2:instance",
      description: `All ${ec2Nodes.length} EC2 compute instances reside exclusively inside zone '${singleAz}' with no parallel compute nodes in a secondary AZ.`,
      impact: `Single AZ concentration introduces a hard infrastructure single-point-of-failure. AZ disruption will trigger a complete service blackout.`,
      remediation: `Deploy an Auto Scaling Group (ASG) spanning at least 2 Availability Zones with balanced minimum capacity.`,
      cliRemediation: `aws autoscaling update-auto-scaling-group \\\n  --auto-scaling-group-name prod-app-asg \\\n  --availability-zones ${singleAz} eu-central-1b \\\n  --min-size 2 --desired-capacity 2`,
      terraformRemediation: `resource "aws_autoscaling_group" "app_asg" {\n  vpc_zone_identifier = [aws_subnet.app_a.id, aws_subnet.app_b.id]\n  min_size            = 2\n  max_size            = 6\n}`,
      frameworkRef: "AWS Well-Architected Framework: Reliability Pillar (REL-02: Multi-AZ Compute)",
    });
  }

  // Check 1.3: NAT Gateway AZ Redundancy
  if (natNodes.length === 1) {
    faults.push({
      id: "spof-nat-single",
      title: `Single NAT Gateway Architecture Across Multi-AZ Subnets`,
      category: "spof",
      severity: "high",
      affectedNodeId: natNodes[0]?.id,
      affectedNodeName: natNodes[0]?.name,
      affectedNodeType: natNodes[0]?.type,
      description: `Only 1 NAT Gateway ('${natNodes[0]?.name}') provides egress routing for private subnets across all availability zones.`,
      impact: `If the NAT Gateway's host AZ experiences downtime, all private application servers lose outbound internet connectivity and AWS API access.`,
      remediation: `Deploy an independent NAT Gateway in each public subnet per Availability Zone and update route tables accordingly.`,
      cliRemediation: `aws ec2 create-nat-gateway \\\n  --subnet-id subnet-public-zone-b \\\n  --allocation-id eipalloc-secondary-nat`,
      terraformRemediation: `resource "aws_nat_gateway" "nat_secondary" {\n  allocation_id = aws_eip.nat_secondary.id\n  subnet_id     = aws_subnet.public_b.id\n}`,
      frameworkRef: "AWS Well-Architected Framework: Reliability Pillar (REL-04: Network Redundancy)",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Broken Wiring, Scan Gaps, & Connection Failures
  // ─────────────────────────────────────────────────────────────

  // Check 2.1: Scan Incomplete Gaps (Permission or Discovery Timeouts)
  const incompleteNodes = nodes.filter((n) => n.status === "incomplete");
  for (const inc of incompleteNodes) {
    const reason = inc.scanError?.message || inc.scanError?.code || "API permissions restricted";
    faults.push({
      id: `gap-scan-${inc.id}`,
      title: `Unverified Wiring Gap on ${inc.name}`,
      category: "wiring",
      severity: "medium",
      affectedNodeId: inc.id,
      affectedNodeName: inc.name,
      affectedNodeType: inc.type,
      description: `Resource relationships could not be completely confirmed due to: ${reason}.`,
      impact: `Missing telemetry hides potential routing loops or orphaned security vulnerabilities. Triage teams cannot verify true blast radius.`,
      remediation: `Grant discovery IAM role read permissions for '${inc.scanError?.code || "ec2:Describe*"}' and re-scan the environment.`,
      frameworkRef: "AWS Well-Architected Framework: Operational Excellence (OPS-04: Observable Architecture)",
    });
  }

  // Check 2.2: Inferred Unverified Links
  const inferredLinks = links.filter((l) => l.isInferred);
  if (inferredLinks.length > 0 && inferredLinks[0]) {
    const sampleLink = inferredLinks[0];
    const srcId = typeof sampleLink.source === "object" ? (sampleLink.source as any).id : sampleLink.source;
    const tgtId = typeof sampleLink.target === "object" ? (sampleLink.target as any).id : sampleLink.target;
    const srcName = nodeMap.get(srcId)?.name || srcId;
    const tgtName = nodeMap.get(tgtId)?.name || tgtId;

    faults.push({
      id: "gap-inferred-wiring",
      title: `${inferredLinks.length} Inferred Network Connection${inferredLinks.length > 1 ? "s" : ""}`,
      category: "wiring",
      severity: "low",
      affectedNodeId: srcId,
      affectedNodeName: `${srcName} ➔ ${tgtName}`,
      description: `Connection inferred via default route table or CIDR rules without endpoint ENI hardware confirmation.`,
      impact: `High-confidence assumption rather than direct AWS API confirmation. Possible routing blackhole if subnets were re-associated.`,
      remediation: `Verify explicit subnet route table associations and ensure security group ingress permits traffic between endpoints.`,
      frameworkRef: "AWS Well-Architected Framework: Reliability Pillar (REL-05: Verified Wiring)",
    });
  }

  // Check 2.3: Unattached / Orphaned Network Interfaces (ENIs)
  const unattachedEnis = eniNodes.filter(
    (n) => (n.rawConfig as any)?.Status === "available" || !(n.rawConfig as any)?.Attachment
  );
  for (const eni of unattachedEnis) {
    faults.push({
      id: `orphan-eni-${eni.id}`,
      title: `Orphaned Elastic Network Interface (${eni.name})`,
      category: "orphaned",
      severity: "low",
      affectedNodeId: eni.id,
      affectedNodeName: eni.name,
      affectedNodeType: eni.type,
      description: `ENI '${eni.name}' is unattached ('available' state) and consuming a private VPC IP address without an active instance.`,
      impact: `Accumulates idle AWS cost and retains stale security group attachments with unmanaged network surface.`,
      remediation: `Delete unattached network interfaces or reassign them to active workload instances.`,
      frameworkRef: "AWS Well-Architected Framework: Cost Optimization (COST-02: Clean Stale Resources)",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Security Exposure & Over-privileged Access Hazards
  // ─────────────────────────────────────────────────────────────

  // Check 3.1: Security Groups Open to 0.0.0.0/0 on Sensitive Ports
  for (const sg of sgNodes) {
    const raw = (sg.rawConfig as any) || {};
    const ipPerms = raw.IpPermissions || [];
    for (const perm of ipPerms) {
      const fromPort = perm.FromPort;
      const toPort = perm.ToPort;
      const isPublic = perm.IpRanges?.some((r: any) => r.CidrIp === "0.0.0.0/0");

      if (isPublic) {
        const isSsh = fromPort <= 22 && toPort >= 22;
        const isRdp = fromPort <= 3389 && toPort >= 3389;
        const isDb = (fromPort <= 5432 && toPort >= 5432) || (fromPort <= 3306 && toPort >= 3306);

        if (isSsh || isRdp || isDb) {
          const portLabel = isSsh ? "SSH (22)" : isRdp ? "RDP (3389)" : `Database (${fromPort})`;
          faults.push({
            id: `sec-sg-public-${sg.id}-${fromPort}`,
            title: `Unrestricted Public Access: Port ${portLabel} Open to 0.0.0.0/0`,
            category: "security",
            severity: "critical",
            affectedNodeId: sg.id,
            affectedNodeName: sg.name,
            affectedNodeType: sg.type,
            description: `Security Group '${sg.name}' allows inbound traffic on ${portLabel} from any IP address worldwide (0.0.0.0/0).`,
            impact: `Immediate exposure to brute-force attacks, port scanning, and remote credential exploitation. High risk of breach.`,
            remediation: `Restrict ingress to trusted corporate VPN CIDR blocks or migrate administration to AWS Systems Manager (SSM) Session Manager.`,
            cliRemediation: `aws ec2 revoke-security-group-ingress \\\n  --group-id ${sg.id} \\\n  --protocol tcp \\\n  --port ${fromPort} \\\n  --cidr 0.0.0.0/0`,
            terraformRemediation: `# Replace 0.0.0.0/0 in ingress rules with specific authorized CIDR block:\nresource "aws_security_group_rule" "restricted_ingress" {\n  type              = "ingress"\n  from_port         = ${fromPort}\n  to_port           = ${fromPort}\n  protocol          = "tcp"\n  cidr_blocks       = ["10.0.0.0/8", "192.168.1.0/24"] # Trusted only\n  security_group_id = "${sg.id}"\n}`,
            frameworkRef: "AWS Well-Architected Framework: Security Pillar (SEC-05: Protect Network Boundaries)",
          });
        }
      }
    }
  }

  // Check 3.2: S3 Buckets Public Exposure
  for (const s3 of s3Nodes) {
    const raw = (s3.rawConfig as any) || {};
    const isPublic = raw.isPublic === true || s3.status === "exposed";
    if (isPublic) {
      faults.push({
        id: `sec-s3-public-${s3.id}`,
        title: `Public Access Enabled on S3 Bucket '${s3.name}'`,
        category: "security",
        severity: "critical",
        affectedNodeId: s3.id,
        affectedNodeName: s3.name,
        affectedNodeType: s3.type,
        description: `Amazon S3 bucket '${s3.name}' has S3 Block Public Access disabled or has an open bucket ACL/policy.`,
        impact: `Risk of unauthorized data exfiltration, sensitive document leakage, and ransomware tamper.`,
        remediation: `Enable AWS S3 Block Public Access (all 4 settings) at the bucket and account level immediately.`,
        cliRemediation: `aws s3api put-public-access-block \\\n  --bucket ${s3.name} \\\n  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"`,
        terraformRemediation: `resource "aws_s3_bucket_public_access_block" "${s3.name.replace(/[^a-zA-Z0-9_]/g, "_")}_block" {\n  bucket = "${s3.name}"\n\n  block_public_acls       = true\n  block_public_policy     = true\n  ignore_public_acls      = true\n  restrict_public_buckets = true\n}`,
        frameworkRef: "AWS Well-Architected Framework: Security Pillar (SEC-07: Data Protection at Rest)",
      });
    }
  }

  // Check 3.3: Overprivileged IAM Execution Roles
  for (const iam of iamNodes) {
    const raw = (iam.rawConfig as any) || {};
    const doc = JSON.stringify(raw);
    const hasWildcardAdmin = doc.includes('"Action":"*"') || doc.includes('"Action": "*"') || iam.name.toLowerCase().includes("admin");
    if (hasWildcardAdmin) {
      faults.push({
        id: `sec-iam-wildcard-${iam.id}`,
        title: `Overprivileged IAM Role: Wildcard Administrator Access`,
        category: "security",
        severity: "high",
        affectedNodeId: iam.id,
        affectedNodeName: iam.name,
        affectedNodeType: iam.type,
        description: `IAM Role '${iam.name}' contains wildcard administrative permissions ('Action: *' or AdministratorAccess).`,
        impact: `Violates principle of least privilege. Compromise of compute workloads assuming this role grants lateral movement across entire account.`,
        remediation: `Scope policy down to service-specific actions and utilize AWS IAM Access Analyzer to generate least-privilege policies.`,
        cliRemediation: `aws iam detach-role-policy \\\n  --role-name ${iam.name} \\\n  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess`,
        terraformRemediation: `# Replace wildcard Admin with scoped least-privilege policy document:\ndata "aws_iam_policy_document" "scoped_execution" {\n  statement {\n    actions   = ["logs:CreateLogGroup", "logs:PutLogEvents"]\n    resources = ["arn:aws:logs:*:*:*"]\n  }\n}`,
        frameworkRef: "AWS Well-Architected Framework: Security Pillar (SEC-03: Least Privilege Permissions)",
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Calculate Resilience Score & Letter Grade
  // ─────────────────────────────────────────────────────────────
  let score = 100;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const f of faults) {
    if (f.severity === "critical") {
      score -= 16;
      criticalCount++;
    } else if (f.severity === "high") {
      score -= 8;
      highCount++;
    } else if (f.severity === "medium") {
      score -= 4;
      mediumCount++;
    } else {
      score -= 2;
      lowCount++;
    }
  }

  score = Math.max(15, Math.min(100, score));

  let grade: ResilienceAuditReport["grade"] = "F";
  if (score >= 95) grade = "A+";
  else if (score >= 88) grade = "A";
  else if (score >= 78) grade = "B";
  else if (score >= 65) grade = "C";
  else if (score >= 50) grade = "D";

  return {
    score,
    grade,
    summary: {
      total: faults.length,
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      spofCount: faults.filter((f) => f.category === "spof").length,
      wiringFailures: faults.filter((f) => f.category === "wiring").length,
      securityRisks: faults.filter((f) => f.category === "security").length,
      orphanedAssets: faults.filter((f) => f.category === "orphaned").length,
    },
    faults,
  };
}

// ─────────────────────────────────────────────────────────────
// THREAT SCENARIOS & BLAST RADIUS SIMULATOR
// ─────────────────────────────────────────────────────────────

export const THREAT_SCENARIOS: ThreatScenario[] = [
  {
    id: "threat-ingress-breach",
    title: "Public Ingress Port 22/3389 Exploitation",
    threatType: "ingress_exploit",
    severity: "critical",
    description: "Adversary identifies open 0.0.0.0/0 port on Security Group, executes brute force credential attack, and pivots to private subnet instances.",
    entryPoint: "Internet & Security Group (0.0.0.0/0)",
    targetAsset: "Compute Nodes & VPC Subnet",
    blastRadiusScore: 85,
  },
  {
    id: "threat-s3-exfil",
    title: "Ransomware S3 Data Lake Exfiltration",
    threatType: "data_exfil",
    severity: "critical",
    description: "Adversary leverages unauthenticated public S3 bucket policies or compromised workload credentials to read and encrypt production data.",
    entryPoint: "Public S3 Bucket ACL / Policy",
    targetAsset: "Amazon S3 Storage Lake",
    blastRadiusScore: 92,
  },
  {
    id: "threat-iam-escalation",
    title: "Lateral Movement via Wildcard IAM Admin Role",
    threatType: "privilege_escalation",
    severity: "high",
    description: "Attacker compromises a container or Lambda with AdministratorAccess, minting temporary credentials to compromise entire AWS account.",
    entryPoint: "Overprivileged Compute Execution Role",
    targetAsset: "AWS IAM Account Root & Backbones",
    blastRadiusScore: 95,
  },
  {
    id: "threat-az-outage",
    title: "Primary Availability Zone Datacenter Outage",
    threatType: "az_outage",
    severity: "critical",
    description: "Simulates complete loss of Zone A due to utility power failure. Uncovers databases and compute fleets lacking automated Multi-AZ failover.",
    entryPoint: "AWS AZ Datacenter Host (eu-central-1a)",
    targetAsset: "Single-AZ RDS & EC2 Workloads",
    blastRadiusScore: 78,
  },
];

export interface ThreatSimulationResult {
  scenario: ThreatScenario;
  affectedNodeIds: Set<string>;
  affectedLinkIds: Set<string>;
  blastRadiusNodes: GraphNode[];
}

export function simulateThreatBlastRadius(
  scenarioId: string,
  nodes: GraphNode[],
  links: GraphLink[]
): ThreatSimulationResult {
  const scenario = THREAT_SCENARIOS.find((s) => s.id === scenarioId) || THREAT_SCENARIOS[0]!;
  const affectedNodeIds = new Set<string>();
  const affectedLinkIds = new Set<string>();

  if (scenario.id === "threat-ingress-breach") {
    // Collect public ingress, SGs, connected EC2 instances
    for (const n of nodes) {
      if (
        n.type.includes("security-group") ||
        n.name.toLowerCase().includes("public") ||
        n.type.startsWith("ec2:instance") ||
        n.status === "exposed"
      ) {
        affectedNodeIds.add(n.id);
      }
    }
  } else if (scenario.id === "threat-s3-exfil") {
    // S3 buckets and Lambdas connecting to them
    for (const n of nodes) {
      if (n.type.startsWith("s3:") || n.status === "exposed" || n.name.toLowerCase().includes("lake")) {
        affectedNodeIds.add(n.id);
      }
    }
  } else if (scenario.id === "threat-iam-escalation") {
    // IAM roles, Lambdas and EC2 instances
    for (const n of nodes) {
      if (n.type.startsWith("iam:") || n.name.toLowerCase().includes("admin") || n.type.startsWith("lambda:")) {
        affectedNodeIds.add(n.id);
      }
    }
  } else if (scenario.id === "threat-az-outage") {
    // AZ-a instances, non-multi-AZ databases
    for (const n of nodes) {
      const az = (n.rawConfig as any)?.Placement?.AvailabilityZone || n.subGroup || "";
      if (az.includes("1a") || n.type.startsWith("rds:") || n.type.includes("nat-gateway")) {
        affectedNodeIds.add(n.id);
      }
    }
  }

  // Find connecting links
  for (const l of links) {
    const sId = typeof l.source === "object" ? (l.source as any).id : l.source;
    const tId = typeof l.target === "object" ? (l.target as any).id : l.target;
    if (affectedNodeIds.has(sId) || affectedNodeIds.has(tId)) {
      affectedLinkIds.add(l.id);
    }
  }

  const blastRadiusNodes = nodes.filter((n) => affectedNodeIds.has(n.id));

  return {
    scenario,
    affectedNodeIds,
    affectedLinkIds,
    blastRadiusNodes,
  };
}

// ─────────────────────────────────────────────────────────────
// EXPORT SECURITY AUDIT REPORTS
// ─────────────────────────────────────────────────────────────

export function exportSecurityReportMarkdown(report: ResilienceAuditReport): string {
  const timestamp = new Date().toISOString();
  let md = `# Orbit AWS Resilience & Security Posture Audit Report\n\n`;
  md += `**Generated:** ${timestamp}\n`;
  md += `**Resilience Score:** ${report.score}% (${report.grade} Grade)\n`;
  md += `**Total Identified Faults:** ${report.summary.total} (Critical: ${report.summary.critical}, High: ${report.summary.high})\n\n`;
  md += `---\n\n`;

  md += `## Executive Summary\n`;
  md += `- **Single Points of Failure (SPOF):** ${report.summary.spofCount}\n`;
  md += `- **Network Wiring & Telemetry Gaps:** ${report.summary.wiringFailures}\n`;
  md += `- **Public Exposure & Security Hazards:** ${report.summary.securityRisks}\n`;
  md += `- **Orphaned / Idle Cloud Assets:** ${report.summary.orphanedAssets}\n\n`;

  md += `## Detailed Findings & Remediation Playbooks\n\n`;

  report.faults.forEach((f, idx) => {
    md += `### ${idx + 1}. [${f.severity.toUpperCase()}] ${f.title}\n`;
    md += `- **Category:** ${f.category.toUpperCase()}\n`;
    md += `- **Affected Asset:** ${f.affectedNodeName || f.affectedNodeId || "Regional Configuration"}\n`;
    md += `- **Framework Standard:** ${f.frameworkRef}\n`;
    md += `- **Description:** ${f.description}\n`;
    md += `- **Blast Radius:** ${f.impact}\n`;
    md += `- **Remediation Guide:** ${f.remediation}\n`;
    if (f.cliRemediation) {
      md += `\n**AWS CLI Command:**\n\`\`\`bash\n${f.cliRemediation}\n\`\`\`\n`;
    }
    if (f.terraformRemediation) {
      md += `\n**Terraform Patch:**\n\`\`\`hcl\n${f.terraformRemediation}\n\`\`\`\n`;
    }
    md += `\n---\n\n`;
  });

  return md;
}

export function exportSecurityReportJson(report: ResilienceAuditReport): string {
  return JSON.stringify(
    {
      reportTitle: "Orbit AWS Resilience & Security Posture Audit",
      generatedAt: new Date().toISOString(),
      ...report,
    },
    null,
    2
  );
}
