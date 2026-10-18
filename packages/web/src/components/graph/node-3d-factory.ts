import * as THREE from "three";
import type { GraphNode } from "@orbit/core";

const textureCache = new Map<string, THREE.CanvasTexture>();

export type VisualStatus = "healthy" | "exposed" | "failed" | "incomplete" | "traced";

export function getNodeVisualStatus(node: GraphNode, isSelected = false): VisualStatus {
  if (isSelected) return "traced";
  if (node.status === "incomplete") return "incomplete";
  const s = (node.status || "").toLowerCase();
  if (s === "failed" || s === "alarm" || s === "unhealthy" || s === "stopped" || s === "error") {
    return "failed";
  }
  if (s === "exposed" || s === "warning" || s === "finding" || s === "alert") {
    return "exposed";
  }
  return "healthy";
}

export function getStatusColor(status: VisualStatus): string {
  switch (status) {
    case "healthy": return "#3DDC84";
    case "exposed": return "#F2B33D";
    case "failed": return "#FF5C5C";
    case "traced": return "#4DA3FF";
    case "incomplete": return "#8893A6";
  }
}

/* ─────────────────────────────────────────────────────────────
   AWS OFFICIAL SERVICE STYLE MAP
   Colors & iconTypes match AWS Architecture Icon catalog
   ─────────────────────────────────────────────────────────── */
export interface ServiceStyle {
  color: string;       // Primary brand color
  badgeBg: string;     // Badge background color
  accentGlow: string;  // Glow / accent highlight
  shortType: string;   // Human label
  iconType:
    | "ec2"
    | "lambda"
    | "rds"
    | "s3"
    | "vpc"
    | "subnet"
    | "alb"
    | "elb"
    | "igw"
    | "nat"
    | "sg"
    | "iam"
    | "dynamodb"
    | "sqs"
    | "sns"
    | "apigateway"
    | "cloudfront"
    | "ecs"
    | "eks"
    | "stepfunctions"
    | "elasticache"
    | "routetable"
    | "eni"
    | "default";
}

const officialIconCache = new Map<string, HTMLImageElement>();

export function getOfficialIconImage(iconType: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  if (!officialIconCache.has(iconType)) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `/aws-icons/${iconType}.png`;
    officialIconCache.set(iconType, img);
  }
  return officialIconCache.get(iconType)!;
}

export function getServiceStyle(type: string, name = ""): ServiceStyle {
  const n = name.toLowerCase();
  const t = type.toLowerCase();

  // Compute
  if (t.startsWith("ec2:instance") || n.includes("i-"))
    return { color: "#FF9900", badgeBg: "#FF9900", accentGlow: "rgba(255,153,0,0.25)", shortType: "EC2", iconType: "ec2" };
  if (t.startsWith("lambda:") || n.includes("func-"))
    return { color: "#ED7100", badgeBg: "#ED7100", accentGlow: "rgba(237,113,0,0.25)", shortType: "Lambda", iconType: "lambda" };
  if (t.startsWith("ecs:"))
    return { color: "#F97316", badgeBg: "#F97316", accentGlow: "rgba(249,115,22,0.25)", shortType: "ECS", iconType: "ecs" };
  if (t.startsWith("eks:"))
    return { color: "#D97706", badgeBg: "#D97706", accentGlow: "rgba(217,119,6,0.25)", shortType: "EKS", iconType: "eks" };

  // Database & Cache
  if (t.startsWith("rds:") || n.includes("db-") || n.includes("aurora"))
    return { color: "#3B48CC", badgeBg: "#3B48CC", accentGlow: "rgba(59,72,204,0.25)", shortType: "RDS", iconType: "rds" };
  if (t.startsWith("dynamodb:") || n.includes("table-") || n.includes("dynamo"))
    return { color: "#4338CA", badgeBg: "#4338CA", accentGlow: "rgba(67,56,202,0.25)", shortType: "DynamoDB", iconType: "dynamodb" };
  if (t.startsWith("elasticache:") || n.includes("cache-") || n.includes("redis"))
    return { color: "#3B82F6", badgeBg: "#3B82F6", accentGlow: "rgba(59,130,246,0.25)", shortType: "ElastiCache", iconType: "elasticache" };

  // Storage
  if (t.startsWith("s3:") || n.includes("s3-") || n.includes("bucket"))
    return { color: "#3F8624", badgeBg: "#3F8624", accentGlow: "rgba(63,134,36,0.25)", shortType: "S3", iconType: "s3" };

  // Networking & Edge
  if (t === "vpc:vpc" || n.includes("vpc-"))
    return { color: "#8C4FFF", badgeBg: "#8C4FFF", accentGlow: "rgba(140,79,255,0.25)", shortType: "VPC", iconType: "vpc" };
  if (t === "vpc:subnet" || n.includes("subnet-"))
    return { color: "#147EBA", badgeBg: "#147EBA", accentGlow: "rgba(20,126,186,0.25)", shortType: "Subnet", iconType: "subnet" };
  if (t.startsWith("elb:") || n.includes("alb") || n.includes("targetgroup"))
    return { color: "#8C4FFF", badgeBg: "#8C4FFF", accentGlow: "rgba(140,79,255,0.25)", shortType: "ELB", iconType: "alb" };
  if (n.includes("nat") || t.includes("nat-gateway"))
    return { color: "#8C4FFF", badgeBg: "#8C4FFF", accentGlow: "rgba(140,79,255,0.25)", shortType: "NAT GW", iconType: "nat" };
  if (t.includes("internet-gateway") || n.includes("igw"))
    return { color: "#8C4FFF", badgeBg: "#8C4FFF", accentGlow: "rgba(140,79,255,0.25)", shortType: "IGW", iconType: "igw" };
  if (t === "vpc:route-table" || n.includes("rtb-"))
    return { color: "#8C4FFF", badgeBg: "#8C4FFF", accentGlow: "rgba(140,79,255,0.25)", shortType: "Route Table", iconType: "routetable" };
  if (t === "ec2:network-interface" || n.includes("eni-"))
    return { color: "#94A3B8", badgeBg: "#94A3B8", accentGlow: "rgba(148,163,184,0.25)", shortType: "ENI", iconType: "eni" };
  if (t.startsWith("cloudfront:") || n.includes("cf-") || n.includes("cdn"))
    return { color: "#6366F1", badgeBg: "#6366F1", accentGlow: "rgba(99,102,241,0.25)", shortType: "CloudFront", iconType: "cloudfront" };
  if (t.startsWith("apigateway:") || n.includes("api-"))
    return { color: "#0EA5E9", badgeBg: "#0EA5E9", accentGlow: "rgba(14,165,233,0.25)", shortType: "API GW", iconType: "apigateway" };

  // Messaging & Workflow
  if (t.startsWith("sqs:") || n.includes("queue"))
    return { color: "#EC4899", badgeBg: "#EC4899", accentGlow: "rgba(236,72,153,0.25)", shortType: "SQS", iconType: "sqs" };
  if (t.startsWith("sns:") || n.includes("topic"))
    return { color: "#F43F5E", badgeBg: "#F43F5E", accentGlow: "rgba(244,63,94,0.25)", shortType: "SNS", iconType: "sns" };
  if (t.startsWith("stepfunctions:") || n.includes("sfn-") || n.includes("sm-"))
    return { color: "#D946EF", badgeBg: "#D946EF", accentGlow: "rgba(217,70,239,0.25)", shortType: "Step Fn", iconType: "stepfunctions" };

  // Security & Identity
  if (t.includes("security-group") || n.includes("sg-"))
    return { color: "#DD344C", badgeBg: "#DD344C", accentGlow: "rgba(221,52,76,0.25)", shortType: "SG", iconType: "sg" };
  if (t.startsWith("iam:") || n.includes("role-"))
    return { color: "#DD344C", badgeBg: "#DD344C", accentGlow: "rgba(221,52,76,0.25)", shortType: "IAM", iconType: "iam" };

  return { color: "#879196", badgeBg: "#546E7A", accentGlow: "rgba(84,110,122,0.25)", shortType: "Resource", iconType: "default" };
}

/* ─────────────────────────────────────────────────────────────
   DRAW OFFICIAL AWS ARCHITECTURE ICON (Using Official AWS Icon Package)
   ─────────────────────────────────────────────────────────── */
export function drawOfficialAwsVectorIcon(
  ctx: CanvasRenderingContext2D,
  iconType: ServiceStyle["iconType"],
  badgeBg: string,
  x: number,
  y: number,
  size: number
) {
  ctx.save();
  ctx.translate(x, y);

  // Badge background with gradient matching official AWS console palette
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, badgeBg);
  grad.addColorStop(1, darkenColor(badgeBg, 0.25));
  ctx.fillStyle = grad;
  ctx.beginPath();
  const r = size * 0.18;
  if (ctx.roundRect) {
    ctx.roundRect(0, 0, size, size, r);
  } else {
    ctx.rect(0, 0, size, size);
  }
  ctx.fill();

  // Subtle top highlight edge
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = size * 0.03;
  ctx.stroke();

  // 1. Try rendering from official AWS Icon Package
  const img = getOfficialIconImage(iconType);
  if (img && img.complete && img.naturalWidth > 0) {
    const pad = size * 0.14;
    ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
    ctx.restore();
    return;
  }

  // 2. Vector fallback if image is still loading or unavailable
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1.8, size * 0.045);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const cx = size / 2;
  const cy = size / 2;
  const u = size / 48; // Unit for scalable drawing

  switch (iconType) {
    case "ec2": {
      // AWS EC2: Server rack with 3 blades
      const bw = 28 * u;
      const bh = 8 * u;
      const gap = 3 * u;
      for (let i = -1; i <= 1; i++) {
        const ty = cy + i * (bh + gap) - bh / 2;
        // Blade body
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cx - bw / 2, ty, bw, bh, 2 * u);
        else ctx.rect(cx - bw / 2, ty, bw, bh);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        // Drive slots
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cx - bw / 2 + 4 * u, ty + bh * 0.3, 8 * u, bh * 0.4);
        ctx.fillRect(cx - bw / 2 + 14 * u, ty + bh * 0.3, 4 * u, bh * 0.4);
        // Status LED
        ctx.beginPath();
        ctx.arc(cx + bw / 2 - 4 * u, ty + bh / 2, 1.5 * u, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case "lambda": {
      // AWS Lambda: Bold λ symbol
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(size * 0.6)}px "Inter", "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("λ", cx, cy + 1 * u);
      break;
    }

    case "rds": {
      // AWS RDS: Database cylinder stack
      const rw = 26 * u;
      const rh = 6 * u;
      // Top ellipse
      ctx.beginPath();
      ctx.ellipse(cx, cy - 10 * u, rw / 2, rh / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      // Cylinder body
      ctx.beginPath();
      ctx.moveTo(cx - rw / 2, cy - 10 * u);
      ctx.lineTo(cx - rw / 2, cy + 10 * u);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + rw / 2, cy - 10 * u);
      ctx.lineTo(cx + rw / 2, cy + 10 * u);
      ctx.stroke();
      // Middle ring
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw / 2, rh / 2, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      // Bottom ellipse
      ctx.beginPath();
      ctx.ellipse(cx, cy + 10 * u, rw / 2, rh / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case "s3": {
      // AWS S3: Bucket with curved sides
      const bw = 24 * u;
      const bh = 26 * u;
      const topY = cy - bh / 2;
      const botY = cy + bh / 2;
      // Top rim ellipse
      ctx.beginPath();
      ctx.ellipse(cx, topY + 2 * u, bw / 2, 4 * u, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      // Bucket walls (slightly tapered)
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2, topY + 2 * u);
      ctx.lineTo(cx - bw / 2 + 2 * u, botY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + bw / 2, topY + 2 * u);
      ctx.lineTo(cx + bw / 2 - 2 * u, botY);
      ctx.stroke();
      // Bottom ellipse
      ctx.beginPath();
      ctx.ellipse(cx, botY, bw / 2 - 2 * u, 3.5 * u, 0, 0, Math.PI);
      ctx.stroke();
      // Arrow (upload/download indicator)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 2 * u);
      ctx.lineTo(cx - 4 * u, cy + 4 * u);
      ctx.lineTo(cx + 4 * u, cy + 4 * u);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case "alb": {
      // AWS ELB: Distribution node with 3 output arrows
      // Central circle
      ctx.beginPath();
      ctx.arc(cx - 6 * u, cy, 6 * u, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      // Output lines to 3 targets
      const targets = [cy - 12 * u, cy, cy + 12 * u];
      for (const ty of targets) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 14 * u, ty);
        ctx.stroke();
        // Arrow tip
        ctx.beginPath();
        ctx.arc(cx + 14 * u, ty, 2.5 * u, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
      break;
    }

    case "igw": {
      // AWS Internet Gateway: Globe with gateway arch
      ctx.beginPath();
      ctx.arc(cx, cy, 12 * u, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      // Globe lines
      ctx.beginPath();
      ctx.moveTo(cx - 12 * u, cy);
      ctx.lineTo(cx + 12 * u, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, 5 * u, 12 * u, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Gateway arrows
      ctx.beginPath();
      ctx.moveTo(cx - 4 * u, cy + 15 * u);
      ctx.lineTo(cx, cy + 19 * u);
      ctx.lineTo(cx + 4 * u, cy + 15 * u);
      ctx.stroke();
      break;
    }

    case "nat": {
      // AWS NAT Gateway: Bidirectional translation box
      const w = 22 * u, h = 18 * u;
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 3 * u);
      else ctx.rect(cx - w / 2, cy - h / 2, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fill();
      ctx.stroke();
      // NAT text
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${9 * u}px "Inter", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("NAT", cx, cy);
      break;
    }

    case "vpc": {
      // AWS VPC: Cloud network perimeter
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(2, size * 0.05);
      // Cloud shape
      ctx.beginPath();
      ctx.arc(cx - 8 * u, cy + 2 * u, 10 * u, Math.PI * 0.7, Math.PI * 1.8);
      ctx.arc(cx + 2 * u, cy - 6 * u, 9 * u, Math.PI * 1.1, Math.PI * 1.85);
      ctx.arc(cx + 10 * u, cy, 8 * u, Math.PI * 1.4, Math.PI * 0.5);
      ctx.arc(cx, cy + 6 * u, 10 * u, Math.PI * 0.1, Math.PI * 0.6);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fill();
      ctx.stroke();
      break;
    }

    case "subnet": {
      // AWS Subnet: Grid partition
      ctx.strokeStyle = "#ffffff";
      const grid = 8 * u;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - 12 * u, cy - 12 * u, 24 * u, 24 * u, 2 * u);
      else ctx.rect(cx - 12 * u, cy - 12 * u, 24 * u, 24 * u);
      ctx.stroke();
      // Grid lines
      ctx.beginPath();
      ctx.moveTo(cx - 12 * u, cy - 4 * u);
      ctx.lineTo(cx + 12 * u, cy - 4 * u);
      ctx.moveTo(cx - 12 * u, cy + 4 * u);
      ctx.lineTo(cx + 12 * u, cy + 4 * u);
      ctx.moveTo(cx - 4 * u, cy - 12 * u);
      ctx.lineTo(cx - 4 * u, cy + 12 * u);
      ctx.moveTo(cx + 4 * u, cy - 12 * u);
      ctx.lineTo(cx + 4 * u, cy + 12 * u);
      ctx.stroke();
      break;
    }

    case "sg": {
      // Security Group: Shield
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14 * u);
      ctx.lineTo(cx + 12 * u, cy - 8 * u);
      ctx.lineTo(cx + 10 * u, cy + 6 * u);
      ctx.lineTo(cx, cy + 14 * u);
      ctx.lineTo(cx - 10 * u, cy + 6 * u);
      ctx.lineTo(cx - 12 * u, cy - 8 * u);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      // Lock icon
      ctx.beginPath();
      ctx.arc(cx, cy - 3 * u, 4 * u, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - 5 * u, cy - 1 * u, 10 * u, 8 * u, 1.5 * u);
      else ctx.rect(cx - 5 * u, cy - 1 * u, 10 * u, 8 * u);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      break;
    }

    case "iam": {
      // IAM: Person with gear
      // Head
      ctx.beginPath();
      ctx.arc(cx, cy - 8 * u, 5 * u, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      // Body
      ctx.beginPath();
      ctx.arc(cx, cy + 6 * u, 8 * u, Math.PI * 1.2, Math.PI * 1.8);
      ctx.lineTo(cx + 7 * u, cy + 12 * u);
      ctx.lineTo(cx - 7 * u, cy + 12 * u);
      ctx.closePath();
      ctx.fill();
      // Small key
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5 * u;
      ctx.beginPath();
      ctx.arc(cx + 10 * u, cy - 2 * u, 3 * u, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 13 * u, cy - 2 * u);
      ctx.lineTo(cx + 18 * u, cy - 2 * u);
      ctx.lineTo(cx + 18 * u, cy + 1 * u);
      ctx.stroke();
      break;
    }

    case "dynamodb": {
      // AWS DynamoDB: 3 stacked database wafers with key lightning
      const dw = 24 * u;
      const dh = 5 * u;
      for (let i = -1; i <= 1; i++) {
        const dy = cy + i * 8 * u;
        ctx.beginPath();
        ctx.ellipse(cx, dy, dw / 2, dh / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
      // Vertical cylinder sides
      ctx.beginPath();
      ctx.moveTo(cx - dw / 2, cy - 8 * u);
      ctx.lineTo(cx - dw / 2, cy + 8 * u);
      ctx.moveTo(cx + dw / 2, cy - 8 * u);
      ctx.lineTo(cx + dw / 2, cy + 8 * u);
      ctx.stroke();
      // Little lightning bolt in front
      ctx.fillStyle = "#F2B33D";
      ctx.beginPath();
      ctx.moveTo(cx + 2 * u, cy - 5 * u);
      ctx.lineTo(cx - 3 * u, cy + 1 * u);
      ctx.lineTo(cx + 1 * u, cy + 1 * u);
      ctx.lineTo(cx - 1 * u, cy + 6 * u);
      ctx.lineTo(cx + 4 * u, cy - 1 * u);
      ctx.lineTo(cx, cy - 1 * u);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case "sqs": {
      // AWS SQS: Message queue layers with forward dispatch arrow
      const qw = 22 * u;
      const qh = 6 * u;
      // 3 Queue message slabs
      for (let i = -1; i <= 1; i++) {
        const qy = cy + i * 7 * u;
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cx - qw / 2, qy - qh / 2, qw, qh, 2 * u);
        else ctx.rect(cx - qw / 2, qy - qh / 2, qw, qh);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
      // Right arrow
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(cx + qw / 2 + 3 * u, cy);
      ctx.lineTo(cx + qw / 2 - 1 * u, cy - 4 * u);
      ctx.lineTo(cx + qw / 2 - 1 * u, cy + 4 * u);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case "cloudfront": {
      // AWS CloudFront: Global CDN globe with edge caching rays
      ctx.beginPath();
      ctx.arc(cx, cy, 11 * u, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      // Latitude / Longitude arcs
      ctx.beginPath();
      ctx.ellipse(cx, cy, 4 * u, 11 * u, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 11 * u, cy);
      ctx.lineTo(cx + 11 * u, cy);
      ctx.stroke();
      // 4 Edge points around globe
      const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
      ctx.fillStyle = "#38BDF8";
      for (const a of angles) {
        const px = cx + Math.cos(a) * 15 * u;
        const py = cy + Math.sin(a) * 15 * u;
        ctx.beginPath();
        ctx.arc(px, py, 2.5 * u, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case "apigateway": {
      // AWS API Gateway: Portal arch with API bracket tags
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2 * u;
      // Arch
      ctx.beginPath();
      ctx.arc(cx, cy - 2 * u, 10 * u, Math.PI, 0);
      ctx.lineTo(cx + 10 * u, cy + 12 * u);
      ctx.moveTo(cx - 10 * u, cy - 2 * u);
      ctx.lineTo(cx - 10 * u, cy + 12 * u);
      ctx.stroke();
      // Inner brackets < >
      ctx.fillStyle = "#38BDF8";
      ctx.font = `bold ${8 * u}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("{/}", cx, cy + 3 * u);
      break;
    }

    case "sns": {
      // AWS SNS: Notification bell / broadcast horn
      ctx.beginPath();
      ctx.arc(cx, cy - 4 * u, 6 * u, Math.PI, 0);
      ctx.lineTo(cx + 10 * u, cy + 7 * u);
      ctx.lineTo(cx - 10 * u, cy + 7 * u);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      // Clapper
      ctx.beginPath();
      ctx.arc(cx, cy + 9 * u, 2.5 * u, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      // Broadcast arcs
      ctx.beginPath();
      ctx.arc(cx, cy - 3 * u, 13 * u, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
      break;
    }

    case "ecs": {
      // AWS ECS: Container cube stack
      const cw = 16 * u;
      const ch = 16 * u;
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - cw / 2, cy - ch / 2, cw, ch, 3 * u);
      else ctx.rect(cx - cw / 2, cy - ch / 2, cw, ch);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      // Inner grid cubes
      ctx.beginPath();
      ctx.moveTo(cx - cw / 2, cy);
      ctx.lineTo(cx + cw / 2, cy);
      ctx.moveTo(cx, cy - ch / 2);
      ctx.lineTo(cx, cy + ch / 2);
      ctx.stroke();
      break;
    }

    default: {
      // Generic AWS resource box
      ctx.strokeStyle = "#ffffff";
      const bx = 10 * u;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - bx, cy - bx, bx * 2, bx * 2, 3 * u);
      else ctx.rect(cx - bx, cy - bx, bx * 2, bx * 2);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fill();
      ctx.stroke();
      // AWS text
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${7 * u}px "Inter", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("AWS", cx, cy);
      break;
    }
  }

  ctx.restore();
}

/* ─────────────────────────────────────────────────────────────
   3D DEVICE TEXTURE CACHE & GENERATORS
   Creates authentic face textures for AWS 3D Isometric Figurines
   ─────────────────────────────────────────────────────────── */
const deviceTextureCache = new Map<string, THREE.CanvasTexture>();

function getEC2Texture(): THREE.CanvasTexture {
  const key = "ec2_front_tex";
  if (deviceTextureCache.has(key)) return deviceTextureCache.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1E222D";
  ctx.fillRect(0, 0, 256, 320);

  // Server rack frame
  ctx.strokeStyle = "#FF9900";
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 312);

  // 3 Server chassis bays
  const bayH = 80;
  for (let i = 0; i < 3; i++) {
    const y = 16 + i * 94;
    ctx.fillStyle = "#141720";
    ctx.fillRect(14, y, 228, bayH);
    ctx.strokeStyle = "#384152";
    ctx.lineWidth = 2;
    ctx.strokeRect(14, y, 228, bayH);

    // Hard drive caddies
    ctx.fillStyle = "#262E3D";
    for (let d = 0; d < 4; d++) {
      ctx.fillRect(24 + d * 38, y + 14, 32, 52);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(24 + d * 38, y + 14, 32, 52);
    }

    // Ventilation slots
    ctx.fillStyle = "#0F1219";
    for (let v = 0; v < 6; v++) {
      ctx.fillRect(182, y + 16 + v * 8, 48, 4);
    }

    // Status LEDs
    ctx.fillStyle = "#3DDC84";
    ctx.beginPath();
    ctx.arc(190, y + 66, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#38BDF8";
    ctx.beginPath();
    ctx.arc(206, y + 66, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  deviceTextureCache.set(key, tex);
  return tex;
}

function getLambdaTexture(): THREE.CanvasTexture {
  const key = "lambda_front_tex";
  if (deviceTextureCache.has(key)) return deviceTextureCache.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1C140A";
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = "#ED7100";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 248);

  // Circuit tracks
  ctx.strokeStyle = "rgba(237,113,0,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(20, 40); ctx.lineTo(80, 40); ctx.lineTo(100, 70);
  ctx.moveTo(236, 40); ctx.lineTo(180, 40); ctx.lineTo(160, 70);
  ctx.moveTo(20, 216); ctx.lineTo(80, 216); ctx.lineTo(100, 186);
  ctx.moveTo(236, 216); ctx.lineTo(180, 216); ctx.lineTo(160, 186);
  ctx.stroke();

  // Bold Lambda Symbol
  ctx.fillStyle = "#FF9900";
  ctx.font = "900 140px 'Inter', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("λ", 128, 130);

  const tex = new THREE.CanvasTexture(canvas);
  deviceTextureCache.set(key, tex);
  return tex;
}

function getRDSTexture(): THREE.CanvasTexture {
  const key = "rds_front_tex";
  if (deviceTextureCache.has(key)) return deviceTextureCache.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0D1829";
  ctx.fillRect(0, 0, 256, 256);

  // 3 Tier Platter Lines
  ctx.strokeStyle = "#3B82F6";
  ctx.lineWidth = 5;
  for (let i = 0; i < 3; i++) {
    const y = 30 + i * 75;
    ctx.fillStyle = "#1A2B47";
    ctx.fillRect(16, y, 224, 60);
    ctx.strokeRect(16, y, 224, 60);

    // Activity light strip
    ctx.fillStyle = "#60A5FA";
    for (let k = 0; k < 6; k++) {
      ctx.fillRect(36 + k * 28, y + 26, 16, 8);
    }
    // Blue / Green Status LED
    ctx.fillStyle = "#3DDC84";
    ctx.beginPath();
    ctx.arc(216, y + 30, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  deviceTextureCache.set(key, tex);
  return tex;
}

function getNetworkTexture(): THREE.CanvasTexture {
  const key = "net_front_tex";
  if (deviceTextureCache.has(key)) return deviceTextureCache.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#161226";
  ctx.fillRect(0, 0, 256, 160);

  ctx.strokeStyle = "#8C4FFF";
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, 248, 152);

  // Ethernet Switch Ports (8 ports)
  ctx.fillStyle = "#0A0812";
  for (let p = 0; p < 8; p++) {
    const x = 20 + p * 28;
    ctx.fillRect(x, 70, 20, 24);
    ctx.strokeStyle = "#4C3B7A";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, 70, 20, 24);
    // Port Link LED
    ctx.fillStyle = p % 2 === 0 ? "#38BDF8" : "#3DDC84";
    ctx.beginPath();
    ctx.arc(x + 10, 56, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0A0812";
  }

  // Network Routing Arrows
  ctx.strokeStyle = "#C084FC";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(30, 30); ctx.lineTo(120, 30); ctx.lineTo(110, 24);
  ctx.moveTo(120, 30); ctx.lineTo(110, 36);
  ctx.moveTo(226, 30); ctx.lineTo(136, 30); ctx.lineTo(146, 24);
  ctx.moveTo(136, 30); ctx.lineTo(146, 36);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  deviceTextureCache.set(key, tex);
  return tex;
}

function getSecurityTexture(): THREE.CanvasTexture {
  const key = "sec_front_tex";
  if (deviceTextureCache.has(key)) return deviceTextureCache.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 280;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#200E14";
  ctx.fillRect(0, 0, 256, 280);

  ctx.strokeStyle = "#DD344C";
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 272);

  // Vault Shield Emblem
  ctx.fillStyle = "#DD344C";
  ctx.beginPath();
  ctx.moveTo(128, 48);
  ctx.lineTo(198, 76);
  ctx.lineTo(198, 160);
  ctx.bezierCurveTo(198, 216, 128, 248, 128, 248);
  ctx.bezierCurveTo(128, 248, 58, 216, 58, 160);
  ctx.lineTo(58, 76);
  ctx.closePath();
  ctx.fill();

  // Inner Keyhole
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(128, 128, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(120, 134);
  ctx.lineTo(136, 134);
  ctx.lineTo(142, 178);
  ctx.lineTo(114, 178);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  deviceTextureCache.set(key, tex);
  return tex;
}

/* ─────────────────────────────────────────────────────────────
   BUILD 3D ISOMETRIC FIGURINE MODEL
   Creates genuine 3D Three.js device models matching AWS 3D icons:
   - EC2: 3D Server Blade Chassis with bays & LEDs
   - Lambda: 3D Golden Lambda Function Cube
   - RDS: 3D Multi-tier Database Platter Cylinder
   - S3: 3D Tapered Storage Bucket with Rim
   - ELB/Gateways: 3D Network Switch Appliance
   - Security: 3D Firewall / Shield Vault Tower
   - Fleet Cluster: Holographic Multi-server Block
   ─────────────────────────────────────────────────────────── */
function build3DDeviceMesh(
  node: GraphNode,
  style: ServiceStyle,
  visualStatus: VisualStatus,
  isSelected: boolean,
  isHovered: boolean
): THREE.Group {
  const modelGroup = new THREE.Group();
  const isCluster = Boolean((node.rawConfig as any)?.isCluster);
  const statusColor = getStatusColor(visualStatus);
  const brandColor = new THREE.Color(style.color);

  // 1. Ground Pedestal / Shadow Plate (Humanized architectural disc)
  const pedestalRadius = 22;
  const pedestalGeo = new THREE.CylinderGeometry(pedestalRadius, pedestalRadius + 2.5, 2.5, 32);
  const pedestalMat = new THREE.MeshStandardMaterial({
    color: 0x141A26,
    metalness: 0.5,
    roughness: 0.5,
  });
  const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestal.position.y = 1.25;
  modelGroup.add(pedestal);

  // Glowing status halo ring on top of the pedestal
  const haloGeo = new THREE.RingGeometry(pedestalRadius * 0.72, pedestalRadius * 0.98, 32);
  const haloMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(statusColor),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: isSelected ? 0.95 : isHovered ? 0.85 : visualStatus === "incomplete" ? 0.45 : 0.7,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 2.6;
  modelGroup.add(halo);

  // 2. Primary 3D Device Geometry based on AWS 3D Icon Family
  if (isCluster) {
    // Holographic Fleet Cluster Block
    const clusterGeo = new THREE.BoxGeometry(30, 30, 30);
    const clusterMat = new THREE.MeshStandardMaterial({
      color: 0x0284C7,
      metalness: 0.7,
      roughness: 0.2,
      emissive: 0x0369A1,
      emissiveIntensity: 0.35,
    });
    const clusterMesh = new THREE.Mesh(clusterGeo, clusterMat);
    clusterMesh.position.y = 17;
    modelGroup.add(clusterMesh);

    // Glowing wireframe cage around cluster
    const cageGeo = new THREE.BoxGeometry(32, 32, 32);
    const cageWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(cageGeo),
      new THREE.LineBasicMaterial({ color: 0x38BDF8, linewidth: 2 })
    );
    cageWire.position.y = 17;
    modelGroup.add(cageWire);
  } else if (style.iconType === "ec2") {
    // AWS EC2: Standing 3D Server Blade Chassis (Box: 26 x 32 x 20)
    const serverGeo = new THREE.BoxGeometry(26, 32, 20);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x242A38,
      metalness: 0.8,
      roughness: 0.3,
    });
    const frontMat = new THREE.MeshStandardMaterial({
      map: getEC2Texture(),
      metalness: 0.5,
      roughness: 0.4,
    });
    const materials = [bodyMat, bodyMat, bodyMat, bodyMat, frontMat, bodyMat];
    const server = new THREE.Mesh(serverGeo, materials);
    server.position.y = 18;
    modelGroup.add(server);

    // Orange server top accent trim
    const trimGeo = new THREE.BoxGeometry(26.6, 2.5, 20.6);
    const trimMat = new THREE.MeshBasicMaterial({ color: 0xFF9900 });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.y = 34.5;
    modelGroup.add(trim);
  } else if (style.iconType === "lambda") {
    // AWS Lambda: Standing Golden Function Cube (26 x 26 x 26)
    const cubeGeo = new THREE.BoxGeometry(26, 26, 26);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2E1C0A,
      metalness: 0.7,
      roughness: 0.3,
    });
    const frontMat = new THREE.MeshStandardMaterial({
      map: getLambdaTexture(),
      metalness: 0.4,
      roughness: 0.4,
    });
    const materials = [bodyMat, bodyMat, bodyMat, bodyMat, frontMat, bodyMat];
    const cube = new THREE.Mesh(cubeGeo, materials);
    cube.position.y = 15;
    modelGroup.add(cube);

    const frameWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(cubeGeo),
      new THREE.LineBasicMaterial({ color: 0xED7100, linewidth: 2 })
    );
    frameWire.position.y = 15;
    modelGroup.add(frameWire);
  } else if (style.iconType === "rds") {
    // AWS RDS: Multi-tier 3D Database Cylinder Stack (Cylinder: 14 radius, 30 height)
    const dbGeo = new THREE.CylinderGeometry(14, 14, 30, 32);
    const dbMat = new THREE.MeshStandardMaterial({
      color: 0x1D4ED8,
      metalness: 0.75,
      roughness: 0.25,
    });
    const dbMesh = new THREE.Mesh(dbGeo, dbMat);
    dbMesh.position.y = 17;
    modelGroup.add(dbMesh);

    // 3 Metallic Platter Ring Dividers (Image 4 reference)
    for (let i = -1; i <= 1; i++) {
      const ringGeo = new THREE.TorusGeometry(14.3, 0.9, 8, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x93C5FD });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 17 + i * 8.5;
      modelGroup.add(ring);
    }
  } else if (style.iconType === "s3") {
    // AWS S3: Tapered 3D Storage Bucket (Cylinder: top 16, bottom 11, height 28)
    const bucketGeo = new THREE.CylinderGeometry(16, 11, 28, 32);
    const bucketMat = new THREE.MeshStandardMaterial({
      color: 0xDC2626,
      metalness: 0.7,
      roughness: 0.3,
    });
    const bucket = new THREE.Mesh(bucketGeo, bucketMat);
    bucket.position.y = 16;
    modelGroup.add(bucket);

    const rimGeo = new THREE.TorusGeometry(16.2, 1.4, 12, 32);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0xFCA5A5 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 30;
    modelGroup.add(rim);
  } else if (style.iconType === "alb" || style.iconType === "nat" || style.iconType === "igw") {
    // AWS Networking: Standing 3D Switch / Router Appliance (Box: 30 x 18 x 24)
    const switchGeo = new THREE.BoxGeometry(30, 18, 24);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x28203E,
      metalness: 0.8,
      roughness: 0.3,
    });
    const frontMat = new THREE.MeshStandardMaterial({
      map: getNetworkTexture(),
      metalness: 0.5,
      roughness: 0.4,
    });
    const materials = [bodyMat, bodyMat, bodyMat, bodyMat, frontMat, bodyMat];
    const sw = new THREE.Mesh(switchGeo, materials);
    sw.position.y = 11;
    modelGroup.add(sw);

    const swWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(switchGeo),
      new THREE.LineBasicMaterial({ color: 0x8C4FFF, linewidth: 2 })
    );
    swWire.position.y = 11;
    modelGroup.add(swWire);
  } else if (style.iconType === "sg" || style.iconType === "iam") {
    // AWS Security: Standing 3D Security Vault Tower (Box: 22 x 30 x 20)
    const secGeo = new THREE.BoxGeometry(22, 30, 20);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2E161D,
      metalness: 0.8,
      roughness: 0.3,
    });
    const frontMat = new THREE.MeshStandardMaterial({
      map: getSecurityTexture(),
      metalness: 0.5,
      roughness: 0.4,
    });
    const materials = [bodyMat, bodyMat, bodyMat, bodyMat, frontMat, bodyMat];
    const sec = new THREE.Mesh(secGeo, materials);
    sec.position.y = 17;
    modelGroup.add(sec);

    const secWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(secGeo),
      new THREE.LineBasicMaterial({ color: 0xDD344C, linewidth: 2 })
    );
    secWire.position.y = 17;
    modelGroup.add(secWire);
  } else {
    // Default / Generic AWS 3D Resource Prism
    const genGeo = new THREE.BoxGeometry(24, 26, 24);
    const genMat = new THREE.MeshStandardMaterial({
      color: brandColor,
      metalness: 0.65,
      roughness: 0.35,
    });
    const genMesh = new THREE.Mesh(genGeo, genMat);
    genMesh.position.y = 15;
    modelGroup.add(genMesh);

    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(genGeo),
      new THREE.LineBasicMaterial({ color: 0xFFFFFF, linewidth: 1.5 })
    );
    wire.position.y = 15;
    modelGroup.add(wire);
  }

  // 3. Architectural Callout Stem connecting figurine to floating label badge
  const stemMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(statusColor),
    transparent: true,
    opacity: 0.65,
  });
  const stemGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 32, 0),
    new THREE.Vector3(0, 48, 0),
  ]);
  const stem = new THREE.Line(stemGeo, stemMat);
  modelGroup.add(stem);

  return modelGroup;
}

/* ─────────────────────────────────────────────────────────────
   3D UPRIGHT CALLOUT LABEL SPRITE (Human-Crafted & High Contrast)
   
   Creates an upright, high-resolution Canvas Sprite that 
   floats above the 3D figurine. Because it's a THREE.Sprite,
   it AUTOMATICALLY faces the camera and NEVER flips backwards,
   upside down, or mirrored!
   ─────────────────────────────────────────────────────────── */
function build3DLabelSprite(
  node: GraphNode,
  style: ServiceStyle,
  visualStatus: VisualStatus,
  isSelected: boolean,
  isHovered: boolean
): THREE.Sprite {
  const isCluster = Boolean((node.rawConfig as any)?.isCluster);
  const statusColor = getStatusColor(visualStatus);
  const isIncomplete = visualStatus === "incomplete";

  const cacheKey = `sprite_v4_${node.id}_${isSelected}_${isHovered}_${visualStatus}`;
  let texture = textureCache.get(cacheKey);

  if (!texture) {
    const W = isCluster ? 1080 : 1000;
    const H = 260;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    ctx.clearRect(0, 0, W, H);

    const pad = 10;
    const w = W - pad * 2;
    const h = H - pad * 2;

    // Solid high-contrast backing
    ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;

    // Rich dark graphite solid badge backing (crystal clear contrast against 3D scene)
    ctx.fillStyle = isSelected ? "#1E2738" : isHovered ? "#182030" : "#101520";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pad, pad, w, h, 22);
    else ctx.rect(pad, pad, w, h);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Crisp perimeter
    ctx.lineWidth = isSelected ? 6.0 : isHovered ? 4.5 : 3.5;
    if (isIncomplete) {
      ctx.strokeStyle = "#8893A6";
      ctx.setLineDash([14, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = isCluster ? "#38BDF8" : statusColor;
      ctx.stroke();
    }

    // Top color accent bar
    ctx.fillStyle = isIncomplete ? "#8893A6" : (isCluster ? "#38BDF8" : statusColor);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pad, pad, w, 8, [22, 22, 0, 0]);
    else ctx.rect(pad, pad, w, 8);
    ctx.fill();

    // Service Icon Badge (Large, Bold & Highly Visible)
    const iconSize = 195;
    const iconX = pad + 18;
    const iconY = pad + (h - iconSize) / 2;
    drawOfficialAwsVectorIcon(
      ctx,
      style.iconType,
      isIncomplete ? "#475569" : isCluster ? "#0284C7" : style.badgeBg,
      iconX,
      iconY,
      iconSize
    );

    // Text Content Area
    const textLeft = iconX + iconSize + 28;

    // Service category tag
    ctx.font = "bold 32px 'Inter', sans-serif";
    ctx.fillStyle = isIncomplete ? "#94A3B8" : (isCluster ? "#38BDF8" : style.color);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const tagText = isCluster
      ? `FLEET CLUSTER • ${(node.rawConfig as any).totalCount} RESOURCES`
      : isIncomplete
      ? `${style.shortType} • DATA GAP`
      : `${style.shortType.toUpperCase()}`;
    ctx.fillText(tagText, textLeft, pad + 22);

    // Resource Name (Large, bold, high-contrast white text)
    ctx.font = "bold 58px 'Inter', -apple-system, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    let displayName = node.name || node.id;
    if (displayName.length > 22) displayName = displayName.slice(0, 21) + "…";
    ctx.fillText(displayName, textLeft, pad + 60);

    // Humanized detail subtitle
    ctx.font = "bold 30px 'JetBrains Mono', monospace";
    ctx.fillStyle = isIncomplete ? "#CBD5E1" : "#A0AEC0";
    let detail = node.region || "us-east-1";
    if (isCluster) {
      const raw = (node.rawConfig as any) || {};
      detail = `${raw.healthyCount || raw.totalCount} Healthy • Click to Inspect`;
    } else if (isIncomplete && node.scanError) {
      detail = `⚠️ Missing IAM: ${node.scanError.code}`;
    } else if (node.rawConfig && (node.rawConfig as any).InstanceType) {
      detail = `${(node.rawConfig as any).InstanceType} • ${(node.rawConfig as any).PrivateIpAddress || "10.0.x.x"}`;
    } else if (node.rawConfig && (node.rawConfig as any).Runtime) {
      detail = `${(node.rawConfig as any).Runtime} • ${(node.rawConfig as any).MemorySize || 512}MB`;
    } else if (node.rawConfig && (node.rawConfig as any).Engine) {
      detail = `${(node.rawConfig as any).Engine} • Multi-AZ`;
    } else if (node.rawConfig && (node.rawConfig as any).CidrBlock) {
      detail = `${(node.rawConfig as any).CidrBlock}`;
    }
    ctx.fillText(detail, textLeft, pad + 124);

    // Right-hand Status Pill Badge
    const badgeW = 160;
    const badgeH = 54;
    const badgeX = W - pad - badgeW - 16;
    const badgeY = pad + (h - badgeH) / 2;

    ctx.fillStyle = `${statusColor}22`;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    else ctx.rect(badgeX, badgeY, badgeW, badgeH);
    ctx.fill();

    ctx.strokeStyle = statusColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Status dot
    ctx.beginPath();
    ctx.arc(badgeX + 24, badgeY + badgeH / 2, 7, 0, Math.PI * 2);
    ctx.fillStyle = statusColor;
    ctx.fill();

    // Status text
    ctx.font = "bold 26px 'JetBrains Mono', monospace";
    ctx.fillStyle = statusColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const statusText = isIncomplete ? "GAP" : visualStatus.toUpperCase();
    ctx.fillText(statusText, badgeX + badgeW / 2 + 10, badgeY + badgeH / 2);

    texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    textureCache.set(cacheKey, texture);
  }

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  // Humanized, high-legibility scale matching architectural schematics
  const sprite = new THREE.Sprite(spriteMat);
  const scaleW = isCluster ? 280 : 250;
  const scaleH = scaleW * (260 / (isCluster ? 1080 : 1000));
  sprite.scale.set(scaleW, scaleH, 1);
  sprite.position.y = 56; // Positioned cleanly above figurine
  sprite.userData = { isBillboardCard: true, nodeId: node.id };

  return sprite;
}

/* ─────────────────────────────────────────────────────────────
   CREATE COMPOSITE 3D NODE OBJECT
   Returns a THREE.Group combining:
   1. The AWS 3D Isometric Figurine (standing on ground)
   2. The Upright Callout Label Sprite (always camera-facing)
   ─────────────────────────────────────────────────────────── */
export function create3DNodeObject(node: GraphNode, isSelected = false, isHovered = false): THREE.Object3D {
  const group = new THREE.Group();
  group.name = node.id;
  group.userData = { nodeId: node.id };

  const style = getServiceStyle(node.type, node.name);
  const visualStatus = getNodeVisualStatus(node, isSelected);

  // 1. Add authentic AWS 3D Isometric Figurine (EC2, Lambda, RDS, S3, ALB, etc.)
  const deviceMesh = build3DDeviceMesh(node, style, visualStatus, isSelected, isHovered);
  group.add(deviceMesh);

  // 2. Add crystal-clear Upright Callout Label Sprite
  const labelSprite = build3DLabelSprite(node, style, visualStatus, isSelected, isHovered);
  group.add(labelSprite);

  return group;
}

/* ─── Utility: darken a hex color ─── */
function darkenColor(hex: string, factor: number): string {
  const c = hex.replace("#", "");
  const r = Math.max(0, Math.round(parseInt(c.slice(0, 2), 16) * (1 - factor)));
  const g = Math.max(0, Math.round(parseInt(c.slice(2, 4), 16) * (1 - factor)));
  const b = Math.max(0, Math.round(parseInt(c.slice(4, 6), 16) * (1 - factor)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
