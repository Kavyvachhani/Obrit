import { create } from "zustand";
import type { GraphData, GraphNode, GraphLink } from "@orbit/core";
import { DEFAULT_AWS_TOPOLOGY, ENTERPRISE_AWS_TOPOLOGY } from "../lib/architecture-data.js";

export interface EdgeTooltipData {
  x: number;
  y: number;
  link: GraphLink;
  sourceName: string;
  targetName: string;
  relation: string;
  isInferred: boolean;
  unverifiedReason?: string;
}

interface GraphState {
  nodes: GraphNode[];
  links: GraphLink[];
  selectedNode: GraphNode | null;
  hoveredNode: GraphNode | null;
  hoveredLink: GraphLink | null;
  edgeTooltip: EdgeTooltipData | null;
  viewMode: "3d" | "2d";
  quality: "low" | "balanced" | "high";
  filterCategory: "all" | "compute" | "network" | "database" | "storage" | "security" | "incomplete";
  searchQuery: string;
  isLoading: boolean;
  isScanning: boolean;
  lastScannedAt: string | null;
  selectedVpcId: string | null;
  activeAccountAlias: string;
  isGrouped: boolean;
  isFaultsOpen: boolean;
  isSecurityHeatmap: boolean;
  activeThreatScenario: string | null;
  unplannedServices: string[];
  isSidebarOpen: boolean;
  isLiveTrafficActive: boolean;
  focusedBlastRadiusNodeId: string | null;
  currentView: "home" | "topology" | "billing";
  isCostOverlayActive: boolean;
  billingData: any | null;
  isBillingOpen: boolean;
  isAccountsOpen: boolean;

  setGraphData: (data: GraphData) => void;
  selectNode: (node: GraphNode | null) => void;
  hoverNode: (node: GraphNode | null) => void;
  hoverLink: (link: GraphLink | null) => void;
  setEdgeTooltip: (tooltip: EdgeTooltipData | null) => void;
  setViewMode: (mode: "3d" | "2d") => void;
  setQuality: (quality: "low" | "balanced" | "high") => void;
  setFilterCategory: (category: GraphState["filterCategory"]) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setScanning: (scanning: boolean) => void;
  setLastScannedAt: (time: string | null) => void;
  setSelectedVpcId: (vpcId: string | null) => void;
  setActiveAccountAlias: (alias: string) => void;
  toggleGrouping: () => void;
  setGrouping: (grouped: boolean) => void;
  setFaultsOpen: (open: boolean) => void;
  toggleSecurityHeatmap: () => void;
  setSecurityHeatmap: (active: boolean) => void;
  setActiveThreatScenario: (scenario: string | null) => void;
  setUnplannedServices: (services: string[]) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleLiveTraffic: () => void;
  setLiveTrafficActive: (active: boolean) => void;
  setFocusedBlastRadiusNodeId: (nodeId: string | null) => void;
  setCurrentView: (view: "home" | "topology" | "billing") => void;
  toggleCostOverlay: () => void;
  setCostOverlayActive: (active: boolean) => void;
  setBillingData: (data: any | null) => void;
  setBillingOpen: (open: boolean) => void;
  setAccountsOpen: (open: boolean) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: ENTERPRISE_AWS_TOPOLOGY.nodes,
  links: ENTERPRISE_AWS_TOPOLOGY.links,
  selectedNode: null,
  hoveredNode: null,
  hoveredLink: null,
  edgeTooltip: null,
  viewMode: "3d",
  quality: "high",
  filterCategory: "all",
  searchQuery: "",
  isLoading: false,
  isScanning: false,
  lastScannedAt: new Date().toLocaleTimeString(),
  selectedVpcId: null,
  activeAccountAlias: "Enterprise-Platform-Prod",
  isGrouped: true,
  isFaultsOpen: false,
  isSecurityHeatmap: false,
  activeThreatScenario: null,
  unplannedServices: [],
  isSidebarOpen: false,
  isLiveTrafficActive: true,
  focusedBlastRadiusNodeId: null,
  currentView: "home",
  isCostOverlayActive: false,
  billingData: null,
  isBillingOpen: false,
  isAccountsOpen: false,

  setGraphData: (data) =>
    set({
      nodes: data.nodes && data.nodes.length > 0 ? data.nodes : DEFAULT_AWS_TOPOLOGY.nodes,
      links: data.links && data.links.length > 0 ? data.links : DEFAULT_AWS_TOPOLOGY.links,
    }),
  selectNode: (node) => set({ selectedNode: node }),
  hoverNode: (node) => set({ hoveredNode: node }),
  hoverLink: (link) => set({ hoveredLink: link }),
  setEdgeTooltip: (tooltip) => set({ edgeTooltip: tooltip }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setQuality: (quality) => set({ quality }),
  setFilterCategory: (category) => set({ filterCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setLoading: (loading) => set({ isLoading: loading }),
  setScanning: (scanning) => set({ isScanning: scanning }),
  setLastScannedAt: (time) => set({ lastScannedAt: time }),
  setSelectedVpcId: (vpcId) => set({ selectedVpcId: vpcId }),
  setActiveAccountAlias: (alias) => set({ activeAccountAlias: alias }),
  toggleGrouping: () => set((state) => ({ isGrouped: !state.isGrouped })),
  setGrouping: (grouped) => set({ isGrouped: grouped }),
  setFaultsOpen: (open) => set({ isFaultsOpen: open }),
  toggleSecurityHeatmap: () => set((state) => ({ isSecurityHeatmap: !state.isSecurityHeatmap })),
  setSecurityHeatmap: (active) => set({ isSecurityHeatmap: active }),
  setActiveThreatScenario: (scenario) => set({ activeThreatScenario: scenario }),
  setUnplannedServices: (services) => set({ unplannedServices: services }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  toggleLiveTraffic: () => set((state) => ({ isLiveTrafficActive: !state.isLiveTrafficActive })),
  setLiveTrafficActive: (active) => set({ isLiveTrafficActive: active }),
  setFocusedBlastRadiusNodeId: (nodeId) => set({ focusedBlastRadiusNodeId: nodeId }),
  setCurrentView: (view) => set({ currentView: view }),
  toggleCostOverlay: () => set((state) => ({ isCostOverlayActive: !state.isCostOverlayActive })),
  setCostOverlayActive: (active) => set({ isCostOverlayActive: active }),
  setBillingData: (data) => set({ billingData: data }),
  setBillingOpen: (open) => set({ isBillingOpen: open }),
  setAccountsOpen: (open) => set({ isAccountsOpen: open }),
}));
