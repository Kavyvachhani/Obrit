import React, { useEffect, useRef } from "react";
import ForceGraph2D from "force-graph";
import { useGraphStore } from "../../stores/graph-store.js";
import { RESOURCE_TYPE_COLORS } from "@orbit/core";
import type { GraphNode, GraphLink } from "@orbit/core";

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

  const filteredNodes = React.useMemo(() => {
    return nodes.filter((n) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          n.name.toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q) ||
          n.arn.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (filterCategory === "compute") return n.type.startsWith("ec2:") || n.type.startsWith("lambda:");
      if (filterCategory === "network") return n.type.startsWith("vpc:") || n.type.startsWith("elb:");
      if (filterCategory === "database") return n.type.startsWith("rds:");
      if (filterCategory === "storage") return n.type.startsWith("s3:");
      if (filterCategory === "security") return n.type.includes("security-group") || n.type.startsWith("iam:");
      return true;
    });
  }, [nodes, filterCategory, searchQuery]);

  const activeNodeIds = React.useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredLinks = React.useMemo(() => {
    return links.filter(
      (l) =>
        activeNodeIds.has(typeof l.source === "object" ? (l.source as GraphNode).id : (l.source as string)) &&
        activeNodeIds.has(typeof l.target === "object" ? (l.target as GraphNode).id : (l.target as string))
    );
  }, [links, activeNodeIds]);

  useEffect(() => {
    if (!containerRef.current) return;

    const fg = new ForceGraph2D(containerRef.current)
      .backgroundColor("#060911")
      .nodeCanvasObject((node, ctx, globalScale) => {
        const gNode = node as unknown as GraphNode;
        const x = (node as { x: number }).x;
        const y = (node as { y: number }).y;
        const isSelected = selectedNode?.id === gNode.id;
        const isHovered = hoveredNode?.id === gNode.id;
        const color = (RESOURCE_TYPE_COLORS as Record<string, string>)[gNode.type] || "#38bdf8";

        const size = gNode.type === "vpc:vpc" ? 18 : gNode.type === "vpc:subnet" ? 14 : 10;

        // Selection glow ring
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(x, y, size + 5, 0, 2 * Math.PI, false);
          ctx.fillStyle = isSelected ? "rgba(56, 189, 248, 0.4)" : "rgba(168, 85, 247, 0.3)";
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI, false);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isSelected ? "#ffffff" : "rgba(0, 0, 0, 0.4)";
        ctx.stroke();

        // Node label
        const fontSize = 11 / globalScale;
        ctx.font = `600 ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isSelected ? "#38bdf8" : "#f1f5f9";
        ctx.fillText(gNode.name, x, y + size + 3);
      })
      .nodePointerAreaPaint((node, color, ctx) => {
        const x = (node as { x: number }).x;
        const y = (node as { y: number }).y;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, 2 * Math.PI, false);
        ctx.fill();
      })
      .onNodeClick((node) => {
        selectNode(node as unknown as GraphNode);
      })
      .onNodeHover((node) => {
        hoverNode(node ? (node as unknown as GraphNode) : null);
      })
      .linkDirectionalParticles(2)
      .linkDirectionalParticleSpeed(0.005)
      .linkDirectionalParticleWidth(2)
      .linkDirectionalParticleColor(() => "#38bdf8")
      .linkColor(() => "rgba(56, 189, 248, 0.3)");

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

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
