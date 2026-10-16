import React, { useEffect, useRef } from "react";
import ForceGraph3D, { ForceGraph3DInstance } from "3d-force-graph";
import * as THREE from "three";
import { useGraphStore } from "../../stores/graph-store.js";
import { create3DNodeObject, getServiceStyle } from "./node-3d-factory.js";
import { filterGraphData } from "../../lib/filter-helper.js";
import { applyStructuredArchitectureLayout, getOptimizedLinks } from "../../lib/architecture-layout.js";
import { simulateThreatBlastRadius } from "../../lib/fault-tolerance.js";
import type { GraphNode, GraphLink } from "@orbit/core";

/* ─────────────────────────────────────────────────────────────
   3D TOPOLOGY VIEW
   
   Isometric AWS infrastructure topology with:
   - 3D floor plates for VPC, AZ, Subnets
   - Labeled boundary plates with ground plane decals
   - Billboard node cards (always face camera)
   - Intelligent trunk routing & particle flow
   - Professional scene lighting & grid
   ─────────────────────────────────────────────────────────── */
export const Graph3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph3DInstance | null>(null);
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
    isSecurityHeatmap,
    activeThreatScenario,
    selectNode,
    hoverNode,
    hoverLink,
    setEdgeTooltip,
    toggleSecurityHeatmap,
    setActiveThreatScenario,
  } = useGraphStore();

  const { filteredNodes, filteredLinks } = React.useMemo(() => {
    return filterGraphData(nodes, links, filterCategory, searchQuery);
  }, [nodes, links, filterCategory, searchQuery]);

  const { positionedNodes, subnetBounds, vpcBounds, azBounds, regionalBounds, ingressBounds } =
    React.useMemo(() => {
      return applyStructuredArchitectureLayout(filteredNodes, true, isGrouped);
    }, [filteredNodes, isGrouped]);

  const platesGroupRef = useRef<THREE.Group | null>(null);

  // Fast node lookup map
  const nodeMap = React.useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const n of positionedNodes) {
      map.set(n.id, n);
    }
    return map;
  }, [positionedNodes]);

  // Traffic-only links connecting mapped architectural nodes with trunk optimization
  const trafficLinks = React.useMemo(() => {
    return getOptimizedLinks(filteredLinks, positionedNodes, isGrouped, selectedNode?.id, hoveredNode?.id);
  }, [filteredLinks, positionedNodes, isGrouped, selectedNode?.id, hoveredNode?.id]);

  // Active Threat Scenario Blast Radius simulation
  const threatSimulation = React.useMemo(() => {
    if (!activeThreatScenario) return null;
    return simulateThreatBlastRadius(activeThreatScenario, positionedNodes, trafficLinks);
  }, [activeThreatScenario, positionedNodes, trafficLinks]);

  // Throttled pointer tracking
  const handlePointerMove = (e: React.PointerEvent) => {
    const now = performance.now();
    if (now - lastPointerMove.current < 20) return; // ~50fps throttle
    lastPointerMove.current = now;
    pointerPosRef.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const fg = new ForceGraph3D(containerRef.current)
      .backgroundColor("#0B0E14")
      .showNavInfo(false)
      .nodeThreeObject((node) => {
        const gNode = node as unknown as GraphNode;
        const isSelected = selectedNode?.id === gNode.id;
        const isHovered = hoveredNode?.id === gNode.id;
        return create3DNodeObject(gNode, isSelected, isHovered);
      })
      .nodeLabel((node) => {
        const gNode = node as unknown as GraphNode;
        const style = getServiceStyle(gNode.type, gNode.name);
        const isIncomplete = gNode.status === "incomplete";
        const borderCol = isIncomplete ? "#8893A6" : style.color;
        const badgeLabel = isIncomplete ? "SCAN INCOMPLETE (DATA GAP)" : gNode.status || "healthy";
        return `<div style="background:rgba(21,26,36,0.92);border:1.5px ${isIncomplete ? "dashed" : "solid"} ${borderCol};border-radius:10px;padding:10px 14px;color:#E6E9EF;font-family:'Inter',sans-serif;font-size:12px;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,0,0.6);backdrop-filter:blur(12px);">
          <div style="font-weight:700;color:#E6E9EF;font-size:13px;">${gNode.name}</div>
          <div style="color:${borderCol};font-size:11px;font-weight:600;margin-top:2px;">${style.shortType}</div>
          <div style="color:${isIncomplete ? "#cbd5e1" : "#8893A6"};font-size:10px;margin-top:3px;font-family:monospace;">${gNode.region || "us-east-1"} • ${badgeLabel}</div>
        </div>`;
      })
      .onNodeClick((node) => {
        const gNode = node as unknown as GraphNode;
        selectNode(gNode);
        if (graphRef.current && (node as any).x !== undefined) {
          const { x = 0, y = 0, z = 0 } = node as { x: number; y: number; z: number };
          graphRef.current.cameraPosition(
            { x: x + 60, y: y + 40, z: z + 70 },
            { x, y, z },
            1000
          );
        }
      })
      .onNodeHover((node) => hoverNode(node ? (node as unknown as GraphNode) : null))
      .onBackgroundClick(() => {
        selectNode(null);
        hoverLink(null);
        setEdgeTooltip(null);
      })
      // Link hover & picking interaction
      .linkHoverPrecision(6)
      .linkCurvature(0.2)
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
      // Traffic particle flow (optimized for zero GPU lag on dense networks & threat illumination)
      .linkDirectionalParticles((link) => {
        const gLink = link as unknown as GraphLink;
        if (threatSimulation?.affectedLinkIds.has(gLink.id)) {
          return 6;
        }
        const isHoveredEdge = hoveredLink && (hoveredLink.id === gLink.id || (hoveredLink.source === gLink.source && hoveredLink.target === gLink.target));
        if (hoveredLink) {
          return isHoveredEdge ? 6 : 0;
        }
        if (selectedNode) {
          const srcId = typeof gLink.source === "object" ? (gLink.source as any).id : gLink.source;
          const tgtId = typeof gLink.target === "object" ? (gLink.target as any).id : gLink.target;
          return (srcId === selectedNode.id || tgtId === selectedNode.id) ? 4 : 0;
        }
        if (trafficLinks.length > 40) return 0;
        return 2;
      })
      .linkDirectionalParticleSpeed((link) => {
        const gLink = link as unknown as GraphLink;
        if (threatSimulation?.affectedLinkIds.has(gLink.id)) {
          return 0.022;
        }
        const isHoveredEdge = hoveredLink && (hoveredLink.id === gLink.id || (hoveredLink.source === gLink.source && hoveredLink.target === gLink.target));
        return isHoveredEdge ? 0.012 : 0.005;
      })
      .linkDirectionalParticleWidth((link) => {
        const gLink = link as unknown as GraphLink;
        if (threatSimulation?.affectedLinkIds.has(gLink.id)) {
          return 5.0;
        }
        const isHoveredEdge = hoveredLink && (hoveredLink.id === gLink.id || (hoveredLink.source === gLink.source && hoveredLink.target === gLink.target));
        return isHoveredEdge ? 5.5 : 2.5;
      })
      .linkDirectionalParticleColor((link) => {
        const gLink = link as unknown as GraphLink;
        if (threatSimulation?.affectedLinkIds.has(gLink.id)) {
          return "#FF5C5C";
        }
        const isHoveredEdge = hoveredLink && (hoveredLink.id === gLink.id || (hoveredLink.source === gLink.source && hoveredLink.target === gLink.target));
        if (isHoveredEdge) return "#4DA3FF";
        if (gLink.relationshipType === "routes-to") return "#4DA3FF";
        if (gLink.relationshipType === "targets") return "#4DA3FF";
        if (gLink.relationshipType === "member-of") return "#8893A6";
        return "#4DA3FF";
      })
      .linkColor((link) => {
        const gLink = link as unknown as GraphLink;
        if (threatSimulation?.affectedLinkIds.has(gLink.id)) {
          return "#FF5C5C";
        }
        const isHoveredEdge = hoveredLink && (hoveredLink.id === gLink.id || (hoveredLink.source === gLink.source && hoveredLink.target === gLink.target));
        const srcId = typeof gLink.source === "object" ? (gLink.source as any).id : gLink.source;
        const tgtId = typeof gLink.target === "object" ? (gLink.target as any).id : gLink.target;
        const srcNode = nodeMap.get(srcId);
        const tgtNode = nodeMap.get(tgtId);
        const isInferred = Boolean(gLink.isInferred || srcNode?.status === "incomplete" || tgtNode?.status === "incomplete");

        const isConnectedToFocus =
          (selectedNode && (srcId === selectedNode.id || tgtId === selectedNode.id)) ||
          (hoveredNode && (srcId === hoveredNode.id || tgtId === hoveredNode.id));

        if (hoveredLink) {
          if (isHoveredEdge) {
            return isInferred ? "#E6E9EF" : "#4DA3FF";
          }
          return "rgba(38,45,58,0.08)"; // Dim non-hovered edges
        }

        if (isConnectedToFocus) {
          return "#38BDF8"; // Bright illuminated edge for focused node
        }

        if (isSecurityHeatmap) {
          if (srcNode?.status === "exposed" || tgtNode?.status === "exposed") return "rgba(242,179,61,0.9)";
          if (srcNode?.status === "failed" || tgtNode?.status === "failed") return "rgba(255,92,92,0.9)";
          return "rgba(56,189,248,0.15)";
        }

        const isDense = trafficLinks.length > 60;

        if (isInferred) {
          return isDense ? "rgba(136,147,166,0.2)" : "rgba(136,147,166,0.65)";
        }
        if (gLink.relationshipType === "routes-to") {
          return isDense ? "rgba(56,189,248,0.35)" : "rgba(56,189,248,0.85)";
        }
        if (gLink.relationshipType === "targets") {
          return isDense ? "rgba(192,132,252,0.3)" : "rgba(192,132,252,0.8)";
        }
        return isDense ? "rgba(100,116,139,0.18)" : "rgba(136,147,166,0.75)";
      })
      .linkWidth((link) => {
        const gLink = link as unknown as GraphLink;
        if (threatSimulation?.affectedLinkIds.has(gLink.id)) {
          return 4.2;
        }
        const isHoveredEdge = hoveredLink && (hoveredLink.id === gLink.id || (hoveredLink.source === gLink.source && hoveredLink.target === gLink.target));
        const srcId = typeof gLink.source === "object" ? (gLink.source as any).id : gLink.source;
        const tgtId = typeof gLink.target === "object" ? (gLink.target as any).id : gLink.target;
        const isConnectedToFocus =
          (selectedNode && (srcId === selectedNode.id || tgtId === selectedNode.id)) ||
          (hoveredNode && (srcId === hoveredNode.id || tgtId === hoveredNode.id));

        if (isHoveredEdge || isConnectedToFocus) {
          return 4.0;
        }
        const isDense = trafficLinks.length > 60;
        return isDense ? 0.9 : 2.6;
      })
      .linkOpacity(0.85);

    // Zero out dynamic forces for fixed architectural positions
    const chargeForce = fg.d3Force("charge");
    if (chargeForce && typeof chargeForce.strength === "function") {
      chargeForce.strength(0);
    }
    const linkForce = fg.d3Force("link");
    if (linkForce && typeof linkForce.strength === "function") {
      linkForce.strength(0);
    }
    const centerForce = fg.d3Force("center");
    if (centerForce && typeof centerForce.strength === "function") {
      centerForce.strength(0);
    }

    // ══════════════════════════════════════════════════════════
    // SCENE SETUP: Lighting, Floor Plates, Labels
    // ══════════════════════════════════════════════════════════
    const scene = fg.scene();

    // Clean natural studio lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(200, 400, 200);
    keyLight.castShadow = false;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.6);
    fillLight.position.set(-200, -200, -100);
    scene.add(fillLight);

    // Rim light for depth
    const rimLight = new THREE.DirectionalLight(0x6366f1, 0.4);
    rimLight.position.set(0, -300, 300);
    scene.add(rimLight);

    // ── Deep Slate Architectural Scene Setup ──
    scene.fog = new THREE.FogExp2(0x0A0D14, 0.00028);

    // ── Cisco SDA Isometric Diamond Grid (Rotated 45° across ground plane) ──
    const gridSize = 4500;
    const gridDivs = 90;
    const diamondGrid = new THREE.GridHelper(gridSize, gridDivs, 0x1E293B, 0x101726);
    diamondGrid.rotation.y = Math.PI / 4;
    diamondGrid.position.y = -79;
    (diamondGrid.material as THREE.Material).transparent = true;
    (diamondGrid.material as THREE.Material).opacity = 0.45;
    scene.add(diamondGrid);

    // Secondary orthogonal grid for depth alignment
    const orthoGrid = new THREE.GridHelper(gridSize, gridDivs / 2, 0x161F2E, 0x0D131F);
    orthoGrid.position.y = -80;
    (orthoGrid.material as THREE.Material).transparent = true;
    (orthoGrid.material as THREE.Material).opacity = 0.35;
    scene.add(orthoGrid);

    // Dynamic Floor Plates Group
    const platesGroup = new THREE.Group();
    platesGroup.name = "orbit-dynamic-floor-plates";
    platesGroupRef.current = platesGroup;
    scene.add(platesGroup);

    // ── Initial Camera: Classic AWS Isometric Overview ──
    fg.cameraPosition({ x: 180, y: 760, z: 580 }, { x: 120, y: -40, z: 0 }, 1000);

    // Billboard rotation on camera move
    const updateBillboards = () => {
      const camera = fg.camera();
      if (camera) {
        scene.traverse((obj: any) => {
          if (obj.userData?.isBillboardCard && !obj.isSprite) {
            obj.quaternion.copy(camera.quaternion);
          }
        });
      }
    };

    try {
      const controls = (fg as any).controls();
      if (controls) {
        // Enforce architectural isometric boundaries: strictly prevent viewing below ground or flipping upside-down!
        controls.maxPolarAngle = Math.PI / 2.22; // ~81° - prevents camera sinking below floor plane
        controls.minPolarAngle = Math.PI / 6;    // ~30° - prevents zenith gimbal lock
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.rotateSpeed = 0.75;
        controls.panSpeed = 0.8;
        controls.screenSpacePanning = true;
        if (typeof controls.addEventListener === "function") {
          controls.addEventListener("change", updateBillboards);
        }
      }
    } catch { /* ignore */ }

    setTimeout(updateBillboards, 200);
    setTimeout(updateBillboards, 600);

    graphRef.current = fg;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && fg) {
        fg.width(containerRef.current.clientWidth);
        fg.height(containerRef.current.clientHeight);
      }
    });
    resizeObserver.observe(containerRef.current);

    const handleResetCamera = () => {
      if (fg) {
        fg.cameraPosition({ x: 180, y: 760, z: 580 }, { x: 120, y: -40, z: 0 }, 1000);
      }
    };

    const handleFocusNode = (e: any) => {
      const targetId = e.detail?.id;
      const target = positionedNodes.find((n) => n.id === targetId);
      if (target && fg) {
        const { x = 0, y = 0, z = 0 } = target;
        fg.cameraPosition({ x: x + 80, y: y + 50, z: z + 90 }, { x, y, z }, 1200);
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
  }, []);

  // Update data on change
  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.graphData({
      nodes: positionedNodes.map((n) => ({ ...n })),
      links: trafficLinks.map((l) => ({ ...l })),
    });

    setTimeout(() => {
      const camera = graphRef.current?.camera();
      const scene = graphRef.current?.scene();
      if (camera && scene) {
        scene.traverse((obj: any) => {
          if (obj.userData?.isBillboardCard) {
            obj.quaternion.copy(camera.quaternion);
          }
        });
      }
    }, 150);
  }, [positionedNodes, trafficLinks]);

  // Re-render meshes on selection change
  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.nodeThreeObject(graphRef.current.nodeThreeObject());
  }, [selectedNode, hoveredNode]);

  // Re-evaluate 3D link visuals & dim unconnected nodes when hoveredLink, threatSimulation, or isSecurityHeatmap changes
  useEffect(() => {
    if (!graphRef.current) return;
    const scene = graphRef.current.scene();

    if (threatSimulation) {
      if (scene) {
        scene.traverse((obj: any) => {
          if (obj.userData?.isBillboardCard && obj.material) {
            const nodeId = obj.userData.nodeId;
            const isCompromised = threatSimulation.affectedNodeIds.has(nodeId);
            obj.material.opacity = isCompromised ? 1.0 : 0.16;
            obj.material.needsUpdate = true;
          }
        });
      }
    } else if (isSecurityHeatmap) {
      if (scene) {
        scene.traverse((obj: any) => {
          if (obj.userData?.isBillboardCard && obj.material) {
            const nodeId = obj.userData.nodeId;
            const node = nodeMap.get(nodeId);
            const isVulnerable = node && (node.status === "exposed" || node.status === "failed" || node.status === "incomplete");
            obj.material.opacity = isVulnerable ? 1.0 : 0.25;
            obj.material.needsUpdate = true;
          }
        });
      }
    } else if (hoveredLink) {
      const hSrcId = typeof hoveredLink.source === "object" ? (hoveredLink.source as any).id : hoveredLink.source;
      const hTgtId = typeof hoveredLink.target === "object" ? (hoveredLink.target as any).id : hoveredLink.target;

      if (scene) {
        scene.traverse((obj: any) => {
          if (obj.userData?.isBillboardCard && obj.material) {
            const nodeId = obj.userData.nodeId;
            const isConnected = nodeId === hSrcId || nodeId === hTgtId;
            obj.material.opacity = isConnected ? 1.0 : 0.22;
            obj.material.needsUpdate = true;
          }
        });
      }
    } else {
      if (scene) {
        scene.traverse((obj: any) => {
          if (obj.userData?.isBillboardCard && obj.material) {
            obj.material.opacity = 1.0;
            obj.material.needsUpdate = true;
          }
        });
      }
    }

    graphRef.current
      .linkColor(graphRef.current.linkColor())
      .linkWidth(graphRef.current.linkWidth())
      .linkDirectionalParticles(graphRef.current.linkDirectionalParticles())
      .linkDirectionalParticleWidth(graphRef.current.linkDirectionalParticleWidth());
  }, [hoveredLink, selectedNode, hoveredNode, threatSimulation, isSecurityHeatmap]);

  // Update 3D floor plates dynamically whenever bounds change
  useEffect(() => {
    const group = platesGroupRef.current;
    if (!group) return;

    // Clear old plate meshes
    while (group.children.length > 0) {
      const child = group.children[0];
      if (child) {
        group.remove(child);
        if ((child as any).geometry) (child as any).geometry.dispose();
        if ((child as any).material) {
          if (Array.isArray((child as any).material)) {
            (child as any).material.forEach((m: any) => m.dispose());
          } else {
            (child as any).material.dispose();
          }
        }
      } else {
        break;
      }
    }

    // Ingress Plates
    ingressBounds.forEach((b) => {
      addFloorPlate(group, {
        width: Math.max(180, b.x2 - b.x1),
        depth: Math.max(220, b.y2 - b.y1),
        color: 0x8893A6,
        opacity: 0.05,
        edgeOpacity: 0.45,
        position: [(b.x1 + b.x2) / 2, -75, (b.y1 + b.y2) / 2],
        label: b.name,
      });
    });

    // VPC Outer Plates
    vpcBounds.forEach((b) => {
      addFloorPlate(group, {
        width: Math.max(300, b.x2 - b.x1),
        depth: Math.max(260, b.y2 - b.y1),
        color: 0x8C4FFF,
        opacity: 0.04,
        edgeOpacity: 0.45,
        position: [(b.x1 + b.x2) / 2, -76, (b.y1 + b.y2) / 2],
        label: b.name,
      });
    });

    // Availability Zones
    azBounds.forEach((b) => {
      addFloorPlate(group, {
        width: Math.max(280, b.x2 - b.x1),
        depth: Math.max(140, b.y2 - b.y1),
        color: b.azLabel?.includes("b") || b.azLabel?.includes("B") ? 0x38bdf8 : 0xFF9900,
        opacity: 0.04,
        edgeOpacity: 0.45,
        position: [(b.x1 + b.x2) / 2, -74, b.z || 0],
        label: b.name,
      });
    });

    // Subnets
    subnetBounds.forEach((b) => {
      addFloorPlate(group, {
        width: Math.max(120, b.x2 - b.x1),
        depth: Math.max(120, b.y2 - b.y1),
        color: b.isPublic ? 0x06b6d4 : 0x3b82f6,
        opacity: 0.05,
        edgeOpacity: 0.35,
        position: [(b.x1 + b.x2) / 2, -73, b.z || 0],
        label: b.name,
      });
    });

    // Regional & Serverless & Storage Plates
    regionalBounds.forEach((b) => {
      const col = b.id.includes("serverless") ? 0xED7100 : b.id.includes("s3") ? 0x3F8624 : 0xDD344C;
      addFloorPlate(group, {
        width: Math.max(180, b.x2 - b.x1),
        depth: Math.max(200, b.y2 - b.y1),
        color: col,
        opacity: 0.05,
        edgeOpacity: 0.45,
        position: [(b.x1 + b.x2) / 2, -75, (b.y1 + b.y2) / 2],
        label: b.name,
      });
    });
  }, [ingressBounds, vpcBounds, azBounds, subnetBounds, regionalBounds]);

  // Camera controls & presets
  const handleCameraPreset = (preset: "iso" | "top" | "elevation" | "fit") => {
    if (!graphRef.current) return;
    const isBig = positionedNodes.length > 25;
    const centerX = isBig ? 450 : 120;
    const centerY = -40;
    const centerZ = 0;

    switch (preset) {
      case "iso":
        // Classic 50° high isometric perspective matching Cisco SDA reference diagram
        graphRef.current.cameraPosition(
          { x: centerX + (isBig ? 120 : 60), y: isBig ? 960 : 760, z: isBig ? 760 : 580 },
          { x: centerX, y: centerY, z: centerZ },
          1000
        );
        break;
      case "top":
        // 90-degree blueprint plan view
        graphRef.current.cameraPosition(
          { x: centerX, y: isBig ? 1500 : 1100, z: 0.1 },
          { x: centerX, y: centerY, z: centerZ },
          1000
        );
        break;
      case "elevation":
        // Front elevation architectural slice
        graphRef.current.cameraPosition(
          { x: centerX, y: 40, z: isBig ? 1400 : 950 },
          { x: centerX, y: centerY, z: centerZ },
          1000
        );
        break;
      case "fit":
        graphRef.current.zoomToFit(1000, 80);
        break;
    }
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
    <div
      onPointerMove={handlePointerMove}
      className="relative w-full h-full overflow-hidden bg-[#0B0E14]"
    >
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Active Threat Simulation HUD */}
      {threatSimulation && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-xl bg-[#1A0B0E]/95 border border-[#FF5C5C]/70 text-[#E6E9EF] shadow-2xl backdrop-blur-md animate-pulse">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5C5C] animate-ping" />
          <div className="text-xs">
            <span className="font-bold text-[#FF5C5C] uppercase tracking-wider mr-1.5">
              Simulating Attack:
            </span>
            <span className="font-medium">{threatSimulation.scenario.title}</span>
            <span className="text-[#8893A6] ml-2 text-[11px]">
              • {threatSimulation.affectedNodeIds.size} Assets Compromised ({threatSimulation.scenario.blastRadiusScore}% Blast Radius)
            </span>
          </div>
          <button
            onClick={() => setActiveThreatScenario(null)}
            className="ml-2 px-2 py-0.5 rounded bg-[#FF5C5C]/20 hover:bg-[#FF5C5C]/35 text-[#FF5C5C] text-[10px] font-bold border border-[#FF5C5C]/40 transition-colors"
          >
            Clear Threat
          </button>
        </div>
      )}

      {/* Floating Viewport Controls & Camera Presets */}
      <div className="absolute bottom-5 right-5 z-10 flex items-center gap-1.5 p-1.5 bg-[#151A24]/90 backdrop-blur-md border border-[#262D3A] rounded-xl shadow-2xl">
        <button
          onClick={() => handleCameraPreset("iso")}
          className="px-2.5 py-1.5 text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 rounded-lg transition-all text-[11px] font-medium"
          title="3D Isometric View (45°)"
        >
          📐 3D Iso
        </button>
        <button
          onClick={() => handleCameraPreset("top")}
          className="px-2.5 py-1.5 text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 rounded-lg transition-all text-[11px] font-medium"
          title="Top-Down Blueprint Plan (90°)"
        >
          🗺️ Blueprint
        </button>
        <button
          onClick={() => handleCameraPreset("elevation")}
          className="px-2.5 py-1.5 text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 rounded-lg transition-all text-[11px] font-medium"
          title="Front Elevation View"
        >
          🏢 Elevation
        </button>
        <button
          onClick={() => handleCameraPreset("fit")}
          className="px-2.5 py-1.5 text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 rounded-lg transition-all text-[11px] font-medium"
          title="Fit All Resources in Frame"
        >
          🎯 Fit All
        </button>

        <div className="w-px h-5 bg-[#262D3A]" />

        {/* Security Heatmap Mode Toggle */}
        <button
          onClick={toggleSecurityHeatmap}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
            isSecurityHeatmap
              ? "bg-[#FF5C5C]/20 border border-[#FF5C5C]/60 text-[#FF5C5C]"
              : "text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60"
          }`}
          title="Toggle Security Vulnerability Heatmap Mode"
        >
          <span className={`w-2 h-2 rounded-full ${isSecurityHeatmap ? "bg-[#FF5C5C] animate-pulse" : "bg-[#8893A6]"}`} />
          <span>Heatmap</span>
        </button>

        <div className="w-px h-5 bg-[#262D3A]" />

        <button
          onClick={() => handleZoom(0.8)}
          className="px-2 py-1 text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 rounded-lg transition-all text-[12px] font-medium"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => handleZoom(1.25)}
          className="px-2 py-1 text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 rounded-lg transition-all text-[12px] font-medium"
          title="Zoom Out"
        >
          −
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   HELPER: Add 3D Extruded Floor Plate with Cyber Corner Brackets
   ─────────────────────────────────────────────────────────── */
interface FloorPlateConfig {
  width: number;
  depth: number;
  color: number;
  opacity: number;
  edgeOpacity: number;
  position: [number, number, number];
  label: string;
}

function addFloorPlate(parent: THREE.Object3D, config: FloorPlateConfig) {
  // Extruded 3D slab box geometry for real depth
  const slabHeight = 5;
  const boxGeo = new THREE.BoxGeometry(config.width, slabHeight, config.depth);

  // Frosted semi-transparent glassmorphic material
  const mat = new THREE.MeshBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: Math.min(0.18, config.opacity + 0.05),
    side: THREE.DoubleSide,
  });
  const slabMesh = new THREE.Mesh(boxGeo, mat);
  slabMesh.position.set(config.position[0], config.position[1] - slabHeight / 2, config.position[2]);
  parent.add(slabMesh);

  // Glowing neon perimeter wireframe around the top edges
  const edgeMat = new THREE.LineBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: config.edgeOpacity,
  });
  const topPlaneGeo = new THREE.PlaneGeometry(config.width, config.depth);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(topPlaneGeo), edgeMat);
  edges.rotation.x = Math.PI / 2;
  edges.position.set(config.position[0], config.position[1] + 0.1, config.position[2]);
  parent.add(edges);

  // 4 Cyber Corner Brackets (L-shaped accents at platform corners)
  const bracketLen = Math.min(22, config.width * 0.08);
  const halfW = config.width / 2;
  const halfD = config.depth / 2;
  const bracketMat = new THREE.LineBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: Math.min(1.0, config.edgeOpacity * 1.5),
    linewidth: 2,
  });

  const bracketPoints: THREE.Vector3[] = [
    // Top-left corner
    new THREE.Vector3(-halfW, 0.2, -halfD + bracketLen),
    new THREE.Vector3(-halfW, 0.2, -halfD),
    new THREE.Vector3(-halfW + bracketLen, 0.2, -halfD),
    // Top-right corner
    new THREE.Vector3(halfW - bracketLen, 0.2, -halfD),
    new THREE.Vector3(halfW, 0.2, -halfD),
    new THREE.Vector3(halfW, 0.2, -halfD + bracketLen),
    // Bottom-left corner
    new THREE.Vector3(-halfW, 0.2, halfD - bracketLen),
    new THREE.Vector3(-halfW, 0.2, halfD),
    new THREE.Vector3(-halfW + bracketLen, 0.2, halfD),
    // Bottom-right corner
    new THREE.Vector3(halfW - bracketLen, 0.2, halfD),
    new THREE.Vector3(halfW, 0.2, halfD),
    new THREE.Vector3(halfW, 0.2, halfD - bracketLen),
  ];
  const bracketGeo = new THREE.BufferGeometry().setFromPoints(bracketPoints);
  const bracketLines = new THREE.LineSegments(bracketGeo, bracketMat);
  bracketLines.position.set(config.position[0], config.position[1], config.position[2]);
  parent.add(bracketLines);

  // Text label sprite
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 1024;
  labelCanvas.height = 128;
  const ctx = labelCanvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 1024, 128);
    // Dark pill backing for readability
    ctx.fillStyle = "rgba(11, 14, 20, 0.92)";
    if (ctx.roundRect) ctx.roundRect(4, 12, 1016, 104, 16);
    else ctx.fillRect(4, 12, 1016, 104);
    ctx.fill();

    ctx.strokeStyle = `#${config.color.toString(16).padStart(6, "0")}`;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 44px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(config.label, 28, 64);
  }
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.minFilter = THREE.LinearFilter;
  const labelSpriteMat = new THREE.SpriteMaterial({
    map: labelTexture,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  });
  const labelSprite = new THREE.Sprite(labelSpriteMat);
  const spriteW = Math.min(config.width * 0.55, 130);
  const spriteH = spriteW * (128 / 1024);
  labelSprite.scale.set(spriteW, spriteH, 1);
  labelSprite.position.set(
    config.position[0] - config.width / 2 + spriteW / 2 + 8,
    config.position[1] + spriteH / 2 + 3,
    config.position[2] - config.depth / 2 + 8
  );
  parent.add(labelSprite);
}
