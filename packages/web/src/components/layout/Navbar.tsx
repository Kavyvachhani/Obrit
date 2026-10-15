import React from "react";
import { useGraphStore } from "../../stores/graph-store.js";
import { useAccountStore } from "../../stores/account-store.js";
import { triggerScan, fetchGraph } from "../../lib/api.js";
import {
  RotateCcw,
  Search,
  Box,
  Layers,
  Server,
  Cloud,
  Database,
  HardDrive,
  Shield,
  Plus,
  Key,
  ChevronRight,
  Sliders,
} from "lucide-react";

export const Navbar: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    filterCategory,
    setFilterCategory,
    searchQuery,
    setSearchQuery,
    isScanning,
    setScanning,
    lastScannedAt,
    setLastScannedAt,
    setGraphData,
    selectedNode,
  } = useGraphStore();

  const {
    accounts,
    activeAccountId,
    setActiveAccountId,
    setConnectModalOpen,
  } = useAccountStore();

  const handleRefresh = async () => {
    if (!activeAccountId) {
      setConnectModalOpen(true);
      return;
    }

    try {
      setScanning(true);
      await triggerScan(activeAccountId);
      const graph = await fetchGraph(activeAccountId);
      if (graph) {
        setGraphData(graph);
      }
      setLastScannedAt(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Rescan failed:", err);
    } finally {
      setScanning(false);
    }
  };

  const categories = [
    { id: "all", label: "All", icon: Layers, count: null, color: "text-zinc-400" },
    { id: "compute", label: "Compute", icon: Server, color: "text-amber-500" },
    { id: "network", label: "Network", icon: Cloud, color: "text-purple-400" },
    { id: "database", label: "Database", icon: Database, color: "text-blue-400" },
    { id: "storage", label: "Storage", icon: HardDrive, color: "text-emerald-400" },
    { id: "security", label: "Security", icon: Shield, color: "text-red-400" },
  ] as const;

  return (
    <header className="h-14 px-4 bg-[#121215] border-b border-[#27272a] flex items-center justify-between z-20 shrink-0 font-sans">
      {/* Left: Product Brand & Breadcrumb */}
      <div className="flex items-center space-x-4">
        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1e1e24] border border-[#3f3f46] flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-sm">
            <Box className="w-4 h-4 text-zinc-200" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 leading-none">
              <span className="font-bold text-sm text-zinc-100 tracking-tight">ORBIT</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                AWS 3D
              </span>
            </div>
          </div>
        </div>

        <ChevronRight className="w-3.5 h-3.5 text-zinc-600 hidden sm:block" />

        {/* Breadcrumb Path */}
        <div className="hidden md:flex items-center space-x-1.5 text-xs font-mono text-zinc-400">
          <span className="text-zinc-500">aws</span>
          <ChevronRight className="w-3 h-3 text-zinc-600" />
          <span className="text-zinc-300 font-medium">us-east-1</span>
          {selectedNode && (
            <>
              <ChevronRight className="w-3 h-3 text-zinc-600" />
              <span className="text-amber-400 font-semibold truncate max-w-[140px]">{selectedNode.name}</span>
            </>
          )}
        </div>

        {/* Account Switcher */}
        <div className="flex items-center space-x-2 pl-3 border-l border-[#27272a]">
          {accounts.length > 0 ? (
            <div className="flex items-center space-x-1.5">
              <select
                value={activeAccountId}
                onChange={(e) => setActiveAccountId(e.target.value)}
                className="bg-[#18181b] border border-[#27272a] rounded-md px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.alias} ({acc.regions?.[0] || "us-east-1"})
                  </option>
                ))}
              </select>

              <button
                onClick={() => setConnectModalOpen(true)}
                className="p-1 rounded-md bg-[#18181b] hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-[#27272a]"
                title="Connect New AWS Account"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConnectModalOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Connect AWS Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Center: Search & Filter Tabs */}
      <div className="hidden xl:flex items-center space-x-3">
        {/* Search */}
        <div className="relative w-56">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resource or ARN..."
            className="w-full bg-[#18181b] border border-[#27272a] rounded-md pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex p-0.5 rounded-md bg-[#18181b] border border-[#27272a]">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const active = filterCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  active
                    ? "bg-[#27272a] text-zinc-100 font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`}
              >
                <Icon className={`w-3 h-3 ${cat.color || "text-zinc-400"}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: View Toggle & Rescan */}
      <div className="flex items-center space-x-2.5">
        {/* 2D / 3D Switch */}
        <div className="flex p-0.5 rounded-md bg-[#18181b] border border-[#27272a]">
          <button
            onClick={() => setViewMode("3d")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === "3d" ? "bg-[#27272a] text-zinc-100 font-semibold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            3D Topology
          </button>
          <button
            onClick={() => setViewMode("2d")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === "2d" ? "bg-[#27272a] text-zinc-100 font-semibold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            2D Architecture
          </button>
        </div>

        {/* Rescan Button */}
        <button
          onClick={handleRefresh}
          disabled={isScanning}
          className="flex items-center space-x-1.5 px-3 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium transition-colors disabled:opacity-50"
          title={lastScannedAt ? `Last scanned: ${lastScannedAt}` : "Scan AWS Infrastructure"}
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-amber-400" : "text-zinc-400"}`} />
          <span>{isScanning ? "Scanning Account..." : "Scan Account"}</span>
        </button>
      </div>
    </header>
  );
};
