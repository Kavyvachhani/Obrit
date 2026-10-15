import React, { useEffect, useRef } from "react";
import ForceGraph2D from "force-graph";
import { useGraphStore } from "../../stores/graph-store.js";
import { filterGraphData } from "../../lib/filter-helper.js";
import type { GraphNode, GraphLink } from "@orbit/core";

interface ServiceStyle {
  color: string;
  badge: string;
  iconType: "ec2" | "lambda" | "rds" | "s3" | "vpc" | "subnet" | "alb" | "igw" | "sg" | "default";
}

function getServiceStyle(type: string): ServiceStyle {
  if (type.startsWith("ec2:instance")) {
    return { color: "#ff9900", badge: "EC2", iconType: "ec2" };
  }
  if (type.startsWith("lambda:")) {
    return { color: "#f59e0b", badge: "LAMBDA", iconType: "lambda" };
  }
  if (type.startsWith("rds:")) {
    return { color: "#38bdf8", badge: "RDS", iconType: "rds" };
  }
  if (type.startsWith("s3:")) {
    return { color: "#10b981", badge: "S3", iconType: "s3" };
  }
  if (type === "vpc:vpc") {
    return { color: "#a855f7", badge: "VPC", iconType: "vpc" };
  }
  if (type === "vpc:subnet") {
    return { color: "#06b6d4", badge: "SUBNET", iconType: "subnet" };
  }
  if (type.startsWith("elb:")) {
    return { color: "#ec4899", badge: "ALB", iconType: "alb" };
  }
  if (type.includes("gateway")) {
    return { color: "#0ea5e9", badge: "GATEWAY", iconType: "igw" };
  }
  if (type.includes("security-group")) {
    return { color: "#ef4444", badge: "SG", iconType: "sg" };
  }
  return { color: "#a1a1aa", badge: "AWS", iconType: "default" };
}

function drawVectorIcon(
  ctx: CanvasRenderingContext2D,
  iconType: ServiceStyle["iconType"],
  color: string,
  x: number,
  y: number,
  size: number
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const cx = x + size / 2;
  const cy = y + size / 2;

  switch (iconType) {
    case "ec2": {
      // 3 server blades with activity dot
      const w = size * 0.65;
      const h = size * 0.18;
      for (let i = -1; i <= 1; i++) {
        const top = cy + i * (h + 3) - h / 2;
        ctx.strokeRect(cx - w / 2, top, w, h);
        ctx.beginPath();
        ctx.arc(cx - w / 2 + 5, top + h / 2, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case "lambda": {
      // Clean Greek lambda λ symbol
      ctx.font = `bold ${Math.round(size * 0.75)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("λ", cx, cy + 1);
      break;
    }

    case "rds": {
      // 3-tier database cylinder
      const rw = size * 0.6;
      const rh = size * 0.22;
      for (let i = -1; i <= 1; i++) {
        const top = cy + i * 6 - 3;
        ctx.beginPath();
        ctx.ellipse(cx, top, rw / 2, rh / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - rw / 2, cy - 3);
      ctx.lineTo(cx - rw / 2, cy + 7);
      ctx.moveTo(cx + rw / 2, cy - 3);
      ctx.lineTo(cx + rw / 2, cy + 7);
      ctx.stroke();
      break;
    }

    case "s3": {
      // S3 Storage bucket
      const bw = size * 0.6;
      const bh = size * 0.55;
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2, cy - bh / 2 + 4);
      ctx.lineTo(cx - bw / 2 + 3, cy + bh / 2);
      ctx.lineTo(cx + bw / 2 - 3, cy + bh / 2);
      ctx.lineTo(cx + bw / 2, cy - bh / 2 + 4);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy - bh / 2 + 4, bw / 3, Math.PI, 0, true);
      ctx.stroke();
      break;
    }

    case "vpc": {
      // Cloud silhouette
      ctx.beginPath();
      ctx.arc(cx - 5, cy + 1, 6, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(cx - 1, cy - 5, 7, Math.PI, Math.PI * 1.85);
      ctx.arc(cx + 6, cy - 2, 6, Math.PI * 1.4, Math.PI * 0.3);
      ctx.arc(cx + 2, cy + 4, 5, 0, Math.PI * 0.5);
      ctx.closePath();
      ctx.stroke();
      break;
    }

    case "subnet": {
      // Network grid
      const s = 6;
      for (let ox = -s; ox <= s; ox += s) {
        for (let oy = -s; oy <= s; oy += s) {
          ctx.beginPath();
          ctx.arc(cx + ox, cy + oy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }

    case "alb": {
      // Load balancer distribution arrows
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + 7, cy - 7);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 7, cy);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 7, cy + 7);
      ctx.stroke();
      break;
    }

    default: {
      // Clean square badge
      ctx.strokeRect(cx - 6, cy - 6, 12, 12);
      break;
    }
  }

  ctx.restore();
}

export const Graph2D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);

  const {
    nodes,
    links,
    selectedNode,
    hoveredNode,
    filterCategory,
    searchQuery,
    selectNode,
    hoverNode,
  } = useGraphStore();

  const { filteredNodes, filteredLinks } = React.useMemo(() => {
    return filterGraphData(nodes, links, filterCategory, searchQuery);
  }, [nodes, links, filterCategory, searchQuery]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Card dimensions in 2D coordinate space
    const CARD_WIDTH = 136;
    const CARD_HEIGHT = 44;

    const fg = new ForceGraph2D(containerRef.current)
      .backgroundColor("#09090b")
      // Strong repulsion to prevent overlapping
      .d3VelocityDecay(0.3)
      .nodeCanvasObject((node, ctx, globalScale) => {
        const gNode = node as unknown as GraphNode;
        const x = (node as { x: number }).x;
        const y = (node as { y: number }).y;
        const isSelected = selectedNode?.id === gNode.id;
        const isHovered = hoveredNode?.id === gNode.id;

        const style = getServiceStyle(gNode.type);
        const w = CARD_WIDTH;
        const h = CARD_HEIGHT;
        const rx = x - w / 2;
        const ry = y - h / 2;

        ctx.save();

        // 1. Selection outer halo
        if (isSelected) {
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(rx - 3, ry - 3, w + 6, h + 6, 10);
          } else {
            ctx.rect(rx - 3, ry - 3, w + 6, h + 6);
          }
          ctx.strokeStyle = style.color;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // 2. Card Background
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(rx, ry, w, h, 8);
        } else {
          ctx.rect(rx, ry, w, h);
        }
        ctx.fillStyle = isSelected ? "#1c1c22" : isHovered ? "#18181f" : "#121216";
        ctx.fill();

        // 3. Card Border
        ctx.strokeStyle = isSelected ? style.color : isHovered ? "#a1a1aa" : "rgba(63, 63, 70, 0.7)";
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // 4. Left accent color strip
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(rx, ry, 5, h, [8, 0, 0, 8]);
        } else {
          ctx.rect(rx, ry, 5, h);
        }
        ctx.fillStyle = style.color;
        ctx.fill();

        // 5. Service Icon Box
        const iconSize = 28;
        const iconX = rx + 12;
        const iconY = ry + (h - iconSize) / 2;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(iconX, iconY, iconSize, iconSize, 6);
        } else {
          ctx.rect(iconX, iconY, iconSize, iconSize);
        }
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.fill();
        ctx.strokeStyle = `${style.color}50`;
        ctx.lineWidth = 1;
        ctx.stroke();

        drawVectorIcon(ctx, style.iconType, style.color, iconX, iconY, iconSize);

        // 6. Text Information Area
        const textX = iconX + iconSize + 8;

        // Line 1: Service Type
        ctx.font = "bold 8.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = style.color;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(style.badge, textX, ry + 7);

        // Line 2: Resource Name
        ctx.font = "bold 11px 'Inter', sans-serif";
        ctx.fillStyle = "#ffffff";
        let title = gNode.name || gNode.id;
        if (title.length > 13) {
          title = title.slice(0, 12) + "…";
        }
        ctx.fillText(title, textX, ry + 17);

        // Line 3: Meta detail / region / IP
        ctx.font = "500 8.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#a1a1aa";
        let detail = gNode.region || "us-east-1";
        if (gNode.subGroup) {
          detail = gNode.subGroup.length > 12 ? gNode.subGroup.slice(0, 10) + "…" : gNode.subGroup;
        } else if (gNode.group) {
          detail = gNode.group.length > 12 ? gNode.group.slice(0, 10) + "…" : gNode.group;
        }
        ctx.fillText(detail, textX, ry + 30);

        // 7. Status Indicator Dot
        const statusStr = (gNode.status || "").toLowerCase();
        const isHealthy = !gNode.status || statusStr === "healthy" || statusStr === "available" || statusStr === "running";
        ctx.beginPath();
        ctx.arc(rx + w - 10, ry + 10, 3, 0, Math.PI * 2);
        ctx.fillStyle = isHealthy ? "#22c55e" : "#f59e0b";
        ctx.fill();

        ctx.restore();
      })
      .nodePointerAreaPaint((node, color, ctx) => {
        const x = (node as { x: number }).x;
        const y = (node as { y: number }).y;
        ctx.fillStyle = color;
        ctx.fillRect(x - CARD_WIDTH / 2, y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);
      })
      .onNodeClick((node) => {
        selectNode(node as unknown as GraphNode);
      })
      .onNodeHover((node) => {
        hoverNode(node ? (node as unknown as GraphNode) : null);
      })
      // ─── Real Animated Traffic Movement Along Links ──────────────────────
      .linkDirectionalParticles(4)
      .linkDirectionalParticleSpeed(0.007)
      .linkDirectionalParticleWidth(3.2)
      .linkDirectionalParticleColor((link) => {
        const gLink = link as unknown as GraphLink;
        if (gLink.relationshipType === "contained-in") return "#a855f7"; // Purple network flow
        if (gLink.relationshipType === "routes-to") return "#ff9900"; // Orange compute routing
        if (gLink.relationshipType === "targets") return "#38bdf8"; // Blue database query
        return "#10b981"; // Green storage transfer
      })
      .linkColor((link) => {
        const gLink = link as unknown as GraphLink;
        if (gLink.relationshipType === "contained-in") return "rgba(168, 85, 247, 0.25)";
        if (gLink.relationshipType === "routes-to") return "rgba(255, 153, 0, 0.35)";
        return "rgba(113, 113, 122, 0.3)";
      })
      .linkWidth((link) => {
        const gLink = link as unknown as GraphLink;
        return gLink.relationshipType === "routes-to" ? 2 : 1.2;
      });

    // Configure strong repulsion so cards never overlap
    const chargeForce = fg.d3Force("charge");
    if (chargeForce && typeof chargeForce.strength === "function") {
      chargeForce.strength(-650);
    }
    const linkForce = fg.d3Force("link");
    if (linkForce && typeof linkForce.distance === "function") {
      linkForce.distance(120);
    }

    graphRef.current = fg;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && fg) {
        fg.width(containerRef.current.clientWidth);
        fg.height(containerRef.current.clientHeight);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      fg._destructor();
    };
  }, []);

  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.graphData({
      nodes: filteredNodes.map((n) => ({ ...n })),
      links: filteredLinks.map((l) => ({ ...l })),
    });
  }, [filteredNodes, filteredLinks]);

  // Viewport action helpers
  const handleReset = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(600, 60);
    }
  };

  const handleZoom = (factor: number) => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * factor, 300);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#09090b]">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Canvas Controls */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center space-x-1.5 p-1 bg-[#141418] border border-[#27272a] rounded-lg shadow-md font-mono text-xs">
        <button
          onClick={handleReset}
          className="px-2.5 py-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors text-[11px]"
          title="Zoom to Fit"
        >
          Zoom to Fit
        </button>
        <span className="text-zinc-600">|</span>
        <button
          onClick={() => handleZoom(1.3)}
          className="px-2 py-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors text-[11px]"
          title="Zoom In"
        >
          + Zoom
        </button>
        <button
          onClick={() => handleZoom(0.75)}
          className="px-2 py-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors text-[11px]"
          title="Zoom Out"
        >
          - Zoom
        </button>
      </div>
    </div>
  );
};
