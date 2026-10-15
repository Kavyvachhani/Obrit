import React, { useEffect, useRef } from "react";
import ForceGraph3D, { ForceGraph3DInstance } from "3d-force-graph";
import * as THREE from "three";
import { useGraphStore } from "../../stores/graph-store.js";
import { create3DNodeObject } from "./node-3d-factory.js";
import type { GraphNode, GraphLink } from "@orbit/core";

export const Graph3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph3DInstance | null>(null);

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

  // Filter nodes & links based on search / category filter
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

      if (filterCategory === "compute") {
        return n.type.startsWith("ec2:") || n.type.startsWith("lambda:");
      }
      if (filterCategory === "network") {
        return n.type.startsWith("vpc:") || n.type.startsWith("elb:");
      }
      if (filterCategory === "database") {
        return n.type.startsWith("rds:");
      }
      if (filterCategory === "storage") {
        return n.type.startsWith("s3:");
      }
      if (filterCategory === "security") {
        return n.type.includes("security-group") || n.type.startsWith("iam:");
      }
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

    // Initialize 3D Force Graph
    const fg = new ForceGraph3D(containerRef.current)
      .backgroundColor("#060911")
      .showNavInfo(false)
      .nodeThreeObject((node) => {
        const gNode = node as unknown as GraphNode;
        const isSelected = selectedNode?.id === gNode.id;
        const isHovered = hoveredNode?.id === gNode.id;
        return create3DNodeObject(gNode, isSelected, isHovered);
      })
      .nodeLabel((node) => {
        const gNode = node as unknown as GraphNode;
        return `<div style="background: rgba(13,20,36,0.9); border: 1px solid #38bdf8; border-radius: 6px; padding: 6px 10px; color: #fff; font-family: sans-serif; font-size: 12px; pointer-events: none;">
          <div style="font-weight: 600; color: #38bdf8;">${gNode.name}</div>
          <div style="color: #94a3b8; font-size: 11px;">${gNode.type}</div>
        </div>`;
      })
      .onNodeClick((node) => {
        const gNode = node as unknown as GraphNode;
        selectNode(gNode);

        // Smooth camera fly-to node
        if (graphRef.current && (node as { x?: number; y?: number; z?: number }).x !== undefined) {
          const { x = 0, y = 0, z = 0 } = node as { x: number; y: number; z: number };
          const dist = 90;
          graphRef.current.cameraPosition(
            { x: x + dist * 0.7, y: y + dist * 0.5, z: z + dist },
            { x, y, z },
            1200
          );
        }
      })
      .onNodeHover((node) => {
        hoverNode(node ? (node as unknown as GraphNode) : null);
      })
      .onBackgroundClick(() => {
        selectNode(null);
      })
      // Link styling & particle animations (energy packets moving between resources)
      .linkDirectionalParticles(3)
      .linkDirectionalParticleSpeed(0.006)
      .linkDirectionalParticleWidth(2.5)
      .linkDirectionalParticleColor(() => "#38bdf8")
      .linkColor((link) => {
        const gLink = link as unknown as GraphLink;
        if (gLink.relationshipType === "contained-in") return "rgba(56, 189, 248, 0.25)";
        if (gLink.relationshipType === "routes-to") return "rgba(168, 85, 247, 0.5)";
        if (gLink.relationshipType === "targets") return "rgba(244, 63, 94, 0.5)";
        return "rgba(148, 163, 184, 0.25)";
      })
      .linkWidth((link) => {
        const gLink = link as unknown as GraphLink;
        if (gLink.relationshipType === "routes-to") return 2;
        return 1;
      });

    // Add cinematic Three.js lighting & starfield
    const scene = fg.scene();
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.8);
    dirLight1.position.set(200, 300, 200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa855f7, 1.2);
    dirLight2.position.set(-200, -200, -100);
    scene.add(dirLight2);

    // Subtle starry space background
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 600;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 2000;
      starPositions[i + 1] = (Math.random() - 0.5) * 2000;
      starPositions[i + 2] = (Math.random() - 0.5) * 2000;
    }
    starsGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 2,
      transparent: true,
      opacity: 0.6,
    });
    const starField = new THREE.Points(starsGeo, starMat);
    scene.add(starField);

    graphRef.current = fg;

    // Handle container resize
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

  // Update graph data on change
  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.graphData({
      nodes: filteredNodes.map((n) => ({ ...n })),
      links: filteredLinks.map((l) => ({ ...l })),
    });
  }, [filteredNodes, filteredLinks]);

  // Re-render node meshes on selection change
  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.nodeThreeObject(graphRef.current.nodeThreeObject());
  }, [selectedNode, hoveredNode]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
