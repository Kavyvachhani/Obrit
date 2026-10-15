import { create } from "zustand";
import type { GraphData, GraphNode, GraphLink } from "@orbit/core";

interface GraphState {
  nodes: GraphNode[];
  links: GraphLink[];
  selectedNode: GraphNode | null;
  hoveredNode: GraphNode | null;
  viewMode: "3d" | "2d";
  quality: "low" | "balanced" | "high";
  filterCategory: "all" | "compute" | "network" | "database" | "storage" | "security";
  searchQuery: string;
  isLoading: boolean;
  isScanning: boolean;
  lastScannedAt: string | null;
  cameraFocusTrigger: { x: number; y: number; z: number } | null;

  setGraphData: (data: GraphData) => void;
  selectNode: (node: GraphNode | null) => void;
  hoverNode: (node: GraphNode | null) => void;
  setViewMode: (mode: "3d" | "2d") => void;
  setQuality: (quality: "low" | "balanced" | "high") => void;
  setFilterCategory: (category: GraphState["filterCategory"]) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setScanning: (scanning: boolean) => void;
  setLastScannedAt: (time: string | null) => void;
  triggerCameraFocus: (pos: { x: number; y: number; z: number } | null) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  links: [],
  selectedNode: null,
  hoveredNode: null,
  viewMode: "3d",
  quality: "high",
  filterCategory: "all",
  searchQuery: "",
  isLoading: false,
  isScanning: false,
  lastScannedAt: null,
  cameraFocusTrigger: null,

  setGraphData: (data) => set({ nodes: data.nodes || [], links: data.links || [] }),
  selectNode: (node) => set({ selectedNode: node }),
  hoverNode: (node) => set({ hoveredNode: node }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setQuality: (quality) => set({ quality }),
  setFilterCategory: (category) => set({ filterCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setLoading: (loading) => set({ isLoading: loading }),
  setScanning: (scanning) => set({ isScanning: scanning }),
  setLastScannedAt: (time) => set({ lastScannedAt: time }),
  triggerCameraFocus: (pos) => set({ cameraFocusTrigger: pos }),
}));
