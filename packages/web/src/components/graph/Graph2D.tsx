import React, { useEffect, useRef } from "react";
import ForceGraph2D from "force-graph";
import { useGraphStore } from "../../stores/graph-store.js";
import { filterGraphData } from "../../lib/filter-helper.js";
import {
  applyStructuredArchitectureLayout,
  getOptimizedLinks,
  SubnetBounds,
  VpcBounds,
  ContainerBounds,
} from "../../lib/architecture-layout.js";
import {
  getServiceStyle,
  drawOfficialAwsVectorIcon,
  getNodeVisualStatus,
  getStatusColor,
} from "./node-3d-factory.js";
import type { GraphNode, GraphLink } from "@orbit/core";

/* ─────────────────────────────────────────────────────────────
   2D ARCHITECTURE DIAGRAM VIEW
   
   Professional AWS reference-architecture diagram renderer
   matching Visio/Lucidchart/draw.io standards:
   - Clean labeled zone boundaries (VPC, AZ, Subnet, Regional)
   - Official AWS service icon badges per resource
   - Structured, non-overlapping card layout
   - Animated traffic-flow particles on routing links
   - Isometric-style grid background
   ─────────────────────────────────────────────────────────── */
export const Graph2D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const pointerPosRef = useRef({ x: 0, y: 0 });
  const lastPointerMove = useRef(0);

  const {
    nodes,
    links,
    selectedNode,
    hoveredNode,
    hoveredLink,
    filterCategory,
    searchQuery,
    isGrouped,
    isLiveTrafficActive,
    focusedBlastRadiusNodeId,
    selectNode,
    hoverNode,
    hoverLink,
    setEdgeTooltip,
  } = useGraphStore();

  const { filteredNodes, filteredLinks } = React.useMemo(() => {
    return filterGraphData(nodes, links, filterCategory, searchQuery);
  }, [nodes, links, filterCategory, searchQuery]);

  const { positionedNodes, subnetBounds, vpcBounds, azBounds, regionalBounds, ingressBounds } = React.useMemo(() => {
    return applyStructuredArchitectureLayout(filteredNodes, false, isGrouped);
  }, [filteredNodes, isGrouped]);

  // Fast node lookup map
  const nodeMap = React.useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const n of positionedNodes) {
      map.set(n.id, n);
    }
    return map;
  }, [positionedNodes]);

  // Filter to only traffic/routing links between mapped nodes with trunk optimization
  const trafficLinks = React.useMemo(() => {
    return getOptimizedLinks(filteredLinks, positionedNodes, isGrouped, selectedNode?.id, hoveredNode?.id);
  }, [filteredLinks, positionedNodes, isGrouped, selectedNode?.id, hoveredNode?.id]);

  // Throttled pointer tracking on container
  const handlePointerMove = (e: React.PointerEvent) => {
    const now = performance.now();
    if (now - lastPointerMove.current < 20) return; // ~50fps throttle
    lastPointerMove.current = now;
    pointerPosRef.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const CARD_W = 210;
    const CARD_H = 70;

    const fg = new ForceGraph2D(containerRef.current)
      .backgroundColor("#0B0E14")
      /* ════════════════════════════════════════════════════════
         BACKGROUND: Zone Boundaries, Grid, & Architecture Containers
         ════════════════════════════════════════════════════════ */
      .onRenderFramePre((ctx) => {
        ctx.save();

        // ── Subtle dot-grid pattern ──
        ctx.fillStyle = "rgba(255,255,255,0.018)";
        const gridStep = 40;
        const viewBounds = { x1: -800, y1: -500, x2: 900, y2: 500 };
        for (let gx = viewBounds.x1; gx <= viewBounds.x2; gx += gridStep) {
          for (let gy = viewBounds.y1; gy <= viewBounds.y2; gy += gridStep) {
            ctx.beginPath();
            ctx.arc(gx, gy, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // ── 0. Edge Ingress Container ──
        for (const ing of ingressBounds) {
          drawZoneBoundary(ctx, ing, {
            fillColor: "rgba(136,147,166,0.02)",
            strokeColor: "rgba(136,147,166,0.45)",
            headerBg: "#262D3A",
            headerText: ing.name,
            headerIcon: "⚡",
            lineWidth: 1.4,
            dashPattern: [6, 5],
            radius: 12,
          });
        }

        // ── 1. VPC Boundary Container ──
        for (const vpc of vpcBounds) {
          drawZoneBoundary(ctx, vpc, {
            fillColor: "rgba(140,79,255,0.018)",
            strokeColor: "rgba(140,79,255,0.5)",
            headerBg: "#8C4FFF",
            headerText: `VPC: prod-vpc-main (${vpc.cidr})`,
            headerIcon: "☁",
            lineWidth: 2,
            dashPattern: [],
            radius: 16,
          });
        }

        // ── 2. Availability Zone Containers ──
        for (const az of azBounds) {
          const isA = az.azLabel === "us-east-1a";
          drawZoneBoundary(ctx, az, {
            fillColor: isA ? "rgba(255,153,0,0.012)" : "rgba(56,189,248,0.012)",
            strokeColor: isA ? "rgba(255,153,0,0.4)" : "rgba(56,189,248,0.4)",
            headerBg: isA ? "#FF9900" : "#38bdf8",
            headerText: az.name,
            headerIcon: isA ? "🅰" : "🅱",
            lineWidth: 1.5,
            dashPattern: [8, 5],
            radius: 12,
          });
        }

        // ── 3. Subnet Containers ──
        for (const sub of subnetBounds) {
          const isPublic = sub.isPublic;
          const isDb = sub.name.toLowerCase().includes("db") || sub.name.toLowerCase().includes("database");
          const strokeColor = isPublic ? "rgba(6,182,212,0.45)" : isDb ? "rgba(59,72,204,0.45)" : "rgba(59,130,246,0.45)";
          const fillColor = isPublic ? "rgba(6,182,212,0.02)" : isDb ? "rgba(59,72,204,0.02)" : "rgba(59,130,246,0.02)";
          const headerBg = isPublic ? "#06b6d4" : isDb ? "#3B48CC" : "#3b82f6";

          drawZoneBoundary(ctx, sub, {
            fillColor,
            strokeColor,
            headerBg,
            headerText: sub.name,
            headerIcon: isPublic ? "🌐" : isDb ? "💾" : "🔒",
            lineWidth: 1.2,
            dashPattern: [5, 4],
            radius: 8,
          });
        }

        // ── 4. Regional Services Container ──
        for (const reg of regionalBounds) {
          drawZoneBoundary(ctx, reg, {
            fillColor: "rgba(63,134,36,0.02)",
            strokeColor: "rgba(63,134,36,0.45)",
            headerBg: "#3F8624",
            headerText: reg.name,
            headerIcon: "🌍",
            lineWidth: 1.4,
            dashPattern: [6, 5],
            radius: 14,
          });
        }

        ctx.restore();
      })

      /* ════════════════════════════════════════════════════════
         NODE RENDERING: Professional AWS Resource Cards
         ════════════════════════════════════════════════════════ */
      .nodeCanvasObject((node, ctx) => {
        const gNode = node as unknown as GraphNode;
        const x = (node as { x: number }).x;
        const y = (node as { y: number }).y;
        const isSelected = selectedNode?.id === gNode.id;
        const isHovered = hoveredNode?.id === gNode.id;
        const visualStatus = getNodeVisualStatus(gNode, isSelected);
        const statusColor = getStatusColor(visualStatus);
        const isIncomplete = visualStatus === "incomplete";

        // Dim nodes that are not endpoints of the currently hovered edge
        let isConnectedToHoveredEdge = true;
        if (hoveredLink) {
          const hSrcId = typeof hoveredLink.source === "object" ? (hoveredLink.source as any).id : hoveredLink.source;
          const hTgtId = typeof hoveredLink.target === "object" ? (hoveredLink.target as any).id : hoveredLink.target;
          isConnectedToHoveredEdge = gNode.id === hSrcId || gNode.id === hTgtId;
        }

        const style = getServiceStyle(gNode.type, gNode.name);
        const w = CARD_W;
        const h = CARD_H;
        const rx = x - w / 2;
        const ry = y - h / 2;

        ctx.save();
        if (hoveredLink && !isConnectedToHoveredEdge) {
          ctx.globalAlpha = 0.22;
        }

        // ── Status Ring / Halo on every single node (visible without clicking) ──
        ctx.shadowColor = statusColor;
        ctx.shadowBlur = isSelected ? 20 : isHovered ? 14 : 8;

        // ── Card body ──
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(rx, ry, w, h, 10);
        else ctx.rect(rx, ry, w, h);
        ctx.fillStyle = isSelected ? "#1a1a24" : isHovered ? "#14141c" : "#0e0e14";
        ctx.fill();

        // Reset shadow for crisp borders
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        // ── Card border (Exact status color, or grey dashed for incomplete) ──
        if (isIncomplete) {
          ctx.strokeStyle = "#8893A6";
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.setLineDash([7, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = statusColor;
          ctx.lineWidth = isSelected ? 2.5 : isHovered ? 2 : 1.5;
          ctx.stroke();
        }

        // ── Left color accent bar in status color ──
        ctx.fillStyle = isIncomplete ? "#8893A6" : statusColor;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(rx, ry, 5, h, [10, 0, 0, 10]);
        else ctx.rect(rx, ry, 5, h);
        ctx.fill();

        // ── AWS Service Icon Badge (Large & Crisp) ──
        const iconSize = 48;
        const iconX = rx + 12;
        const iconY = ry + (h - iconSize) / 2;
        drawOfficialAwsVectorIcon(ctx, style.iconType, isIncomplete ? "#475569" : style.badgeBg, iconX, iconY, iconSize);

        // ── Text Content ──
        const textX = iconX + iconSize + 11;
        const isCluster = Boolean((gNode.rawConfig as any)?.isCluster);

        // Service type tag
        ctx.font = "bold 9.5px 'Inter', sans-serif";
        ctx.fillStyle = isIncomplete ? "#8893A6" : (isCluster ? "#38BDF8" : style.color);
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const tagText = isCluster
          ? `FLEET • ${(gNode.rawConfig as any).totalCount}`
          : isIncomplete ? `${style.shortType} • INCOMPLETE` : style.shortType;
        ctx.fillText(tagText, textX, ry + 11);

        // Resource name (bold & high-visibility)
        ctx.font = "600 13px 'Inter', sans-serif";
        ctx.fillStyle = "#ffffff";
        let title = gNode.name || gNode.id;
        if (title.length > 20) title = title.slice(0, 19) + "…";
        ctx.fillText(title, textX, ry + 25);

        // Config detail
        ctx.font = "500 9.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = isIncomplete ? "#cbd5e1" : "#8892a0";
        let detail = gNode.region || "us-east-1";
        if (isCluster) {
          const raw = (gNode.rawConfig as any) || {};
          detail = `${raw.healthyCount || raw.totalCount} Healthy • ${raw.exposedCount || 0} Alert`;
        } else if (isIncomplete && gNode.scanError) {
          detail = `⚠️ Scan gap: ${gNode.scanError.code}`;
        } else if (gNode.rawConfig && (gNode.rawConfig as any).InstanceType) {
          detail = `${(gNode.rawConfig as any).InstanceType} • ${(gNode.rawConfig as any).PrivateIpAddress || "10.0.x"}`;
        } else if (gNode.rawConfig && (gNode.rawConfig as any).Runtime) {
          detail = (gNode.rawConfig as any).Runtime;
        } else if (gNode.rawConfig && (gNode.rawConfig as any).Engine) {
          detail = (gNode.rawConfig as any).Engine;
        } else if (gNode.rawConfig && (gNode.rawConfig as any).CidrBlock) {
          detail = (gNode.rawConfig as any).CidrBlock;
        } else if (gNode.subGroup) {
          detail = gNode.subGroup.slice(0, 16);
        }
        if (detail.length > 22) detail = detail.slice(0, 21) + "…";
        ctx.fillText(detail, textX, ry + 44);

        // ── Health Status Indicator (top right) ──
        if (isIncomplete) {
          // Distinct grey dashed ring + dot (NEVER red/amber/green)
          ctx.save();
          ctx.setLineDash([2, 2]);
          ctx.strokeStyle = "#8893A6";
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(rx + w - 12, ry + 12, 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          ctx.beginPath();
          ctx.arc(rx + w - 12, ry + 12, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#8893A6";
          ctx.fill();

          ctx.font = "bold 7px 'JetBrains Mono', monospace";
          ctx.fillStyle = "#8893A6";
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          ctx.fillText("SCAN GAP", rx + w - 21, ry + 12);
        } else {
          ctx.beginPath();
          ctx.arc(rx + w - 12, ry + 12, 4, 0, Math.PI * 2);
          ctx.fillStyle = statusColor;
          ctx.fill();
          // Glow ring
          ctx.beginPath();
          ctx.arc(rx + w - 12, ry + 12, 6, 0, Math.PI * 2);
          ctx.strokeStyle = statusColor;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.font = "bold 7.5px 'JetBrains Mono', monospace";
          ctx.fillStyle = statusColor;
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          ctx.fillText(visualStatus.toUpperCase(), rx + w - 21, ry + 12);
        }

        ctx.restore();
      })
      .nodePointerAreaPaint((node, color, ctx) => {
        const x = (node as { x: number }).x;
        const y = (node as { y: number }).y;
        ctx.fillStyle = color;
        ctx.fillRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H);
      })
      .onNodeClick((node) => selectNode(node as unknown as GraphNode))
      .onNodeHover((node) => hoverNode(node ? (node as unknown as GraphNode) : null))
      .onBackgroundClick(() => {
        selectNode(null);
        hoverLink(null);
        setEdgeTooltip(null);
      })

      /* ════════════════════════════════════════════════════════
         LINK RENDERING: Traffic Flow & Edge Hover Highlight
         ════════════════════════════════════════════════════════ */
      .linkHoverPrecision(10)
      .onLinkHover((link) => {
        if (!link) {
          hoverLink(null);
          setEdgeTooltip(null);
          return;
        }
        const gLink = link as unknown as GraphLink;
        hoverLink(gLink);
        const srcId = typeof gLink.source === "object" ? (gLink.source as any).id : gLink.source;
        const tgtId = typeof gLink.target === "object" ? (gLink.target as any).id : gLink.target;
        const srcNode = nodeMap.get(srcId);
        const tgtNode = nodeMap.get(tgtId);
        const isInferred = Boolean(gLink.isInferred || srcNode?.status === "incomplete" || tgtNode?.status === "incomplete");
        setEdgeTooltip({
          x: pointerPosRef.current.x,
          y: pointerPosRef.current.y,
          link: gLink,
          sourceName: srcNode?.name || srcId,
          targetName: tgtNode?.name || tgtId,
          relation: gLink.relationshipType || "routes-to",
          isInferred,
          unverifiedReason: gLink.unverifiedReason,
        });
      })
      .onLinkClick((link, event) => {
        const gLink = link as unknown as GraphLink;
        hoverLink(gLink);
        const srcId = typeof gLink.source === "object" ? (gLink.source as any).id : gLink.source;
        const tgtId = typeof gLink.target === "object" ? (gLink.target as any).id : gLink.target;
        const srcNode = nodeMap.get(srcId);
        const tgtNode = nodeMap.get(tgtId);
        const isInferred = Boolean(gLink.isInferred || srcNode?.status === "incomplete" || tgtNode?.status === "incomplete");
        setEdgeTooltip({
          x: (event as any).clientX || pointerPosRef.current.x,
          y: (event as any).clientY || pointerPosRef.current.y,
          link: gLink,
          sourceName: srcNode?.name || srcId,
          targetName: tgtNode?.name || tgtId,
          relation: gLink.relationshipType || "routes-to",
          isInferred,
          unverifiedReason: gLink.unverifiedReason,
        });
      })
      .linkLineDash((link) => {
        const gLink = link as unknown as GraphLink;
        const srcId = typeof gLink.source === "object" ? (gLink.source as any).id : gLink.source;
        const tgtId = typeof gLink.target === "object" ? (gLink.target as any).id : gLink.target;
        const srcNode = nodeMap.get(srcId);
        const tgtNode = nodeMap.get(tgtId);
        const isInferred = Boolean(gLink.isInferred || srcNode?.status === "incomplete" || tgtNode?.status === "incomplete");
        return isInferred ? [6, 4] : null;
      })
      // Traffic particle flow (live AWS packet flow + blast radius illumination)
      .linkDirectionalParticles((link) => {
        const gLink = link as unknown as GraphLink;
        const srcId = typeof gLink.source === "object" ? (gLink.source as any).id : gLink.source;
        const tgtId = typeof gLink.target === "object" ? (gLink.target as any).id : gLink.target;

        if (focusedBlastRadiusNodeId && (srcId === focusedBlastRadiusNodeId || tgtId === focusedBlastRadiusNodeId)) {
          return 6;
        }

        const isHoveredEdge = hoveredLink && (hoveredLink.id === gLink.id || (hoveredLink.source === gLink.source && hoveredLink.target === gLink.target));
        if (hoveredLink) {
          return isHoveredEdge ? 6 : 0;
        }
        if (selectedNode) {
          return (srcId === selectedNode.id || tgtId === selectedNode.id) ? 5 : (isLiveTrafficActive ? 2 : 0);
        }
        if (!isLiveTrafficActive) return 0;
        return (gLink.relationshipType === "routes-to" || gLink.relationshipType === "targets") ? 3 : 2;
      })
      .linkDirectionalParticleSpeed((link) => {
        const gLink = link as unknown as GraphLink;
        const srcId = typeof gLink.source === "object" ? (gLink.source as any).id : gLink.source;
        const tgtId = typeof gLink.target === "object" ? (gLink.target as any).id : gLink.target;
        if (focusedBlastRadiusNodeId && (srcId === focusedBlastRadiusNodeId || tgtId === focusedBlastRadiusNodeId)) {
          return 0.016;
        }
        const isHoveredEdge = hoveredLink && (hoveredLink.id === gLink.id || (hoveredLink.source === gLink.source && hoveredLink.target === gLink.target));
        return isHoveredEdge ? 0.014 : 0.007;
      })
      .linkDirectionalParticleWidth((link) => {
        const gLink = link as unknown as GraphLink;
        const srcId = typeof gLink.source === "object" ? (gLink.source as any).id : gLink.source;
        const tgtId = typeof gLink.target === "object" ? (gLink.target as any).id : gLink.target;
        if (focusedBlastRadiusNodeId && (srcId === focusedBlastRadiusNodeId || tgtId === focusedBlastRadiusNodeId)) {
          return 5.0;
        }
        const isHoveredEdge = hoveredLink && (hoveredLink.id === gLink.id || (hoveredLink.source === gLink.source && hoveredLink.target === gLink.target));
        return isHoveredEdge ? 5 : 3;
      })
      .linkDirectionalParticleColor((link) => {
        const gLink = link as unknown as GraphLink;
        const isHoveredEdge = hoveredLink && (hoveredLink.id === gLink.id || (hoveredLink.source === gLink.source && hoveredLink.target === gLink.target));
        if (isHoveredEdge) return "#60A5FA";
        if (gLink.isInferred) return "#FDE047";
        return "#93C5FD";
      })
      .linkColor((link) => {
        const gLink = link as unknown as GraphLink;
        const isHoveredEdge = hoveredLink && (hoveredLink.id === gLink.id || (hoveredLink.source === gLink.source && hoveredLink.target === gLink.target));
        const srcId = typeof gLink.source === "object" ? (gLink.source as any).id : gLink.source;
        const tgtId = typeof gLink.target === "object" ? (gLink.target as any).id : gLink.target;
        const srcNode = nodeMap.get(srcId);
        const tgtNode = nodeMap.get(tgtId);
        const isInferred = Boolean(gLink.isInferred || srcNode?.status === "incomplete" || tgtNode?.status === "incomplete");

        if (hoveredLink) {
          if (isHoveredEdge) {
            return isInferred ? "#F59E0B" : "#38BDF8";
          }
          return "rgba(38,45,58,0.2)"; // Dim non-hovered edges
        }

        if (focusedBlastRadiusNodeId) {
          const isBlastEdge = (srcId === focusedBlastRadiusNodeId || tgtId === focusedBlastRadiusNodeId);
          if (isBlastEdge) return "#F59E0B";
          return "rgba(38,45,58,0.1)"; // Dim unaffected edges
        }

        if (isInferred) {
          return "#F59E0B"; // Inferred/unverified edge color (amber)
        }
        if (gLink.relationshipType === "routes-to") return "#38BDF8"; // Bright sky-blue
        if (gLink.relationshipType === "targets") return "#C084FC"; // Bright purple
        if (gLink.relationshipType === "member-of") return "#60A5FA"; // Electric blue
        return "#38BDF8";
      })
      .linkWidth((link) => {
        const gLink = link as unknown as GraphLink;
        const srcId = typeof gLink.source === "object" ? (gLink.source as any).id : gLink.source;
        const tgtId = typeof gLink.target === "object" ? (gLink.target as any).id : gLink.target;
        if (focusedBlastRadiusNodeId && (srcId === focusedBlastRadiusNodeId || tgtId === focusedBlastRadiusNodeId)) {
          return 5.0;
        }
        const isHoveredEdge = hoveredLink && (hoveredLink.id === gLink.id || (hoveredLink.source === gLink.source && hoveredLink.target === gLink.target));
        if (hoveredLink) {
          return isHoveredEdge ? 5.2 : 1.2;
        }
        return 3.2;
      })
      .linkCurvature(0.01)
      .linkDirectionalArrowLength(7.5)
      .linkDirectionalArrowRelPos(0.85)
      .linkDirectionalArrowColor((link) => {
        const gLink = link as unknown as GraphLink;
        if (gLink.isInferred) return "#F59E0B";
        if (gLink.relationshipType === "targets") return "#C084FC";
        return "#38BDF8";
      })
      .minZoom(0.08)
      .maxZoom(4.0)
      .nodeLabel(() => "")
      .linkLabel(() => "")
      .enableZoomInteraction(true)
      .enablePanInteraction(true);

    graphRef.current = fg;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && fg) {
        fg.width(containerRef.current.clientWidth);
        fg.height(containerRef.current.clientHeight);
      }
    });
    resizeObserver.observe(containerRef.current);

    const handleResetCamera = () => {
      if (fg) fg.zoomToFit(600, 60);
    };

    const handleFocusNode = (e: any) => {
      const targetId = e.detail?.id;
      const target = positionedNodes.find((n) => n.id === targetId);
      if (target && fg) {
        fg.centerAt(target.x, target.y, 800);
        fg.zoom(1.3, 800);
      }
    };

    window.addEventListener("orbit:reset-camera", handleResetCamera);
    window.addEventListener("orbit:focus-node", handleFocusNode);

    return () => {
      window.removeEventListener("orbit:reset-camera", handleResetCamera);
      window.removeEventListener("orbit:focus-node", handleFocusNode);
      resizeObserver.disconnect();
      fg._destructor();
    };
  }, [subnetBounds, vpcBounds, azBounds, regionalBounds]);

  // Update graph data & auto-frame
  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.graphData({
      nodes: positionedNodes.map((n) => ({ ...n })),
      links: trafficLinks.map((l) => ({ ...l })),
    });

    const timer = setTimeout(() => {
      if (graphRef.current) graphRef.current.zoomToFit(500, 80);
    }, 150);
    return () => clearTimeout(timer);
  }, [positionedNodes, trafficLinks]);

  // Viewport controls
  const handleZoomToFit = () => {
    if (graphRef.current) graphRef.current.zoomToFit(500, 80);
  };

  const handleZoom = (factor: number) => {
    if (graphRef.current) {
      const current = graphRef.current.zoom();
      const newZoom = Math.min(Math.max(current * factor, 0.08), 4.0);
      const center = graphRef.current.centerAt();
      graphRef.current.zoom(newZoom, 250);
      if (center && typeof center.x === "number" && typeof center.y === "number") {
        graphRef.current.centerAt(center.x, center.y, 250);
      }
    }
  };

  // Re-evaluate link and node visuals when hovered link changes
  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current
      .linkColor(graphRef.current.linkColor())
      .linkWidth(graphRef.current.linkWidth())
      .linkDirectionalParticles(graphRef.current.linkDirectionalParticles());
  }, [hoveredLink]);

  return (
    <div
      onPointerMove={handlePointerMove}
      className="relative w-full h-full overflow-hidden bg-[#0B0E14]"
    >
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Viewport Controls */}
      <div className="absolute bottom-5 right-5 z-10 flex items-center gap-1 p-1.5 bg-[#151A24]/85 backdrop-blur-md border border-[#262D3A] rounded-xl shadow-2xl">
        <button
          onClick={handleZoomToFit}
          className="px-3 py-1.5 text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 rounded-lg transition-all text-[11px] font-medium font-sans"
          title="Fit diagram to viewport"
        >
          ⊞ Fit
        </button>
        <div className="w-px h-5 bg-[#262D3A]" />
        <button
          onClick={() => handleZoom(1.3)}
          className="px-2.5 py-1.5 text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 rounded-lg transition-all text-[12px] font-medium"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => handleZoom(0.77)}
          className="px-2.5 py-1.5 text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 rounded-lg transition-all text-[12px] font-medium"
          title="Zoom Out"
        >
          −
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   HELPER: Draw a labeled zone boundary container
   ─────────────────────────────────────────────────────────── */
interface ZoneStyle {
  fillColor: string;
  strokeColor: string;
  headerBg: string;
  headerText: string;
  headerIcon: string;
  lineWidth: number;
  dashPattern: number[];
  radius: number;
}

function drawZoneBoundary(
  ctx: CanvasRenderingContext2D,
  bounds: ContainerBounds,
  style: ZoneStyle
) {
  const w = bounds.x2 - bounds.x1;
  const h = bounds.y2 - bounds.y1;

  // Background fill
  ctx.fillStyle = style.fillColor;
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.lineWidth;
  ctx.setLineDash(style.dashPattern);

  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bounds.x1, bounds.y1, w, h, style.radius);
  else ctx.rect(bounds.x1, bounds.y1, w, h);
  ctx.fill();
  ctx.stroke();

  // Header pill
  ctx.setLineDash([]);
  const headerW = Math.min(ctx.measureText(style.headerText).width + 32, w - 20);
  const headerH = 22;
  const headerX = bounds.x1 + 14;
  const headerY = bounds.y1 - headerH / 2;

  // Header background
  ctx.fillStyle = style.headerBg;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(headerX, headerY, headerW, headerH, 5);
  else ctx.rect(headerX, headerY, headerW, headerH);
  ctx.fill();

  // Header text
  ctx.font = "bold 10px 'Inter', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  // Measure text for proper header width
  const textW = ctx.measureText(style.headerText).width;
  const paddedW = textW + 24;

  // Redraw header with proper width
  ctx.fillStyle = style.headerBg;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(headerX, headerY, paddedW, headerH, 5);
  else ctx.rect(headerX, headerY, paddedW, headerH);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.fillText(style.headerText, headerX + 10, headerY + headerH / 2);
}
