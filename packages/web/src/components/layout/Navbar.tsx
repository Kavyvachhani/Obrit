import React from "react";
import { useGraphStore } from "../../stores/graph-store.js";
import { useAccountStore } from "../../stores/account-store.js";
import {
  RotateCcw,
  Search,
  Box,
  Layers,
  Sparkles,
  Server,
  Cloud,
  Database,
  HardDrive,
  ShieldAlert,
  Plus,
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
  } = useGraphStore();

  const {
    accounts,
    activeAccountId,
    setActiveAccountId,
    setConnectModalOpen,
    seedDemo,
  } = useAccountStore();

  const handleRefresh = async () => {
    setScanning(true);
    // Simulate / execute re-scan
    setTimeout(() => {
      setScanning(false);
      setLastScannedAt(new Date().toLocaleTimeString());
    }, 1500);
  };

  const categories = [
    { id: "all", label: "All", icon: Layers },
    { id: "compute", label: "Compute", icon: Server },
    { id: "network", label: "Network", icon: Cloud },
    { id: "database", label: "Database", icon: Database },
    { id: "storage", label: "Storage", icon: HardDrive },
    { id: "security", label: "Security", icon: ShieldAlert },
  ] as const;

  return (
    <header className="h-16 px-6 glass-panel border-b border-sky-500/20 flex items-center justify-between z-20 shrink-0">
      {/* Left: Branding & Account Dropdown */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-glow">
            <Box className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-tight text-base text-white">ORBIT</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                Phase 1
              </span>
            </div>
            <span className="text-[10px] text-slate-400 tracking-wide block">3D Cloud Explorer</span>
          </div>
        </div>

        {/* Account Selector */}
        <div className="flex items-center space-x-2 pl-4 border-l border-white/10">
          <select
            value={activeAccountId}
            onChange={(e) => setActiveAccountId(e.target.value)}
            className="bg-slate-900/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.alias} ({acc.regions?.[0] || "us-east-1"})
              </option>
            ))}
          </select>

          <button
            onClick={() => setConnectModalOpen(true)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-white/10 transition-colors"
            title="Connect New AWS Account"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center: Search & Filter Tabs */}
      <div className="hidden lg:flex items-center space-x-3">
        {/* Search */}
        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search VPC, EC2, Lambda, RDS..."
            className="w-full bg-slate-950/60 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 transition-colors"
          />
        </div>

        {/* Categories */}
        <div className="flex p-1 rounded-xl bg-slate-950/40 border border-white/10">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const active = filterCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? "bg-sky-500 text-black shadow-glow font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: 3D/2D Mode, Demo Seed & Refresh */}
      <div className="flex items-center space-x-3">
        {/* Demo Seed Button */}
        <button
          onClick={seedDemo}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-medium transition-all hover:shadow-glow-purple"
          title="Reset to Full AWS Production Topology Demo"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Demo Cloud</span>
        </button>

        {/* 2D / 3D Toggle */}
        <div className="flex p-1 rounded-xl bg-slate-950/60 border border-white/10">
          <button
            onClick={() => setViewMode("3d")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "3d"
                ? "bg-gradient-to-r from-sky-500 to-cyan-400 text-black shadow-glow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            3D Cloud
          </button>
          <button
            onClick={() => setViewMode("2d")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "2d"
                ? "bg-gradient-to-r from-sky-500 to-cyan-400 text-black shadow-glow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            2D Canvas
          </button>
        </div>

        {/* Rescan / Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={isScanning}
          className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white text-xs font-medium transition-colors disabled:opacity-50"
          title={`Last scanned: ${lastScannedAt || "Just now"}`}
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-sky-400" : ""}`} />
          <span>{isScanning ? "Scanning..." : "Rescan"}</span>
        </button>
      </div>
    </header>
  );
};
