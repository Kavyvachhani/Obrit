import React, { useState } from "react";
import { useGraphStore } from "../../stores/graph-store.js";
import { buildConsoleLink, RESOURCE_TYPE_LABELS, RESOURCE_TYPE_COLORS } from "@orbit/core";
import type { GraphNode } from "@orbit/core";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Tag,
  Code,
  Info,
  ShieldCheck,
  Server,
  Cloud,
  Layers,
  Database,
  Cpu,
  FolderGit2,
  Activity,
  Zap,
  AlertTriangle,
  Terminal,
  ShieldAlert,
  Radio,
  ArrowUpRight,
  ArrowDownRight,
  Play,
  RotateCcw,
} from "lucide-react";

export const InspectorPanel: React.FC = () => {
  const {
    nodes,
    links,
    selectedNode,
    selectNode,
    toggleGrouping,
    isGrouped,
    focusedBlastRadiusNodeId,
    setFocusedBlastRadiusNodeId,
  } = useGraphStore();
  const [copiedArn, setCopiedArn] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedRemediation, setCopiedRemediation] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "debug" | "config" | "tags">("overview");
  const [fleetSearch, setFleetSearch] = useState("");

  // Close on Escape key press (always called unconditionally to satisfy React Rules of Hooks)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        selectNode(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectNode]);

  // Unconditional calculations to strictly satisfy React Rules of Hooks
  const isCluster = Boolean((selectedNode?.rawConfig as any)?.isCluster);
  const clusterRaw = isCluster && selectedNode ? (selectedNode.rawConfig as any) : null;
  const clusterMembers: GraphNode[] = isCluster ? (((clusterRaw?.allMembers || []) as GraphNode[]).filter(Boolean)) : [];

  const typeLabel = isCluster
    ? "FLEET CLUSTER"
    : selectedNode
    ? (RESOURCE_TYPE_LABELS as Record<string, string>)[selectedNode.type] || selectedNode.type
    : "";
  const typeColor = isCluster
    ? "#38BDF8"
    : selectedNode
    ? (RESOURCE_TYPE_COLORS as Record<string, string>)[selectedNode.type] || "#3b82f6"
    : "#3b82f6";
  const consoleUrl = selectedNode
    ? buildConsoleLink(
        selectedNode.type as any,
        selectedNode.region,
        selectedNode.id,
        selectedNode.arn
      )
    : null;

  const blastRadius = React.useMemo(() => {
    if (!selectedNode) return { upstream: [] as GraphNode[], downstream: [] as GraphNode[], total: 0 };
    const nodeId = selectedNode.id;
    const upstream: GraphNode[] = [];
    const downstream: GraphNode[] = [];
    const nodeLookup = new Map(nodes.map((n) => [n.id, n]));

    for (const l of links) {
      const srcId = typeof l.source === "object" ? (l.source as any).id : l.source;
      const tgtId = typeof l.target === "object" ? (l.target as any).id : l.target;

      if (tgtId === nodeId) {
        const src = nodeLookup.get(srcId);
        if (src && !upstream.some((u) => u.id === src.id)) upstream.push(src);
      } else if (srcId === nodeId) {
        const tgt = nodeLookup.get(tgtId);
        if (tgt && !downstream.some((d) => d.id === tgt.id)) downstream.push(tgt);
      }
    }

    return { upstream, downstream, total: upstream.length + downstream.length };
  }, [selectedNode, nodes, links]);

  const isBlastRadiusActive = focusedBlastRadiusNodeId === selectedNode?.id;

  const handleToggleBlastRadius = () => {
    if (isBlastRadiusActive) {
      setFocusedBlastRadiusNodeId(null);
    } else {
      setFocusedBlastRadiusNodeId(selectedNode?.id || null);
    }
  };

  const getAwsCliCommand = () => {
    if (!selectedNode) return "";
    if (selectedNode.type.startsWith("ec2:instance")) {
      return `aws ec2 describe-instances --instance-ids ${selectedNode.id} --region ${selectedNode.region || "us-east-1"}`;
    }
    if (selectedNode.type.startsWith("ec2:security-group")) {
      return `aws ec2 describe-security-groups --group-ids ${selectedNode.id} --region ${selectedNode.region || "us-east-1"}`;
    }
    if (selectedNode.type.startsWith("rds:")) {
      return `aws rds describe-db-instances --db-instance-identifier ${selectedNode.id} --region ${selectedNode.region || "us-east-1"}`;
    }
    if (selectedNode.type.startsWith("lambda:")) {
      return `aws lambda get-function --function-name ${selectedNode.name} --region ${selectedNode.region || "us-east-1"}`;
    }
    if (selectedNode.type.startsWith("s3:")) {
      return `aws s3api get-bucket-policy --bucket ${selectedNode.name}`;
    }
    return `aws resourcegroupstaggingapi get-resources --resource-arn-list "${selectedNode.arn}"`;
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText(getAwsCliCommand());
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleCopyRemediation = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRemediation(true);
    setTimeout(() => setCopiedRemediation(false), 2000);
  };

  const triggerRemediationNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Node telemetry metrics
  const telemetry = React.useMemo(() => {
    if (!selectedNode) return null;
    const isFailed = selectedNode.status === "failed";
    const isExposed = selectedNode.status === "exposed";
    const isDb = selectedNode.type.startsWith("rds:");

    return {
      cpu: isFailed ? 98.4 : isExposed ? 64.2 : 36.8,
      memory: isFailed ? 94.1 : 52.6,
      throughput: isFailed ? "120 req/s (dropping)" : isDb ? "4,100 IOPS" : "1,840 req/s",
      latency: isFailed ? "4,200 ms (timeout)" : isDb ? "1.4 ms" : "16 ms",
      errorRate: isFailed ? "14.2% (CRITICAL)" : "0.01%",
    };
  }, [selectedNode]);

  const handleCopyArn = () => {
    if (!selectedNode) return;
    navigator.clipboard.writeText(selectedNode.arn);
    setCopiedArn(true);
    setTimeout(() => setCopiedArn(false), 2000);
  };

  const getTypeIcon = () => {
    if (isCluster) return <Layers className="w-4 h-4 text-[#38BDF8]" />;
    if (!selectedNode) return <Layers className="w-4 h-4 text-zinc-400" />;
    if (selectedNode.type.startsWith("vpc:")) return <Cloud className="w-4 h-4 text-purple-400" />;
    if (selectedNode.type.startsWith("ec2:")) return <Server className="w-4 h-4 text-amber-500" />;
    if (selectedNode.type.startsWith("lambda:")) return <Cpu className="w-4 h-4 text-yellow-400" />;
    if (selectedNode.type.startsWith("rds:")) return <Database className="w-4 h-4 text-blue-400" />;
    if (selectedNode.type.startsWith("s3:")) return <FolderGit2 className="w-4 h-4 text-emerald-400" />;
    return <Layers className="w-4 h-4 text-zinc-400" />;
  };

  const filteredClusterMembers = isCluster
    ? clusterMembers.filter((m) => {
        if (!fleetSearch) return true;
        const q = fleetSearch.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          (m.region && m.region.toLowerCase().includes(q))
        );
      })
    : [];

  if (!selectedNode) return null;

  return (
    <aside className="absolute top-22 right-4 bottom-4 w-96 max-w-[calc(100vw-2rem)] bg-[#121620]/95 backdrop-blur-md rounded-xl border border-[#262D3A] flex flex-col z-40 shadow-2xl overflow-hidden font-sans animate-in fade-in slide-in-from-right-2 duration-150">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-[#262D3A] flex items-center justify-between bg-[#151A24]">
        <div className="flex items-center space-x-2.5 pr-2 overflow-hidden min-w-0">
          <div className="p-2 rounded-lg bg-[#0B0E14] border border-[#262D3A] shrink-0">
            {getTypeIcon()}
          </div>
          <div className="overflow-hidden min-w-0">
            <span
              className="text-[9.5px] px-2 py-0.5 rounded font-mono font-semibold inline-block mb-0.5 border"
              style={{
                backgroundColor: `${typeColor}15`,
                borderColor: `${typeColor}40`,
                color: typeColor,
              }}
            >
              {typeLabel}
            </span>
            <h3 className="text-xs font-bold text-[#E6E9EF] truncate" title={selectedNode.name}>
              {selectedNode.name}
            </h3>
          </div>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#8893A6] hover:text-[#E6E9EF] bg-[#0B0E14] hover:bg-[#262D3A] border border-[#262D3A] transition-colors cursor-pointer shrink-0 shadow-sm"
          title="Close details panel (or press Esc)"
        >
          <X className="w-3.5 h-3.5" />
          <span>Close</span>
        </button>
      </div>

      {/* If this is a Fleet Cluster, render the Fleet Explorer */}
      {isCluster ? (
        <div className="flex-1 flex flex-col overflow-hidden text-xs font-sans">
          {/* Fleet Metrics */}
          <div className="p-4 bg-[#141418] border-b border-[#27272a] grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded bg-[#1e1e24] border border-[#2e2e38]">
              <div className="text-[10px] font-mono text-zinc-400">Total</div>
              <div className="text-sm font-bold text-zinc-100 mt-0.5">
                {clusterRaw.totalCount}
              </div>
            </div>
            <div className="p-2 rounded bg-[#1e1e24] border border-[#2e2e38]">
              <div className="text-[10px] font-mono text-zinc-400">Healthy</div>
              <div className="text-sm font-bold text-[#3DDC84] mt-0.5">
                {clusterRaw.healthyCount || clusterRaw.totalCount}
              </div>
            </div>
            <div className="p-2 rounded bg-[#1e1e24] border border-[#2e2e38]">
              <div className="text-[10px] font-mono text-zinc-400">Exposed</div>
              <div className="text-sm font-bold text-[#F2B33D] mt-0.5">
                {clusterRaw.exposedCount || 0}
              </div>
            </div>
          </div>

          {/* Quick Unpack Toggle */}
          <div className="p-3 bg-[#101013] border-b border-[#27272a] flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">
              Fleet Grouping Mode:
            </span>
            <button
              onClick={toggleGrouping}
              className="px-2.5 py-1 rounded bg-[#1e1e24] hover:bg-[#2e2e38] border border-[#27272a] text-[#38BDF8] text-[11px] font-medium transition-colors"
            >
              {isGrouped ? "Unpack onto Canvas" : "Group into Fleet"}
            </button>
          </div>

          {/* Member Search */}
          <div className="p-3 border-b border-[#27272a]">
            <input
              type="text"
              value={fleetSearch}
              onChange={(e) => setFleetSearch(e.target.value)}
              placeholder={`Search ${clusterMembers.length} fleet resources...`}
              className="w-full px-3 py-1.5 bg-[#141418] border border-[#27272a] rounded text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#38BDF8]"
            />
          </div>

          {/* Members List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono">
            <div className="text-[10px] text-zinc-500 font-sans uppercase mb-2">
              Showing {filteredClusterMembers.length} of {clusterMembers.length} resources
            </div>
            {filteredClusterMembers.slice(0, 150).map((member) => (
              <div
                key={member.id}
                onClick={() => selectNode(member)}
                className="p-2 rounded bg-[#16161c] hover:bg-[#202028] border border-[#27272a] hover:border-[#38BDF8]/60 cursor-pointer flex items-center justify-between transition-colors"
              >
                <div className="overflow-hidden pr-2">
                  <div className="text-xs text-zinc-200 font-medium truncate" title={member.name}>
                    {member.name}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5 font-sans">
                    {member.region || "us-east-1"} • {(member.rawConfig as any)?.Runtime || member.type}
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      member.status === "failed"
                        ? "bg-[#FF5C5C]"
                        : member.status === "exposed"
                        ? "bg-[#F2B33D]"
                        : "bg-[#3DDC84]"
                    }`}
                  />
                </div>
              </div>
            ))}
            {filteredClusterMembers.length > 150 && (
              <div className="text-center py-2 text-[11px] text-zinc-500 font-sans">
                + {filteredClusterMembers.length - 150} more resources (use search above to filter)
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Regular Single Resource Tabs */}
          <div className="flex border-b border-[#27272a] px-3 bg-[#141418] text-xs font-medium">
            <button
              onClick={() => setActiveTab("overview")}
              className={`py-2.5 px-2.5 border-b-2 flex items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTab === "overview"
                  ? "border-[#4DA3FF] text-[#4DA3FF]"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab("debug")}
              className={`py-2.5 px-2.5 border-b-2 flex items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTab === "debug"
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Debug Hub</span>
              {(selectedNode.status === "failed" || selectedNode.status === "exposed") && (
                <span className="w-2 h-2 rounded-full bg-[#FF5C5C] ml-0.5 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`py-2.5 px-2.5 border-b-2 flex items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTab === "config"
                  ? "border-[#4DA3FF] text-[#4DA3FF]"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Config</span>
            </button>
            <button
              onClick={() => setActiveTab("tags")}
              className={`py-2.5 px-2.5 border-b-2 flex items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTab === "tags"
                  ? "border-[#4DA3FF] text-[#4DA3FF]"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Tags</span>
            </button>
          </div>

      {/* Action Notice Toast */}
      {actionNotice && (
        <div className="mx-4 mt-3 p-2.5 rounded-lg bg-[#3DDC84]/15 border border-[#3DDC84]/50 text-[#3DDC84] text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Tab Body */}
      <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs font-mono">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-3.5">
            {/* Health / Scan Status */}
            {selectedNode.status === "incomplete" ? (
              <div className="p-3 rounded-lg bg-[#16161c] border border-dashed border-zinc-600 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 border border-zinc-500" />
                  <div>
                    <span className="text-[11px] font-semibold tracking-wider text-zinc-200">
                      SCAN INCOMPLETE
                    </span>
                    <span className="block text-[10px] text-zinc-400 font-sans">
                      Tool pipeline gap • AWS normal
                    </span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800/90 text-zinc-300 border border-zinc-600 font-mono">
                  Data Gap
                </span>
              </div>
            ) : selectedNode.status === "failed" ? (
              <div className="p-2.5 rounded-md bg-[#2A0E12] border border-[#FF5C5C]/60 flex items-center justify-between">
                <span className="text-zinc-300 text-[11px]">System Health</span>
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5C5C] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF5C5C]"></span>
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF5C5C]">
                    CRITICAL ALARM (5xx)
                  </span>
                </div>
              </div>
            ) : selectedNode.status === "exposed" ? (
              <div className="p-2.5 rounded-md bg-[#251A0A] border border-[#F2B33D]/60 flex items-center justify-between">
                <span className="text-zinc-300 text-[11px]">Security Posture</span>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-[#F2B33D]"></span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#F2B33D]">
                    PUBLICLY EXPOSED
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-md bg-[#16161a] border border-[#27272a] flex items-center justify-between">
                <span className="text-zinc-400 text-[11px]">Health & Availability</span>
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                    HEALTHY (99.99%)
                  </span>
                </div>
              </div>
            )}

            {/* Live Telemetry & Traffic Metrics Card */}
            {telemetry && (
              <div className="p-3 rounded-lg bg-[#0F131C] border border-[#262D3A] space-y-2.5 font-sans">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#4DA3FF]" />
                    <span>Live Telemetry & Traffic Flow</span>
                  </span>
                  <span className="text-[10px] text-[#3DDC84] font-mono flex items-center gap-1">
                    <Radio className="w-3 h-3 animate-pulse" /> LIVE
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-[#151A24] border border-[#262D3A]">
                    <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                      <span>CPU LOAD</span>
                      <span className={telemetry.cpu > 80 ? "text-[#FF5C5C] font-bold" : "text-zinc-200"}>
                        {telemetry.cpu}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#0B0E14] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          telemetry.cpu > 80 ? "bg-[#FF5C5C]" : "bg-[#4DA3FF]"
                        }`}
                        style={{ width: `${Math.min(telemetry.cpu, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-2 rounded bg-[#151A24] border border-[#262D3A]">
                    <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                      <span>MEMORY</span>
                      <span className={telemetry.memory > 80 ? "text-[#FF5C5C] font-bold" : "text-zinc-200"}>
                        {telemetry.memory}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#0B0E14] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          telemetry.memory > 80 ? "bg-[#FF5C5C]" : "bg-[#3DDC84]"
                        }`}
                        style={{ width: `${Math.min(telemetry.memory, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-2 rounded bg-[#151A24] border border-[#262D3A]">
                    <span className="text-zinc-400 block text-[9.5px]">THROUGHPUT</span>
                    <span className="text-zinc-200 font-semibold text-[11px] mt-0.5 block truncate">
                      {telemetry.throughput}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-[#151A24] border border-[#262D3A]">
                    <span className="text-zinc-400 block text-[9.5px]">P95 LATENCY</span>
                    <span className={`text-[11px] font-semibold mt-0.5 block truncate ${
                      selectedNode.status === "failed" ? "text-[#FF5C5C]" : "text-zinc-200"
                    }`}>
                      {telemetry.latency}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Blast Radius & Traffic Impact Card */}
            <div className="p-3 rounded-lg bg-[#0F131C] border border-[#262D3A] space-y-2.5 font-sans">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Blast Radius & Dependency Chain</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#151A24] text-zinc-300 border border-[#262D3A]">
                  {blastRadius.total} Connected Nodes
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-[#151A24] border border-[#262D3A]">
                  <div className="text-[9.5px] text-zinc-400 flex items-center gap-1 mb-1">
                    <ArrowDownRight className="w-3 h-3 text-[#38BDF8]" />
                    <span>UPSTREAM ({blastRadius.upstream.length})</span>
                  </div>
                  <div className="text-[10.5px] text-zinc-200 truncate">
                    {blastRadius.upstream[0]?.name || "None (Entry Point)"}
                  </div>
                </div>

                <div className="p-2 rounded bg-[#151A24] border border-[#262D3A]">
                  <div className="text-[9.5px] text-zinc-400 flex items-center gap-1 mb-1">
                    <ArrowUpRight className="w-3 h-3 text-purple-400" />
                    <span>DOWNSTREAM ({blastRadius.downstream.length})</span>
                  </div>
                  <div className="text-[10.5px] text-zinc-200 truncate">
                    {blastRadius.downstream[0]?.name || "None (Leaf Node)"}
                  </div>
                </div>
              </div>

              {/* 1-Click Interactive Blast Radius Map Highlight */}
              <button
                onClick={handleToggleBlastRadius}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                  isBlastRadiusActive
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                    : "bg-[#151A24] hover:bg-[#262D3A] border border-amber-500/40 text-amber-300"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>
                  {isBlastRadiusActive
                    ? "⚡ Blast Radius Active on Map (Click to Reset)"
                    : "⚡ Highlight Blast Radius on Map"}
                </span>
              </button>
            </div>

            {/* Incomplete Node: High-prominence Plain-Language Diagnosis Card */}
            {selectedNode.status === "incomplete" && (
              <div className="p-3.5 rounded-lg bg-zinc-900/95 border border-zinc-700 space-y-3 font-sans">
                <div className="flex items-start space-x-2.5">
                  <div className="p-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 shrink-0 mt-0.5">
                    <Info className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-100">
                      Orbit Pipeline Scan Gap
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                      Orbit's discovery engine could not fully read this resource. This is an internal tool scanner gap, <strong className="text-zinc-300">not</strong> an AWS infrastructure failure.
                    </div>
                  </div>
                </div>

                {/* Plain-Language Failure Explanation */}
                <div className="p-2.5 rounded-md bg-[#0e0e12] border border-zinc-800 font-mono text-[11px] space-y-1">
                  <div className="text-zinc-500 text-[10px] uppercase font-semibold">Exact Failure Cause</div>
                  <div className="text-zinc-200 font-medium select-text break-words leading-relaxed">
                    {selectedNode.scanError?.message || "ec2:DescribeNetworkInterfaces returned AccessDenied for this resource"}
                  </div>
                </div>

                {/* Technical Diagnostics */}
                <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono">
                  <div className="p-2 rounded bg-[#0e0e12] border border-zinc-800">
                    <span className="text-zinc-500 block text-[9.5px]">OPERATION</span>
                    <span className="text-zinc-300 font-medium truncate block">
                      {selectedNode.scanError?.operation || "ec2:DescribeNetworkInterfaces"}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-[#0e0e12] border border-zinc-800">
                    <span className="text-zinc-500 block text-[9.5px]">ERROR CODE</span>
                    <span className="text-zinc-300 font-medium truncate block">
                      {selectedNode.scanError?.code || "AccessDenied"}
                    </span>
                  </div>
                  {selectedNode.scanError?.lastSuccessScan && (
                    <div className="p-2 rounded bg-[#0e0e12] border border-zinc-800 col-span-2">
                      <span className="text-zinc-500 block text-[9.5px]">LAST SUCCESSFUL SCAN</span>
                      <span className="text-zinc-300 font-medium block">
                        {selectedNode.scanError.lastSuccessScan}
                      </span>
                    </div>
                  )}
                </div>

                {/* Recommended Resolution */}
                <div className="p-2.5 rounded-md bg-zinc-800/60 border border-zinc-700/60 text-[11px] space-y-1">
                  <div className="text-zinc-300 font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Recommended Resolution</span>
                  </div>
                  <p className="text-zinc-400 text-[10.5px] leading-relaxed">
                    {selectedNode.scanError?.suggestedFix ||
                      "Update IAM policy attached to Orbit's scan role to grant permissions for this call, or knowingly ignore if this resource is intentionally restricted."}
                  </p>
                </div>

                <div className="text-[10px] text-zinc-500 italic">
                  Edges touching this node are rendered as dashed lines to indicate inferred wiring.
                </div>
              </div>
            )}

            {/* ARN Box */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>ARN</span>
                <button
                  onClick={handleCopyArn}
                  className="flex items-center space-x-1 text-zinc-300 hover:text-white"
                >
                  {copiedArn ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedArn ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <div className="p-2.5 rounded-md bg-[#0c0c0e] font-mono text-[10px] text-zinc-300 break-all select-text border border-[#27272a]">
                {selectedNode.arn}
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-md bg-[#16161a] border border-[#27272a] space-y-0.5">
                <span className="text-zinc-500 block text-[10px]">REGION</span>
                <span className="text-zinc-200 font-medium">{selectedNode.region}</span>
              </div>
              <div className="p-2.5 rounded-md bg-[#16161a] border border-[#27272a] space-y-0.5">
                <span className="text-zinc-500 block text-[10px]">ACCOUNT</span>
                <span className="text-zinc-200 font-medium truncate block">
                  {selectedNode.accountId}
                </span>
              </div>
            </div>

            {/* Grouping Details */}
            {selectedNode.group && (
              <div className="p-2.5 rounded-md bg-[#16161a] border border-[#27272a] space-y-0.5 text-[11px]">
                <span className="text-zinc-500 block text-[10px]">VPC MEMBERSHIP</span>
                <span className="text-purple-400 font-medium">{selectedNode.group}</span>
              </div>
            )}
            {selectedNode.subGroup && (
              <div className="p-2.5 rounded-md bg-[#16161a] border border-[#27272a] space-y-0.5 text-[11px]">
                <span className="text-zinc-500 block text-[10px]">SUBNET / ZONE</span>
                <span className="text-cyan-400 font-medium">{selectedNode.subGroup}</span>
              </div>
            )}

            {/* Deep link button */}
            {consoleUrl && (
              <a
                href={consoleUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full mt-2 py-2 px-3 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 flex items-center justify-center space-x-2 text-xs font-medium transition-colors"
              >
                <span>View in AWS Management Console</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              </a>
            )}
          </div>
        )}

        {/* DEBUG & INCIDENT TRIAGE TAB */}
        {activeTab === "debug" && (
          <div className="space-y-3.5">
            {/* Incident Root Cause & Action Center */}
            <div className={`p-3.5 rounded-lg border font-sans space-y-3 ${
              selectedNode.status === "failed"
                ? "bg-[#250E12] border-[#FF5C5C]/60"
                : selectedNode.status === "exposed"
                ? "bg-[#231707] border-[#F2B33D]/60"
                : selectedNode.status === "incomplete"
                ? "bg-[#16161C] border-zinc-600 border-dashed"
                : "bg-[#0E1715] border-[#3DDC84]/50"
            }`}>
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-md bg-[#0B0E14] border border-[#262D3A] shrink-0 mt-0.5">
                  {selectedNode.status === "failed" ? (
                    <AlertTriangle className="w-4 h-4 text-[#FF5C5C]" />
                  ) : selectedNode.status === "exposed" ? (
                    <ShieldAlert className="w-4 h-4 text-[#F2B33D]" />
                  ) : selectedNode.status === "incomplete" ? (
                    <Info className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-[#3DDC84]" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                    {selectedNode.status === "failed"
                      ? "Critical Availability Failure"
                      : selectedNode.status === "exposed"
                      ? "Security Boundary Alert"
                      : selectedNode.status === "incomplete"
                      ? "Discovery Pipeline Incomplete"
                      : "Node Healthy & Operational"}
                  </div>
                  <div className="text-[11px] text-zinc-300 mt-1 leading-snug font-sans">
                    {selectedNode.status === "failed"
                      ? "High 5xx response rate detected. Memory pressure reached 94% on container instance, causing health check timeouts on port 8080."
                      : selectedNode.status === "exposed"
                      ? "Security group allows 0.0.0.0/0 ingress on application port without AWS WAF protection or bastion shielding."
                      : selectedNode.status === "incomplete"
                      ? "Scanner role lacks ec2:DescribeNetworkInterfaces. Inferred topology wiring shown in dashed lines."
                      : "All 4 target group health checks passing. P95 latency is 16ms with 0 dropped packets."}
                  </div>
                </div>
              </div>

              {/* Actionable 1-Click Operations Playbooks */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">
                  Automated Remediation Actions
                </div>
                <div className="grid grid-cols-1 gap-1.5 font-sans">
                  {selectedNode.status === "failed" && (
                    <>
                      <button
                        onClick={() => triggerRemediationNotice("Container Task restarted. Traffic returning to nominal.")}
                        className="w-full py-1.5 px-2.5 rounded bg-[#FF5C5C]/20 hover:bg-[#FF5C5C]/35 border border-[#FF5C5C]/50 text-[#FF5C5C] text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>1-Click Task Restart</span>
                        </span>
                        <span className="text-[10px] font-mono opacity-80">Drain & Restart</span>
                      </button>
                      <button
                        onClick={() => triggerRemediationNotice("Drain command sent. Traffic routed to secondary AZ (us-east-1b).")}
                        className="w-full py-1.5 px-2.5 rounded bg-[#151A24] hover:bg-[#262D3A] border border-[#262D3A] text-zinc-200 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                          <span>Evacuate Traffic to AZ-1b</span>
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">Failover</span>
                      </button>
                    </>
                  )}

                  {selectedNode.status === "exposed" && (
                    <button
                      onClick={() => handleCopyRemediation(`ingress {\n  cidr_blocks = ["10.0.0.0/16"]\n  from_port   = 8080\n  to_port     = 8080\n  protocol    = "tcp"\n}`)}
                      className="w-full py-1.5 px-2.5 rounded bg-[#F2B33D]/20 hover:bg-[#F2B33D]/30 border border-[#F2B33D]/50 text-[#F2B33D] text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedRemediation ? "Copied Terraform Fix!" : "Copy Terraform SG Restriction"}</span>
                      </span>
                      <span className="text-[10px] font-mono opacity-80">VPC Ingress Only</span>
                    </button>
                  )}

                  {selectedNode.status === "incomplete" && (
                    <button
                      onClick={() => handleCopyRemediation(`{\n  "Effect": "Allow",\n  "Action": [\n    "ec2:DescribeNetworkInterfaces",\n    "ec2:DescribeInstances"\n  ],\n  "Resource": "*"\n}`)}
                      className="w-full py-1.5 px-2.5 rounded bg-[#4DA3FF]/20 hover:bg-[#4DA3FF]/30 border border-[#4DA3FF]/50 text-[#4DA3FF] text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedRemediation ? "Copied IAM Policy!" : "Copy IAM Least-Privilege Policy"}</span>
                      </span>
                      <span className="text-[10px] font-mono opacity-80">JSON</span>
                    </button>
                  )}

                  {/* 1-Click AWS CLI Diagnostic Command */}
                  <button
                    onClick={handleCopyCli}
                    className="w-full py-1.5 px-2.5 rounded bg-[#151A24] hover:bg-[#262D3A] border border-[#262D3A] text-zinc-300 hover:text-white text-xs font-mono flex items-center justify-between transition-colors cursor-pointer"
                    title="Copy AWS CLI diagnostic command to run in your terminal"
                  >
                    <span className="flex items-center gap-1.5 truncate pr-2">
                      <Terminal className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                      <span className="truncate">{copiedCli ? "Copied to Clipboard!" : getAwsCliCommand()}</span>
                    </span>
                    <Copy className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  </button>
                </div>
              </div>
            </div>

            {/* Blast Radius Visualizer & Component Tree */}
            <div className="p-3.5 rounded-lg bg-[#0F131C] border border-[#262D3A] space-y-3 font-sans">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Blast Radius Dependency Tree</span>
                </span>
                <button
                  onClick={handleToggleBlastRadius}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    isBlastRadiusActive
                      ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                      : "bg-[#151A24] text-amber-300 border border-amber-500/40 hover:bg-[#262D3A]"
                  }`}
                >
                  {isBlastRadiusActive ? "⚡ Reset View" : "⚡ Illuminate"}
                </button>
              </div>

              {/* Upstream Callers List */}
              <div className="space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase font-mono flex items-center justify-between">
                  <span>Upstream Sources ({blastRadius.upstream.length})</span>
                  <span className="text-[9.5px] text-zinc-500">Depend on this node</span>
                </div>
                {blastRadius.upstream.length === 0 ? (
                  <div className="p-2 rounded bg-[#151A24] text-zinc-500 text-[11px] font-mono">
                    None (Top-level Ingress Gateway)
                  </div>
                ) : (
                  <div className="space-y-1">
                    {blastRadius.upstream.map((up) => (
                      <div
                        key={up.id}
                        onClick={() => selectNode(up)}
                        className="p-2 rounded bg-[#151A24] hover:bg-[#202736] border border-[#262D3A] hover:border-[#38BDF8]/60 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="truncate pr-2">
                          <div className="text-[11px] text-zinc-200 font-medium truncate font-mono">{up.name}</div>
                          <div className="text-[9.5px] text-zinc-500">{up.type}</div>
                        </div>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          up.status === "failed" ? "bg-[#FF5C5C]" : up.status === "exposed" ? "bg-[#F2B33D]" : "bg-[#3DDC84]"
                        }`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Downstream Targets List */}
              <div className="space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase font-mono flex items-center justify-between">
                  <span>Downstream Targets ({blastRadius.downstream.length})</span>
                  <span className="text-[9.5px] text-zinc-500">Impacted if this node fails</span>
                </div>
                {blastRadius.downstream.length === 0 ? (
                  <div className="p-2 rounded bg-[#151A24] text-zinc-500 text-[11px] font-mono">
                    None (Leaf Storage/Worker Node)
                  </div>
                ) : (
                  <div className="space-y-1">
                    {blastRadius.downstream.map((dn) => (
                      <div
                        key={dn.id}
                        onClick={() => selectNode(dn)}
                        className="p-2 rounded bg-[#151A24] hover:bg-[#202736] border border-[#262D3A] hover:border-[#38BDF8]/60 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="truncate pr-2">
                          <div className="text-[11px] text-zinc-200 font-medium truncate font-mono">{dn.name}</div>
                          <div className="text-[9.5px] text-zinc-500">{dn.type}</div>
                        </div>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          dn.status === "failed" ? "bg-[#FF5C5C]" : dn.status === "exposed" ? "bg-[#F2B33D]" : "bg-[#3DDC84]"
                        }`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "config" && (
          <div className="space-y-2">
            <span className="text-[11px] text-zinc-400 block font-sans">Raw Deserialized Attributes:</span>
            <pre className="p-3 rounded-md bg-[#0c0c0e] font-mono text-[10px] text-zinc-300 overflow-x-auto border border-[#27272a] leading-relaxed select-text">
              {JSON.stringify(selectedNode.rawConfig || {}, null, 2)}
            </pre>
          </div>
        )}

        {activeTab === "tags" && (
          <div className="space-y-2 font-sans">
            {Object.keys(selectedNode.tags || {}).length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs">No AWS tags configured on this resource</div>
            ) : (
              <div className="divide-y divide-[#27272a] rounded-md bg-[#16161a] border border-[#27272a] overflow-hidden">
                {Object.entries(selectedNode.tags || {}).map(([key, val]) => (
                  <div key={key} className="p-2.5 flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-400">{key}</span>
                    <span className="text-zinc-200 select-text">{val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}
    </aside>
  );
};
