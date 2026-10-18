import React, { useState, useRef, useEffect } from "react";
import { useGraphStore } from "../../stores/graph-store.js";
import { useAccountStore } from "../../stores/account-store.js";
import { triggerScan, fetchGraph } from "../../lib/api.js";
import { DEFAULT_AWS_TOPOLOGY, ENTERPRISE_AWS_TOPOLOGY } from "../../lib/architecture-data.js";
import { auditGraphFaultTolerance } from "../../lib/fault-tolerance.js";
import {
  Search,
  X,
  Layers,
  Settings,
  Camera,
  RotateCcw,
  Download,
  Radio,
  ChevronDown,
  AlertTriangle,
  Box,
  Server,
  Cloud,
  Database,
  HardDrive,
  Shield,
  Check,
  Plus,
  Trash2,
  ShieldAlert,
  Boxes,
  PanelLeft,
} from "lucide-react";

export const Navbar: React.FC = () => {
  const {
    nodes,
    links,
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
    selectNode,
    isGrouped,
    toggleGrouping,
    setFaultsOpen,
    isSecurityHeatmap,
    toggleSecurityHeatmap,
    unplannedServices,
    setUnplannedServices,
    isSidebarOpen,
    toggleSidebar,
  } = useGraphStore();

  const {
    accounts,
    activeAccountId,
    setActiveAccountId,
    removeAccount,
    setConnectModalOpen,
  } = useAccountStore();

  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const layersRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const resilienceReport = React.useMemo(() => {
    return auditGraphFaultTolerance(nodes, links);
  }, [nodes, links]);

  const incompleteCount = React.useMemo(() => {
    return nodes.filter((n) => n.status === "incomplete").length;
  }, [nodes]);

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layersRef.current && !layersRef.current.contains(e.target as Node)) {
        setIsLayersOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsLayersOpen(false);
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleRefresh = async () => {
    if (!activeAccountId || activeAccountId === "demo") {
      setScanning(true);
      setTimeout(() => {
        setScanning(false);
        setLastScannedAt(new Date().toLocaleTimeString());
      }, 500);
      return;
    }

    try {
      setScanning(true);
      const scanRes = await triggerScan(activeAccountId);
      if (scanRes && scanRes.unplannedServices) {
        setUnplannedServices(scanRes.unplannedServices);
      }
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

  const handleExport = () => {
    // Export graph topology as JSON
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(nodes, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `orbit-aws-architecture-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCameraReset = () => {
    // Trigger reset camera event for active graph
    window.dispatchEvent(new CustomEvent("orbit:reset-camera"));
  };

  const layerOptions = [
    { id: "all", label: "All Infrastructure", icon: Layers },
    { id: "compute", label: "Compute Tier (EC2, Lambda)", icon: Server },
    { id: "network", label: "Network Tier (VPC, Subnet, ELB)", icon: Cloud },
    { id: "database", label: "Database Tier (RDS, Aurora)", icon: Database },
    { id: "storage", label: "Storage (S3, Buckets)", icon: HardDrive },
    { id: "security", label: "Security & IAM (Roles, SG)", icon: Shield },
  ] as const;

  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const isDemoActive = !activeAccountId || activeAccountId === "demo" || !activeAccount;
  const currentProfileTitle = isDemoActive ? "Multi-AZ Reference" : activeAccount.alias;
  const currentProfileSub = isDemoActive ? "Demo Stack" : (activeAccount.regions[0] || "aws");

  return (
    <header className="absolute top-4 left-4 right-4 z-40 pointer-events-none flex flex-col gap-2 font-sans select-none">
      {/* ── Row 1: Floating Search + Layers + Settings ── */}
      <div className="pointer-events-auto flex items-center justify-between px-4 py-2 bg-[#151A24]/85 backdrop-blur-md border border-[#262D3A] rounded-xl shadow-2xl">
        {/* Left: Brand & Profile Switcher & Search Bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-3 border-r border-[#262D3A]">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/25 via-[#151A24] to-[#0B0E14] border border-[#262D3A] flex items-center justify-center text-[#E6E9EF] shadow-sm">
              <Box className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <span className="font-bold text-sm tracking-tight text-[#E6E9EF]">
              ORBIT
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#0B0E14] text-[#8893A6] border border-[#262D3A]">
              AWS
            </span>
          </div>

          {/* AWS Profile / Account Switcher Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                isProfileOpen
                  ? "bg-[#262D3A] border-[#FF9900] text-[#E6E9EF]"
                  : "bg-[#0B0E14]/80 border-[#262D3A] text-[#E6E9EF] hover:border-[#FF9900]/60 hover:bg-[#262D3A]/40"
              }`}
              title="Switch AWS Profile / Account"
            >
              <div className="w-2 h-2 rounded-full bg-[#3DDC84] animate-pulse" />
              <Cloud className="w-3.5 h-3.5 text-[#FF9900]" />
              <div className="flex flex-col text-left leading-none">
                <span className="font-semibold text-[11px] text-[#E6E9EF] max-w-[140px] truncate">
                  {currentProfileTitle}
                </span>
                <span className="text-[9px] font-mono text-[#8893A6]">
                  {currentProfileSub}
                </span>
              </div>
              <ChevronDown className={`w-3 h-3 text-[#8893A6] transition-transform ${isProfileOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Profile Dropdown Popover */}
            {isProfileOpen && (
              <div className="absolute left-0 mt-2 w-80 bg-[#151A24]/95 backdrop-blur-md border border-[#262D3A] rounded-xl shadow-2xl p-3 z-50 flex flex-col gap-3 font-sans">
                {/* Section: Connected Accounts */}
                <div>
                  <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-wider text-[#8893A6] mb-1.5">
                    <span>Connected AWS Accounts</span>
                    <span>{accounts.length} Profiles</span>
                  </div>

                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {accounts.length > 0 ? (
                      accounts.map((acc) => {
                        const isActive = acc.id === activeAccountId;
                        return (
                          <div
                            key={acc.id}
                            className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                              isActive
                                ? "bg-[#262D3A] border-[#4DA3FF]"
                                : "bg-[#0B0E14] border-[#262D3A] hover:border-[#8893A6]/40"
                            }`}
                          >
                            <button
                              onClick={async () => {
                                setActiveAccountId(acc.id);
                                setIsProfileOpen(false);
                                try {
                                  const graph = await fetchGraph(acc.id);
                                  if (graph) setGraphData(graph);
                                } catch (err) {
                                  console.error("Failed to load graph for account:", err);
                                }
                              }}
                              className="flex-1 flex items-center gap-2 text-left min-w-0"
                            >
                              <Cloud className="w-4 h-4 text-[#FF9900] shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-[#E6E9EF] flex items-center gap-1.5 truncate">
                                  <span>{acc.alias}</span>
                                  {isActive && <Check className="w-3.5 h-3.5 text-[#3DDC84] shrink-0" />}
                                </div>
                                <div className="text-[10px] font-mono text-[#8893A6] truncate">
                                  {acc.regions[0] || "global"} • {acc.id.slice(0, 8)}…
                                </div>
                              </div>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeAccount(acc.id);
                              }}
                              className="p-1.5 text-[#8893A6] hover:text-[#FF5C5C] hover:bg-[#151A24] rounded-md transition-colors ml-1"
                              title="Disconnect Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-[#8893A6] italic py-1 px-1">
                        No custom AWS profiles connected yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-px bg-[#262D3A]" />

                {/* Section: Reference / Demo Architectures */}
                <div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-[#8893A6] mb-1.5">
                    Reference Architecture
                  </div>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => {
                        setActiveAccountId("demo");
                        setGraphData(DEFAULT_AWS_TOPOLOGY);
                        setIsProfileOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all ${
                        isDemoActive && nodes.length <= 15
                          ? "bg-[#262D3A] border-[#4DA3FF]"
                          : "bg-[#0B0E14] border-[#262D3A] hover:border-[#8893A6]/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-left">
                        <Box className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-[#E6E9EF] flex items-center gap-1.5">
                            Multi-AZ Production Stack
                            {isDemoActive && nodes.length <= 15 && <Check className="w-3.5 h-3.5 text-[#3DDC84]" />}
                          </div>
                          <div className="text-[10px] font-mono text-[#8893A6]">
                            us-east-1 • 12 Resources • Core Multi-AZ
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setActiveAccountId("demo");
                        setGraphData(ENTERPRISE_AWS_TOPOLOGY);
                        setUnplannedServices([]);
                        setIsProfileOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all ${
                        isDemoActive && nodes.length > 15
                          ? "bg-[#262D3A] border-[#4DA3FF]"
                          : "bg-[#0B0E14] border-[#262D3A] hover:border-[#8893A6]/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-left">
                        <Server className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-[#E6E9EF] flex items-center gap-1.5">
                            Enterprise Cloud Fabric
                            {isDemoActive && nodes.length > 15 && <Check className="w-3.5 h-3.5 text-[#3DDC84]" />}
                          </div>
                          <div className="text-[10px] font-mono text-[#8893A6]">
                            us-east-1 • 24 Resources • DynamoDB, SQS, CloudFront
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-[#262D3A]" />

                {/* Connect New AWS Account Action */}
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setConnectModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-indigo-500/20 via-blue-500/20 to-indigo-500/20 hover:from-indigo-500/30 hover:to-blue-500/30 border border-indigo-500/40 text-xs font-semibold text-[#E6E9EF] transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Connect New AWS Profile</span>
                </button>
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-64 md:w-80">
            <Search className="w-3.5 h-3.5 text-[#8893A6] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search resources, ARNs, CIDR, IDs..."
              className="w-full bg-[#0B0E14]/80 border border-[#262D3A] hover:border-[#8893A6]/50 focus:border-[#4DA3FF] rounded-lg pl-8 pr-7 py-1.5 text-xs text-[#E6E9EF] placeholder:text-[#8893A6] focus:outline-none transition-all font-mono"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8893A6] hover:text-[#E6E9EF]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1 rounded bg-[#151A24] text-[9.5px] text-[#8893A6] font-mono border border-[#262D3A]">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Right: Scan Gap Badge + Layers ▾ + Settings ⚙ */}
        <div className="flex items-center gap-2">
          {/* Scan-gap badge (selects and inspects the incomplete node without hiding the network) */}
          {incompleteCount > 0 && (
            <button
              onClick={() => {
                const firstIncomplete = nodes.find((n) => n.status === "incomplete");
                if (firstIncomplete) {
                  selectNode(firstIncomplete);
                  window.dispatchEvent(
                    new CustomEvent("orbit:focus-node", { detail: { id: firstIncomplete.id } })
                  );
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#151A24] hover:bg-[#262D3A]/60 border border-dashed border-[#8893A6] text-[#E6E9EF] transition-all text-xs font-mono cursor-pointer"
              title="Click to locate and inspect tool-side scan gaps (incomplete describe responses)"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#8893A6]" />
              <span className="text-[11px] font-medium">
                {incompleteCount} Scan Gap{incompleteCount > 1 ? "s" : ""}
              </span>
            </button>
          )}

          {/* Fault Tolerance & Resilience Checklist Trigger */}
          <button
            onClick={() => setFaultsOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-medium cursor-pointer shadow-sm group ${
              resilienceReport.summary.critical > 0
                ? "bg-[#FF5C5C]/15 border-[#FF5C5C]/50 text-[#FF5C5C] hover:bg-[#FF5C5C]/25"
                : "bg-[#151A24] border-[#262D3A] text-[#E6E9EF] hover:border-[#F2B33D]/60"
            }`}
            title="Open Fault Tolerance & Resilience Checklist"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#FF5C5C] group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-semibold">
              {resilienceReport.summary.total} Faults ({resilienceReport.score}%)
            </span>
          </button>

          {/* Smart Fleet Grouping / Unpack Toggle */}
          {nodes.length > 20 && (
            <button
              onClick={toggleGrouping}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-medium cursor-pointer ${
                isGrouped
                  ? "bg-[#262D3A] border-[#38BDF8] text-[#38BDF8]"
                  : "bg-[#0B0E14]/80 border-[#262D3A] text-[#8893A6] hover:text-[#E6E9EF]"
              }`}
              title={
                isGrouped
                  ? "Fleet Grouping Active (Fast 60fps, low RAM) • Click to Unpack All"
                  : "Unpacked View (All Nodes Detailed) • Click to Group Fleets"
              }
            >
              <Boxes className="w-3.5 h-3.5" />
              <span className="text-[11px]">
                {isGrouped ? "Fleet Grouped" : "Unpacked"}
              </span>
            </button>
          )}

          {/* Security Heatmap Mode Toggle */}
          <button
            onClick={toggleSecurityHeatmap}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-medium cursor-pointer ${
              isSecurityHeatmap
                ? "bg-[#FF5C5C]/20 border-[#FF5C5C] text-[#FF5C5C] shadow-lg shadow-[#FF5C5C]/20"
                : "bg-[#0B0E14]/80 border-[#262D3A] text-[#8893A6] hover:text-[#E6E9EF]"
            }`}
            title="Toggle Security Vulnerability Heatmap Mode"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">{isSecurityHeatmap ? "Heatmap ON" : "Heatmap"}</span>
          </button>

          {/* Layers Dropdown */}
          <div className="relative" ref={layersRef}>
            <button
              onClick={() => setIsLayersOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                isLayersOpen || filterCategory !== "all"
                  ? "bg-[#262D3A] border-[#4DA3FF] text-[#E6E9EF]"
                  : "bg-[#0B0E14]/80 border-[#262D3A] text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/40"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#4DA3FF]" />
              <span>Layers</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isLayersOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Floating Layers Popover */}
            {isLayersOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[#151A24]/95 backdrop-blur-md border border-[#262D3A] rounded-xl shadow-2xl p-3 z-50 flex flex-col gap-3 font-sans">
                {/* 3D / 2D View Switch */}
                <div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-[#8893A6] mb-1.5">
                    View Topology Mode
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#0B0E14] border border-[#262D3A]">
                    <button
                      onClick={() => setViewMode("3d")}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                        viewMode === "3d"
                          ? "bg-[#151A24] text-[#E6E9EF] border border-[#262D3A] shadow-sm"
                          : "text-[#8893A6] hover:text-[#E6E9EF]"
                      }`}
                    >
                      <Box className="w-3.5 h-3.5 text-indigo-400" />
                      <span>3D Isometric</span>
                    </button>
                    <button
                      onClick={() => setViewMode("2d")}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                        viewMode === "2d"
                          ? "bg-[#151A24] text-[#E6E9EF] border border-[#262D3A] shadow-sm"
                          : "text-[#8893A6] hover:text-[#E6E9EF]"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      <span>2D Diagram</span>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-[#262D3A]" />

                {/* Per-type Filters */}
                <div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-[#8893A6] mb-1.5">
                    Infrastructure Layers
                  </div>
                  <div className="flex flex-col gap-1">
                    {layerOptions.map((opt) => {
                      const Icon = opt.icon;
                      const active = filterCategory === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setFilterCategory(opt.id as any)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                            active
                              ? "bg-[#262D3A] text-[#E6E9EF] font-medium"
                              : "text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/40"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-[#8893A6]" />
                            <span>{opt.label}</span>
                          </div>
                          {active && <Check className="w-3.5 h-3.5 text-[#4DA3FF]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Settings ⚙ */}
          <button
            onClick={() => setConnectModalOpen(true)}
            className="p-1.5 rounded-lg bg-[#0B0E14]/80 border border-[#262D3A] text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/40 transition-colors"
            title="AWS Account Settings & Connect"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Row 2: Floating Icon Rail ── */}
      <div className="pointer-events-auto flex items-center gap-1 self-start px-2 py-1 bg-[#151A24]/85 backdrop-blur-md border border-[#262D3A] rounded-lg shadow-xl">
        <button
          onClick={toggleSidebar}
          className={`p-1.5 rounded-md transition-all text-xs cursor-pointer ${
            isSidebarOpen
              ? "bg-[#262D3A] text-[#4DA3FF]"
              : "text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60"
          }`}
          title={isSidebarOpen ? "Close Resources Sidebar" : "Open Resources Sidebar"}
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3.5 bg-[#262D3A]" />

        <button
          onClick={handleCameraReset}
          className="p-1.5 rounded-md text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 transition-all text-xs"
          title="Reset Camera View"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleRefresh}
          disabled={isScanning}
          className="p-1.5 rounded-md text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 transition-all text-xs disabled:opacity-40"
          title={lastScannedAt ? `Rescan Account (Last: ${lastScannedAt})` : "Rescan AWS Account"}
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-[#F2B33D]" : ""}`} />
        </button>

        <button
          onClick={handleExport}
          className="p-1.5 rounded-md text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 transition-all text-xs"
          title="Export Infrastructure Architecture"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            // Trigger animation cycle
            window.dispatchEvent(new CustomEvent("orbit:simulate-traffic"));
          }}
          className="p-1.5 rounded-md text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 transition-all text-xs"
          title="Simulate Real-time Network Traffic Flow"
        >
          <Radio className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Row 3: Deterministic Unplanned / Unmapped Services Detector Banner ── */}
      {unplannedServices && unplannedServices.length > 0 && (
        <div className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-2 bg-[#151A24]/95 backdrop-blur-md border border-[#F2B33D]/40 rounded-xl shadow-2xl text-xs font-sans max-w-4xl animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-[#F2B33D]/15 border border-[#F2B33D]/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-[#F2B33D]" />
            </div>
            <div className="text-[#E6E9EF] truncate">
              <span className="font-semibold text-[#F2B33D]">
                {unplannedServices.length} service{unplannedServices.length > 1 ? "s" : ""} detected with usage
              </span>{" "}
              but not yet visualized:{" "}
              <span className="font-mono text-[#F2B33D] bg-[#0B0E14] px-1.5 py-0.5 rounded border border-[#262D3A]">
                {unplannedServices.join(", ")}
              </span>{" "}
              — add to next scan?
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setScanning(true);
                setTimeout(() => {
                  setGraphData(ENTERPRISE_AWS_TOPOLOGY);
                  setUnplannedServices([]);
                  setScanning(false);
                  setLastScannedAt(new Date().toLocaleTimeString());
                  window.dispatchEvent(new CustomEvent("orbit:reset-camera"));
                }, 400);
              }}
              disabled={isScanning}
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#F2B33D]/20 to-[#FF9900]/20 hover:from-[#F2B33D]/30 hover:to-[#FF9900]/30 border border-[#F2B33D]/50 text-[#F2B33D] font-semibold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Add DynamoDB, SQS, CloudFront to active architecture graph"
            >
              <RotateCcw className={`w-3 h-3 ${isScanning ? "animate-spin" : ""}`} />
              <span>Add to next scan</span>
            </button>
            <button
              onClick={() => setUnplannedServices([])}
              className="p-1 text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A]/60 rounded-md transition-colors"
              title="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
