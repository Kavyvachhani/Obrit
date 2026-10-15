import * as THREE from "three";
import type { GraphNode } from "@orbit/core";

// Texture cache to prevent redundant canvas texture recreation
const textureCache = new Map<string, THREE.CanvasTexture>();

interface ServiceStyle {
  color: string;
  bgColor: string;
  shortType: string;
  iconType: "ec2" | "lambda" | "rds" | "s3" | "vpc" | "subnet" | "alb" | "igw" | "sg" | "default";
}

function getServiceStyle(type: string): ServiceStyle {
  if (type.startsWith("ec2:instance")) {
    return { color: "#ff9900", bgColor: "#7c2d12", shortType: "EC2 INSTANCE", iconType: "ec2" };
  }
  if (type.startsWith("lambda:")) {
    return { color: "#f59e0b", bgColor: "#78350f", shortType: "LAMBDA FUNCTION", iconType: "lambda" };
  }
  if (type.startsWith("rds:")) {
    return { color: "#38bdf8", bgColor: "#0c4a6e", shortType: "RDS DATABASE", iconType: "rds" };
  }
  if (type.startsWith("s3:")) {
    return { color: "#10b981", bgColor: "#064e3b", shortType: "S3 BUCKET", iconType: "s3" };
  }
  if (type === "vpc:vpc") {
    return { color: "#a855f7", bgColor: "#581c87", shortType: "VPC NETWORK", iconType: "vpc" };
  }
  if (type === "vpc:subnet") {
    return { color: "#06b6d4", bgColor: "#164e63", shortType: "SUBNET ZONE", iconType: "subnet" };
  }
  if (type.startsWith("elb:")) {
    return { color: "#ec4899", bgColor: "#831843", shortType: "LOAD BALANCER", iconType: "alb" };
  }
  if (type.includes("gateway")) {
    return { color: "#0ea5e9", bgColor: "#075985", shortType: "GATEWAY", iconType: "igw" };
  }
  if (type.includes("security-group")) {
    return { color: "#ef4444", bgColor: "#7f1d1d", shortType: "SECURITY GROUP", iconType: "sg" };
  }
  return { color: "#a1a1aa", bgColor: "#27272a", shortType: "AWS RESOURCE", iconType: "default" };
}

function drawServiceIcon(
  ctx: CanvasRenderingContext2D,
  iconType: ServiceStyle["iconType"],
  color: string,
  x: number,
  y: number,
  size: number
) {
  ctx.save();
  ctx.translate(x, y);

  // Icon Background Box
  ctx.fillStyle = "rgba(24, 24, 27, 0.9)";
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(0, 0, size, size, 12);
  } else {
    ctx.rect(0, 0, size, size);
  }
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Internal Icon Graphics
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const cx = size / 2;
  const cy = size / 2;

  switch (iconType) {
    case "ec2": {
      // Server Blade Rack Icon
      const w = size * 0.58;
      const h = size * 0.16;
      for (let i = -1; i <= 1; i++) {
        const top = cy + i * (h + 7) - h / 2;
        ctx.strokeRect(cx - w / 2, top, w, h);
        // Activity dots
        ctx.beginPath();
        ctx.arc(cx - w / 2 + 10, top + h / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case "lambda": {
      // Bold Lambda λ Symbol
      ctx.font = `bold ${Math.round(size * 0.65)}px "Inter", "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("λ", cx, cy + 2);
      break;
    }

    case "rds": {
      // Cylindrical Multi-tier Database
      const rw = size * 0.52;
      const rh = size * 0.18;
      for (let i = -1; i <= 1; i++) {
        const top = cy + i * 16 - 10;
        ctx.beginPath();
        ctx.ellipse(cx, top, rw / 2, rh / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Vertical cylinder edges
      ctx.beginPath();
      ctx.moveTo(cx - rw / 2, cy - 10);
      ctx.lineTo(cx - rw / 2, cy + 18);
      ctx.moveTo(cx + rw / 2, cy - 10);
      ctx.lineTo(cx + rw / 2, cy + 18);
      ctx.stroke();
      break;
    }

    case "s3": {
      // S3 Storage Bucket
      const bw = size * 0.55;
      const bh = size * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2, cy - bh / 2 + 6);
      ctx.lineTo(cx - bw / 2 + 5, cy + bh / 2);
      ctx.lineTo(cx + bw / 2 - 5, cy + bh / 2);
      ctx.lineTo(cx + bw / 2, cy - bh / 2 + 6);
      ctx.closePath();
      ctx.stroke();

      // Bucket handle
      ctx.beginPath();
      ctx.arc(cx, cy - bh / 2 + 6, bw / 3, Math.PI, 0, true);
      ctx.stroke();
      break;
    }

    case "vpc": {
      // Cloud Silhouette
      ctx.beginPath();
      ctx.arc(cx - 10, cy + 2, 12, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(cx - 2, cy - 10, 14, Math.PI, Math.PI * 1.85);
      ctx.arc(cx + 12, cy - 4, 12, Math.PI * 1.4, Math.PI * 0.3);
      ctx.arc(cx + 4, cy + 8, 10, 0, Math.PI * 0.5);
      ctx.closePath();
      ctx.stroke();
      break;
    }

    case "subnet": {
      // Subnet Network Grid
      const step = 14;
      for (let ox = -step; ox <= step; ox += step) {
        for (let oy = -step; oy <= step; oy += step) {
          ctx.beginPath();
          ctx.arc(cx + ox, cy + oy, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.strokeRect(cx - step - 4, cy - step - 4, step * 2 + 8, step * 2 + 8);
      break;
    }

    case "alb": {
      // Load Balancer Splitter Arrows
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy);
      ctx.lineTo(cx - 2, cy);
      ctx.lineTo(cx + 14, cy - 14);
      ctx.moveTo(cx - 2, cy);
      ctx.lineTo(cx + 14, cy);
      ctx.moveTo(cx - 2, cy);
      ctx.lineTo(cx + 14, cy + 14);
      ctx.stroke();
      break;
    }

    case "igw": {
      // Gateway Portal Arch
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 16, Math.PI, 0, false);
      ctx.lineTo(cx + 16, cy + 16);
      ctx.lineTo(cx - 16, cy + 16);
      ctx.closePath();
      ctx.stroke();
      break;
    }

    default: {
      // Default Resource Hexagon
      ctx.beginPath();
      const r = size * 0.32;
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

/**
 * Creates high-resolution Realistic AWS Architecture Billboard Badges.
 * Never looks like dots or random blobs. Always crisp, readable, and realistic.
 */
export function create3DNodeObject(node: GraphNode, isSelected = false, isHovered = false): THREE.Object3D {
  const group = new THREE.Group();
  group.name = node.id;

  const style = getServiceStyle(node.type);
  const cacheKey = `${node.id}_${node.name}_${isSelected}_${isHovered}_${node.status}`;

  let texture = textureCache.get(cacheKey);

  if (!texture) {
    const canvas = document.createElement("canvas");
    canvas.width = 576;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // Crisp 2D Canvas rendering
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Card Body
      const pad = 8;
      const w = canvas.width - pad * 2;
      const h = canvas.height - pad * 2;

      ctx.fillStyle = isSelected ? "rgba(24, 24, 30, 0.98)" : "rgba(14, 14, 18, 0.92)";
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(pad, pad, w, h, 18);
      } else {
        ctx.rect(pad, pad, w, h);
      }
      ctx.fill();

      // Card Border
      ctx.lineWidth = isSelected ? 4 : isHovered ? 3 : 2;
      ctx.strokeStyle = isSelected ? style.color : isHovered ? "#ffffff" : "rgba(63, 63, 70, 0.7)";
      ctx.stroke();

      // Left Accent Color Strip
      ctx.fillStyle = style.color;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(pad, pad, 8, h, [18, 0, 0, 18]);
      } else {
        ctx.rect(pad, pad, 8, h);
      }
      ctx.fill();

      // Service Icon Box on left
      drawServiceIcon(ctx, style.iconType, style.color, 32, 28, 124);

      // Right Text Area
      const textLeft = 176;

      // Line 1: Service Type Badge
      ctx.font = "bold 18px 'JetBrains Mono', monospace";
      ctx.fillStyle = style.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(style.shortType, textLeft, 32);

      // Line 2: Resource Name
      ctx.font = "bold 26px 'Inter', sans-serif";
      ctx.fillStyle = "#ffffff";
      let displayName = node.name || node.id;
      if (displayName.length > 22) {
        displayName = displayName.slice(0, 20) + "…";
      }
      ctx.fillText(displayName, textLeft, 62);

      // Line 3: Region / Spec / Subnet Info
      ctx.font = "500 18px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#a1a1aa";
      let metaText = node.region || "us-east-1";
      if (node.subGroup) {
        metaText += ` • ${node.subGroup.slice(0, 16)}`;
      } else if (node.group) {
        metaText += ` • ${node.group.slice(0, 16)}`;
      }
      ctx.fillText(metaText, textLeft, 102);

      // Top Right: Status Pill
      const statusX = canvas.width - 32;
      const statusY = 32;
      const isHealthy = !node.status || node.status.toLowerCase() === "running" || node.status.toLowerCase() === "healthy";
      const statusColor = isHealthy ? "#22c55e" : "#f59e0b";

      ctx.beginPath();
      ctx.arc(statusX - 10, statusY + 10, 6, 0, Math.PI * 2);
      ctx.fillStyle = statusColor;
      ctx.fill();

      ctx.font = "bold 15px 'Inter', sans-serif";
      ctx.fillStyle = statusColor;
      ctx.textAlign = "right";
      ctx.fillText(isHealthy ? "ONLINE" : "PENDING", statusX - 22, statusY + 2);
    }

    texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    textureCache.set(cacheKey, texture);
  }

  // Realistic 3D Architectural Card Mesh (PlaneGeometry with double-sided material)
  const scale = node.type === "vpc:vpc" ? 44 : node.type === "vpc:subnet" ? 38 : 32;
  const geo = new THREE.PlaneGeometry(scale, scale / 3.2);
  geo.computeBoundingSphere();

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const cardMesh = new THREE.Mesh(geo, mat);
  cardMesh.userData = { isBillboardCard: true };
  group.add(cardMesh);

  // If node is a VPC or Subnet, also render a subtle architectural ground perimeter
  if (node.type === "vpc:vpc") {
    const padGeo = new THREE.CylinderGeometry(28, 28, 1, 32);
    const padMat = new THREE.MeshBasicMaterial({
      color: 0x581c87,
      transparent: true,
      opacity: 0.18,
      wireframe: true,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = -12;
    group.add(pad);
  } else if (node.type === "vpc:subnet") {
    const padGeo = new THREE.CylinderGeometry(20, 20, 1, 24);
    const padMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.15,
      wireframe: true,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = -10;
    group.add(pad);
  }

  return group;
}
