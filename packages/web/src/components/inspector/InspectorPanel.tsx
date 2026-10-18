import React, { useState } from "react";
import { useGraphStore } from "../../stores/graph-store.js";
import { buildConsoleLink, RESOURCE_TYPE_LABELS, RESOURCE_TYPE_COLORS } from "@orbit/core";
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
} from "lucide-react";

export const InspectorPanel: React.FC = () => {
  const { selectedNode, selectNode, toggleGrouping, isGrouped } = useGraphStore();
  const [copiedArn, setCopiedArn] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "config" | "tags">("overview");
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

  if (!selectedNode) return null;

  const isCluster = Boolean((selectedNode.rawConfig as any)?.isCluster);
  const clusterRaw = isCluster ? (selectedNode.rawConfig as any) : null;
  const clusterMembers = isCluster ? ((clusterRaw.allMembers || []) as typeof selectedNode[]) : [];

  const typeLabel = isCluster
    ? "FLEET CLUSTER"
    : (RESOURCE_TYPE_LABELS as Record<string, string>)[selectedNode.type] || selectedNode.type;
  const typeColor = isCluster
    ? "#38BDF8"
    : (RESOURCE_TYPE_COLORS as Record<string, string>)[selectedNode.type] || "#3b82f6";
  const consoleUrl = buildConsoleLink(
    selectedNode.type as any,
    selectedNode.region,
    selectedNode.id,
    selectedNode.arn
  );

  const handleCopyArn = () => {
    navigator.clipboard.writeText(selectedNode.arn);
    setCopiedArn(true);
    setTimeout(() => setCopiedArn(false), 2000);
  };

  const getTypeIcon = () => {
    if (isCluster) return <Layers className="w-4 h-4 text-[#38BDF8]" />;
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
          <div className="flex border-b border-[#27272a] px-4 bg-[#141418] text-xs font-medium">
            <button
              onClick={() => setActiveTab("overview")}
              className={`py-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
                activeTab === "overview"
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`py-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
                activeTab === "config"
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Config</span>
            </button>
            <button
              onClick={() => setActiveTab("tags")}
              className={`py-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
                activeTab === "tags"
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Tags ({Object.keys(selectedNode.tags || {}).length})</span>
            </button>
          </div>

      {/* Tab Body */}
      <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs font-mono">
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
            ) : (
              <div className="p-2.5 rounded-md bg-[#16161a] border border-[#27272a] flex items-center justify-between">
                <span className="text-zinc-400 text-[11px]">Status</span>
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                    {selectedNode.status || "AVAILABLE"}
                  </span>
                </div>
              </div>
            )}

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
