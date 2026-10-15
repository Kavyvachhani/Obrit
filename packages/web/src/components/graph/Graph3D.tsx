import React, { useEffect, useRef } from "react";
import ForceGraph3D, { ForceGraph3DInstance } from "3d-force-graph";
import * as THREE from "three";
import { useGraphStore } from "../../stores/graph-store.js";
import { create3DNodeObject } from "./node-3d-factory.js";
import { filterGraphData } from "../../lib/filter-helper.js";
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

  const { filteredNodes, filteredLinks } = React.useMemo(() => {
    return filterGraphData(nodes, links, filterCategory, searchQuery);
  }, [nodes, links, filterCategory, searchQuery]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize 3D Force Graph
    const fg = new ForceGraph3D(containerRef.current)
      .backgroundColor("#09090b")
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
      // Link styling & animated traffic particles
      .linkDirectionalParticles(4)
      .linkDirectionalParticleSpeed(0.007)
      .linkDirectionalParticleWidth(3.0)
      .linkDirectionalParticleColor((link) => {
        const gLink = link as unknown as GraphLink;
        if (gLink.relationshipType === "contained-in") return "#a855f7"; // Purple network flow
        if (gLink.relationshipType === "routes-to") return "#ff9900"; // Orange compute routing
        if (gLink.relationshipType === "targets") return "#38bdf8"; // Blue database query
        return "#10b981"; // Green storage transfer
      })
      .linkColor((link) => {
        const gLink = link as unknown as GraphLink;
        if (gLink.relationshipType === "contained-in") return "rgba(168, 85, 247, 0.3)";
        if (gLink.relationshipType === "routes-to") return "rgba(255, 153, 0, 0.4)";
        return "rgba(113, 113, 122, 0.35)";
      })
      .linkWidth((link) => {
        const gLink = link as unknown as GraphLink;
        return gLink.relationshipType === "routes-to" ? 2.5 : 1.5;
      });

    // Configure strong charge repulsion so 3D nodes spread out gracefully
    const chargeForce = fg.d3Force("charge");
    if (chargeForce && typeof chargeForce.strength === "function") {
      chargeForce.strength(-700);
    }
    const linkForce = fg.d3Force("link");
    if (linkForce && typeof linkForce.distance === "function") {
      linkForce.distance(130);
    }

    // Clean natural architectural lighting (no neon or sci-fi tints)
    const scene = fg.scene();
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(150, 300, 150);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa1a1aa, 0.6);
    dirLight2.position.set(-150, -200, -100);
    scene.add(dirLight2);

    // Subtle CAD architecture grid floor
    const grid = new THREE.GridHelper(800, 40, 0x27272a, 0x18181b);
    grid.position.y = -60;
    scene.add(grid);

    // Set clean initial camera framing
    fg.cameraPosition({ x: 0, y: 100, z: 320 }, { x: 0, y: 0, z: 0 }, 1000);

    // Ensure all 3D cards smoothly billboard towards the camera on camera movement
    try {
      const controls = (fg as any).controls();
      if (controls && typeof controls.addEventListener === "function") {
        controls.addEventListener("change", () => {
          const camera = fg.camera();
          if (camera) {
            scene.traverse((obj: any) => {
              if (obj.userData?.isBillboardCard) {
                obj.quaternion.copy(camera.quaternion);
              }
            });
          }
        });
      }
    } catch {
      // Pass if controls not available
    }

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

  // Camera action helpers
  const handleResetCamera = () => {
    if (!graphRef.current) return;
    graphRef.current.cameraPosition({ x: 0, y: 0, z: 280 }, { x: 0, y: 0, z: 0 }, 1000);
  };

  const handleZoom = (factor: number) => {
    if (!graphRef.current) return;
    const current = graphRef.current.cameraPosition();
    graphRef.current.cameraPosition(
      { x: current.x * factor, y: current.y * factor, z: current.z * factor },
      undefined,
      400
    );
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#09090b]">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Viewport Controls */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center space-x-1.5 p-1 bg-[#141418] border border-[#27272a] rounded-lg shadow-md font-mono text-xs">
        <button
          onClick={handleResetCamera}
          className="px-2.5 py-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors text-[11px]"
          title="Reset Camera View"
        >
          Reset View
        </button>
        <span className="text-zinc-600">|</span>
        <button
          onClick={() => handleZoom(0.8)}
          className="px-2 py-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors text-[11px]"
          title="Zoom In"
        >
          + Zoom
        </button>
        <button
          onClick={() => handleZoom(1.25)}
          className="px-2 py-1 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors text-[11px]"
          title="Zoom Out"
        >
          - Zoom
        </button>
      </div>
    </div>
  );
};
