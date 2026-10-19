import React, { useEffect, useRef } from "react";
import ForceGraph3D, { ForceGraph3DInstance } from "3d-force-graph";
import * as THREE from "three";
import { useGraphStore } from "../../stores/graph-store.js";
import { create3DNodeObject, getServiceStyle } from "./node-3d-factory.js";
import { filterGraphData } from "../../lib/filter-helper.js";
import { applyStructuredArchitectureLayout, getOptimizedLinks } from "../../lib/architecture-layout.js";
import { simulateThreatBlastRadius } from "../../lib/fault-tolerance.js";
import type { GraphNode, GraphLink } from "@orbit/core";

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

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
  const [initError, setInitError] = React.useState<string | null>(null);
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
    isLiveTrafficActive,
    focusedBlastRadiusNodeId,
    isCostOverlayActive,
    selectNode,
    hoverNode,
    hoverLink,
    setEdgeTooltip,
    toggleSecurityHeatmap,
    setActiveThreatScenario,
    setViewMode,
  } = useGraphStore();

  const [activePreset, setActivePreset] = React.useState<"iso" | "top" | "angle" | "fit">("iso");

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
    const container = containerRef.current;
    if (!container) return;

    // 1. Detect WebGL2 / WebGL capability. If missing, auto-fallback to 2D
    if (!isWebGLAvailable()) {
      console.warn("[Graph3D] WebGL is unsupported or hardware acceleration is disabled. Auto-falling back to 2D.");
      setViewMode("2d");
      return;
    }

    let fg: ForceGraph3DInstance | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;
    let checkInterval: any = null;

    const setupGraph = () => {
      if (cancelled || !containerRef.current) return;
      const cont = containerRef.current;
      if (cont.clientWidth === 0 || cont.clientHeight === 0) return;

      try {
        // Clear any orphan canvas children from previous unmount
        while (cont.firstChild) {
          cont.removeChild(cont.firstChild);
        }

        fg = new ForceGraph3D(cont, { controlType: "orbit" })
          .backgroundColor("#0B0E14")
          .showNavInfo(false)
          .width(cont.clientWidth)
          .height(cont.clientHeight)
          .nodeThreeObject((node) => {
            const gNode = node as unknown as GraphNode;
            const isSelected = selectedNode?.id === gNode.id;
            const isHovered = hoveredNode?.id === gNode.id;
            return create3DNodeObject(gNode, isSelected, isHovered, isCostOverlayActive);
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
          // Balanced isometric framing: frames the node with upstream/downstream connections clearly visible, preventing card occlusion
          graphRef.current.cameraPosition(
            { x: x + 110, y: y + 250, z: z + 290 },
            { x, y, z },
            800
          );
        }
      })
      .onNodeHover((node) => hoverNode(node ? (node as unknown as GraphNode) : null))
      .onBackgroundClick(() => {
        selectNode(null);
        hoverLink(null);
        setEdgeTooltip(null);
      })
      // Link hover & picking interaction with smooth architectural arc
      .linkHoverPrecision(6)
      .linkCurvature((link: any) => {
        const gLink = link as unknown as GraphLink;
        // Inferred links (scan gaps) get a higher arc so they stand out clearly
        if (gLink.isInferred) return 0.14;
        return 0.05;
      })
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
      // Traffic particle flow (live AWS packet flow + blast radius illumination)
      .linkDirectionalParticles((link) => {
        const gLink = link as unknown as GraphLink;
        if (threatSimulation?.affectedLinkIds.has(gLink.id)) {
          return 6;
        }
        const srcId = typeof gLink.source === "object" ? (gLink.source as any).id : gLink.source;
        const tgtId = typeof gLink.target === "object" ? (gLink.target as any).id : gLink.target;

        // If blast radius inspection is focused on a specific node
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
        // Steady live traffic pulse on active routes
        return (gLink.relationshipType === "routes-to" || gLink.relationshipType === "targets") ? 3 : 2;
      })
      .linkDirectionalParticleSpeed((link) => {
        const gLink = link as unknown as GraphLink;
        if (threatSimulation?.affectedLinkIds.has(gLink.id)) {
          return 0.022;
        }
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
        if (threatSimulation?.affectedLinkIds.has(gLink.id)) {
          return 5.0;
        }
        const srcId = typeof gLink.source === "object" ? (gLink.source as any).id : gLink.source;
        const tgtId = typeof gLink.target === "object" ? (gLink.target as any).id : gLink.target;
        if (focusedBlastRadiusNodeId && (srcId === focusedBlastRadiusNodeId || tgtId === focusedBlastRadiusNodeId)) {
          return 4.5;
        }
        const isHoveredEdge = hoveredLink && (hoveredLink.id === gLink.id || (hoveredLink.source === gLink.source && hoveredLink.target === gLink.target));
        return isHoveredEdge ? 5.0 : 3.0;
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

        if (focusedBlastRadiusNodeId) {
          const isBlastEdge = (srcId === focusedBlastRadiusNodeId || tgtId === focusedBlastRadiusNodeId);
          if (isBlastEdge) return "#F59E0B"; // High-visibility amber/orange for blast radius
          return "rgba(38,45,58,0.08)"; // Dim unaffected edges during blast simulation
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
        const isBlastEdge = Boolean(focusedBlastRadiusNodeId && (srcId === focusedBlastRadiusNodeId || tgtId === focusedBlastRadiusNodeId));
        const isConnectedToFocus =
          (selectedNode && (srcId === selectedNode.id || tgtId === selectedNode.id)) ||
          (hoveredNode && (srcId === hoveredNode.id || tgtId === hoveredNode.id));

        if (isBlastEdge) {
          return 4.6;
        }

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

    // ── Canonical Architectural Scene Background (#0B0E14 Cool Graphite) ──
    scene.fog = new THREE.FogExp2(0x0B0E14, 0.00022);

    // Architectural Ground Plate (Matches #0B0E14 cool graphite)
    const groundGeo = new THREE.PlaneGeometry(6000, 6000);
    const groundMat = new THREE.MeshBasicMaterial({
      color: 0x0B0E14,
      depthWrite: false,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -81.5;
    scene.add(ground);

    // ── Cisco SDA Isometric Diamond Grid (Rotated 45° across ground plane) ──
    const gridSize = 4800;
    const gridDivs = 96;
    const diamondGrid = new THREE.GridHelper(gridSize, gridDivs, 0x2A374E, 0x162030);
    diamondGrid.rotation.y = Math.PI / 4;
    diamondGrid.position.y = -79.5;
    (diamondGrid.material as THREE.Material).transparent = true;
    (diamondGrid.material as THREE.Material).opacity = 0.08;
    scene.add(diamondGrid);

    // Secondary orthogonal grid for CAD depth alignment
    const orthoGrid = new THREE.GridHelper(gridSize, gridDivs / 2, 0x1E2A3E, 0x121A28);
    orthoGrid.position.y = -80.5;
    (orthoGrid.material as THREE.Material).transparent = true;
    (orthoGrid.material as THREE.Material).opacity = 0.12;
    scene.add(orthoGrid);

    // Dynamic Floor Plates Group
    const platesGroup = new THREE.Group();
    platesGroup.name = "orbit-dynamic-floor-plates";
    platesGroupRef.current = platesGroup;
    scene.add(platesGroup);

    // ── Initial Camera: Clean Isometric Perspective (elevated 45° angle, zero card overlap, full schematic legibility) ──
    fg.cameraPosition({ x: 220, y: 550, z: 680 }, { x: 220, y: -35, z: 0 }, 1000);

    // Billboard rotation on camera move
    const updateBillboards = () => {
      const camera = fg?.camera();
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
        // Enforce architectural boundaries: prevent camera sinking to horizontal eye-level which causes card occlusion
        controls.maxPolarAngle = Math.PI / 2.7; // ~66° - guarantees clear overhead bird's-eye readability
        controls.minPolarAngle = 0;             // Allow complete clean top-down plan view
        controls.enableRotate = false;           // ROTATION LOCKED BY DEFAULT for stable map readability
        controls.enablePan = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.12;
        controls.panSpeed = 1.2;
        controls.screenSpacePanning = true;

        // Map left-click drag and touch drag directly to PAN (like Figma / Miro / Cloudcraft)
        if (THREE.MOUSE) {
          controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          };
        }
        if (THREE.TOUCH) {
          controls.touches = {
            ONE: THREE.TOUCH.PAN,
            TWO: THREE.TOUCH.DOLLY_PAN,
          };
        }

        if (typeof controls.addEventListener === "function") {
          controls.addEventListener("change", updateBillboards);
        }
      }
    } catch { /* ignore */ }

    setTimeout(updateBillboards, 200);
    setTimeout(updateBillboards, 600);

        const canvas = cont.querySelector("canvas");
        const onContextLost = (e: Event) => {
          e.preventDefault();
          console.warn("[Graph3D] WebGL context lost. Auto-falling back to 2D mode.");
          setViewMode("2d");
        };
        canvas?.addEventListener("webglcontextlost", onContextLost);

        resizeObserver = new ResizeObserver(() => {
          if (containerRef.current && fg) {
            fg.width(containerRef.current.clientWidth);
            fg.height(containerRef.current.clientHeight);
          }
        });
        resizeObserver.observe(cont);

        const handleResetCamera = () => {
          if (fg) {
            fg.cameraPosition({ x: 120, y: 1050, z: 0.1 }, { x: 120, y: -40, z: 0 }, 1000);
          }
        };

        const handleFocusNode = (e: any) => {
          const targetId = e.detail?.id;
          const target = positionedNodes.find((n) => n.id === targetId);
          if (target && fg) {
            const { x = 0, y = 0, z = 0 } = target;
            fg.cameraPosition({ x: x + 110, y: y + 250, z: z + 290 }, { x, y, z }, 900);
          }
        };

        window.addEventListener("orbit:reset-camera", handleResetCamera);
        window.addEventListener("orbit:focus-node", handleFocusNode);

        graphRef.current = fg;
      } catch (err: any) {
        console.error("[Graph3D] Error during 3D ForceGraph initialization:", err);
        setInitError(err?.message || String(err));
        setViewMode("2d");
      }
    };

    // 2. Check for zero-dimension container at mount time
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      console.log("[Graph3D] Container has 0 dimensions at mount time, awaiting layout...");
      let attempts = 0;
      checkInterval = setInterval(() => {
        attempts++;
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          clearInterval(checkInterval);
          setupGraph();
        } else if (attempts > 30) {
          clearInterval(checkInterval);
          console.warn("[Graph3D] Container remained 0-sized after layout wait. Auto-falling back to 2D.");
          setViewMode("2d");
        }
      }, 50);
    } else {
      setupGraph();
    }

    return () => {
      cancelled = true;
      if (checkInterval) clearInterval(checkInterval);
      window.removeEventListener("orbit:reset-camera", () => {});
      window.removeEventListener("orbit:focus-node", () => {});
      if (resizeObserver) resizeObserver.disconnect();
      if (fg) {
        try {
          if (typeof (fg as any)._destructor === "function") {
            (fg as any)._destructor();
          }
        } catch { /* ignore */ }
      }
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

  // Re-render meshes on selection change or cost overlay toggle
  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.nodeThreeObject(graphRef.current.nodeThreeObject());
  }, [selectedNode, hoveredNode, isCostOverlayActive]);

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

    // Ingress Platform Layover (Vivid Indigo / Violet)
    ingressBounds.forEach((b) => {
      addFloorPlate(group, {
        width: Math.max(200, b.x2 - b.x1),
        depth: Math.max(220, b.y2 - b.y1),
        color: 0x818CF8,
        opacity: 0.12,
        edgeOpacity: 0.85,
        position: [(b.x1 + b.x2) / 2, -50, (b.y1 + b.y2) / 2],
        label: b.name,
      });
    });

    // VPC Outer Platform Layover (Cyber Sky Blue)
    vpcBounds.forEach((b) => {
      addFloorPlate(group, {
        width: Math.max(300, b.x2 - b.x1),
        depth: Math.max(260, b.y2 - b.y1),
        color: 0x38BDF8,
        opacity: 0.08,
        edgeOpacity: 0.75,
        position: [(b.x1 + b.x2) / 2, -56, (b.y1 + b.y2) / 2],
        label: b.name,
      });
    });

    // Availability Zones Layovers (AZ-1a Emerald/Cyan, AZ-1b Amber/Gold)
    azBounds.forEach((b) => {
      const isAZb = b.azLabel?.includes("b") || b.azLabel?.includes("B");
      addFloorPlate(group, {
        width: Math.max(280, b.x2 - b.x1),
        depth: Math.max(140, b.y2 - b.y1),
        color: isAZb ? 0xFBBF24 : 0x34D399,
        opacity: 0.10,
        edgeOpacity: 0.85,
        position: [(b.x1 + b.x2) / 2, -50, (b.y1 + b.y2) / 2],
        label: b.name,
      });
    });

    // Subnets Layovers (DMZ = Cyan, App = Blue, DB = Purple)
    subnetBounds.forEach((b) => {
      const isDb = b.name.toLowerCase().includes("database") || b.name.toLowerCase().includes("db");
      const col = isDb ? 0xA78BFA : b.isPublic ? 0x06B6D4 : 0x60A5FA;
      addFloorPlate(group, {
        width: Math.max(120, b.x2 - b.x1),
        depth: Math.max(120, b.y2 - b.y1),
        color: col,
        opacity: 0.12,
        edgeOpacity: 0.75,
        position: [(b.x1 + b.x2) / 2, -44, (b.y1 + b.y2) / 2],
        label: b.name,
      });
    });

    // Regional & Messaging & Storage Platform Layovers
    regionalBounds.forEach((b) => {
      const isMessaging = b.id.includes("messaging") || b.name.toLowerCase().includes("sqs") || b.name.toLowerCase().includes("dynamo");
      const col = isMessaging ? 0xF43F5E : 0x10B981;
      addFloorPlate(group, {
        width: Math.max(180, b.x2 - b.x1),
        depth: Math.max(200, b.y2 - b.y1),
        color: col,
        opacity: 0.12,
        edgeOpacity: 0.85,
        position: [(b.x1 + b.x2) / 2, -50, (b.y1 + b.y2) / 2],
        label: b.name,
      });
    });
  }, [ingressBounds, vpcBounds, azBounds, subnetBounds, regionalBounds]);



  // Camera controls & presets
  const handleCameraPreset = (preset: "iso" | "top" | "angle" | "fit") => {
    setActivePreset(preset);
    if (!graphRef.current) return;
    const isBig = positionedNodes.length > 25;
    const centerX = isBig ? 320 : 220;
    const centerY = -35;
    const centerZ = 0;

    switch (preset) {
      case "fit":
      case "iso":
      case "angle":
        // Clean square architectural isometric perspective (aligned along Z axis, zero yaw diagonal tilt)
        graphRef.current.cameraPosition(
          { x: centerX, y: isBig ? 620 : 540, z: isBig ? 780 : 660 },
          { x: centerX, y: centerY, z: centerZ },
          800
        );
        break;
      case "top":
        // 90-degree blueprint plan view (flat overhead CAD map)
        graphRef.current.cameraPosition(
          { x: centerX, y: isBig ? 1150 : 960, z: 0.1 },
          { x: centerX, y: centerY, z: centerZ },
          800
        );
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

      {/* Subtle vignette radial darkening toward edges staying inside #0B0E14 palette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(11,14,20,0.7)_100%)]" />

      {/* Visible Fallback Banner if 3D encounters an initialization issue */}
      {initError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-xl bg-[#1A0B0E]/95 border border-[#FF5C5C] text-white shadow-2xl backdrop-blur-md">
          <span className="text-xs font-bold text-[#FF5C5C]">3D WebGL Notice:</span>
          <span className="text-xs text-[#CBD5E1]">{initError}</span>
          <button
            onClick={() => setViewMode("2d")}
            className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold transition-colors"
          >
            Switch to 2D
          </button>
        </div>
      )}

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
      <div className="absolute bottom-5 right-5 z-10 flex items-center gap-1.5 p-1.5 bg-[#151A24]/92 backdrop-blur-md border border-[#262D3A] rounded-xl shadow-2xl">
        <button
          onClick={() => handleCameraPreset("iso")}
          className={`px-3 py-1.5 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
            activePreset === "iso"
              ? "bg-[#262D3A] text-white border border-[#4DA3FF]/60 shadow-sm"
              : "text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60"
          }`}
          title="Cloudcraft 3D Isometric View (Drag to Pan, Scroll to Zoom)"
        >
          <span>📐 3D Isometric</span>
        </button>

        <button
          onClick={() => handleCameraPreset("top")}
          className={`px-3 py-1.5 rounded-lg transition-all text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
            activePreset === "top"
              ? "bg-[#262D3A] text-white border border-[#4DA3FF]/60 shadow-sm"
              : "text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60"
          }`}
          title="Top-Down Blueprint Plan View"
        >
          <span>🗺️ Blueprint (2D Plan)</span>
        </button>

        <button
          onClick={() => handleCameraPreset("fit")}
          className="px-2.5 py-1.5 text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 rounded-lg transition-all text-xs font-medium cursor-pointer"
          title="Fit All Resources in Frame"
        >
          🎯 Fit All
        </button>

        <div className="w-px h-5 bg-[#262D3A]" />

        <button
          onClick={() => handleZoom(0.8)}
          className="px-2.5 py-1 text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 rounded-lg transition-all text-[13px] font-semibold cursor-pointer"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => handleZoom(1.25)}
          className="px-2.5 py-1 text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 rounded-lg transition-all text-[13px] font-semibold cursor-pointer"
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
  // Extruded 3D slab box geometry for architectural depth
  const slabHeight = 3.5;
  const boxGeo = new THREE.BoxGeometry(config.width, slabHeight, config.depth);

  // Zone/AZ platforms sit on top at rgba(21,26,36,.5) with 1px #262D3A border
  const mat = new THREE.MeshStandardMaterial({
    color: 0x151A24, // rgba(21, 26, 36)
    transparent: true,
    opacity: 0.5,
    metalness: 0.2,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const slabMesh = new THREE.Mesh(boxGeo, mat);
  slabMesh.position.set(config.position[0], config.position[1] - slabHeight / 2, config.position[2]);
  parent.add(slabMesh);

  // 1px #262D3A border creating visible separation and depth
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x262D3A, // 1px #262D3A border
    transparent: true,
    opacity: 0.95,
    linewidth: 1,
  });
  const topPlaneGeo = new THREE.PlaneGeometry(config.width, config.depth);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(topPlaneGeo), edgeMat);
  edges.rotation.x = Math.PI / 2;
  edges.position.set(config.position[0], config.position[1] + 0.15, config.position[2]);
  parent.add(edges);

  // 4 Cyber Corner Brackets (L-shaped accents at platform corners)
  const bracketLen = Math.min(28, config.width * 0.08);
  const halfW = config.width / 2;
  const halfD = config.depth / 2;
  const bracketMat = new THREE.LineBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: 1.0,
    linewidth: 3,
  });

  const bracketPoints: THREE.Vector3[] = [
    // Top-left corner
    new THREE.Vector3(-halfW, 0.25, -halfD + bracketLen),
    new THREE.Vector3(-halfW, 0.25, -halfD),
    new THREE.Vector3(-halfW + bracketLen, 0.25, -halfD),
    // Top-right corner
    new THREE.Vector3(halfW - bracketLen, 0.25, -halfD),
    new THREE.Vector3(halfW, 0.25, -halfD),
    new THREE.Vector3(halfW, 0.25, -halfD + bracketLen),
    // Bottom-left corner
    new THREE.Vector3(-halfW, 0.25, halfD - bracketLen),
    new THREE.Vector3(-halfW, 0.25, halfD),
    new THREE.Vector3(-halfW + bracketLen, 0.25, halfD),
    // Bottom-right corner
    new THREE.Vector3(halfW - bracketLen, 0.25, halfD),
    new THREE.Vector3(halfW, 0.25, halfD),
    new THREE.Vector3(halfW, 0.25, halfD - bracketLen),
  ];
  const bracketGeo = new THREE.BufferGeometry().setFromPoints(bracketPoints);
  const bracketLines = new THREE.LineSegments(bracketGeo, bracketMat);
  bracketLines.position.set(config.position[0], config.position[1], config.position[2]);
  parent.add(bracketLines);

  // Text label sprite (Crisp human-readable architectural banner)
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 1024;
  labelCanvas.height = 140;
  const ctx = labelCanvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 1024, 140);
    // Dark solid backing for maximum contrast against floor
    ctx.fillStyle = "rgba(14, 20, 32, 0.94)";
    if (ctx.roundRect) ctx.roundRect(4, 10, 1016, 120, 20);
    else ctx.fillRect(4, 10, 1016, 120);
    ctx.fill();

    ctx.strokeStyle = `#${config.color.toString(16).padStart(6, "0")}`;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Solid accent tag on left
    ctx.fillStyle = `#${config.color.toString(16).padStart(6, "0")}`;
    if (ctx.roundRect) ctx.roundRect(4, 10, 16, 120, [20, 0, 0, 20]);
    else ctx.fillRect(4, 10, 16, 120);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 52px 'Inter', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(config.label, 42, 70);
  }
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.minFilter = THREE.LinearFilter;
  const labelSpriteMat = new THREE.SpriteMaterial({
    map: labelTexture,
    transparent: true,
    opacity: 0.98,
    depthWrite: false,
  });
  const labelSprite = new THREE.Sprite(labelSpriteMat);
  const spriteW = Math.min(config.width * 0.82, 240);
  const spriteH = spriteW * (140 / 1024);
  labelSprite.scale.set(spriteW, spriteH, 1);
  labelSprite.position.set(
    config.position[0] - config.width / 2 + spriteW / 2 + 10,
    config.position[1] + spriteH / 2 + 4,
    config.position[2] - config.depth / 2 + 10
  );
  parent.add(labelSprite);
}
