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
  const { selectedNode, selectNode } = useGraphStore();
  const [copiedArn, setCopiedArn] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "config" | "tags">("overview");

  if (!selectedNode) return null;

  const typeLabel = (RESOURCE_TYPE_LABELS as Record<string, string>)[selectedNode.type] || selectedNode.type;
  const typeColor = (RESOURCE_TYPE_COLORS as Record<string, string>)[selectedNode.type] || "#3b82f6";
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
    if (selectedNode.type.startsWith("vpc:")) return <Cloud className="w-4 h-4 text-purple-400" />;
    if (selectedNode.type.startsWith("ec2:")) return <Server className="w-4 h-4 text-amber-500" />;
    if (selectedNode.type.startsWith("lambda:")) return <Cpu className="w-4 h-4 text-yellow-400" />;
    if (selectedNode.type.startsWith("rds:")) return <Database className="w-4 h-4 text-blue-400" />;
    if (selectedNode.type.startsWith("s3:")) return <FolderGit2 className="w-4 h-4 text-emerald-400" />;
    return <Layers className="w-4 h-4 text-zinc-400" />;
  };

  return (
    <aside className="absolute top-4 right-4 bottom-4 w-96 max-w-[calc(100vw-2rem)] bg-[#101013] rounded-lg border border-[#27272a] flex flex-col z-30 shadow-xl overflow-hidden font-sans">
      {/* Panel Header */}
      <div className="p-4 border-b border-[#27272a] flex items-start justify-between bg-[#141418]">
        <div className="flex items-start space-x-3 pr-2 overflow-hidden">
          <div className="p-2 rounded-md bg-[#1e1e24] border border-[#2e2e38] shrink-0 mt-0.5">
            {getTypeIcon()}
          </div>
          <div className="overflow-hidden">
            <span
              className="text-[10px] px-2 py-0.5 rounded font-mono font-medium inline-block mb-1 border"
              style={{
                backgroundColor: `${typeColor}15`,
                borderColor: `${typeColor}40`,
                color: typeColor,
              }}
            >
              {typeLabel}
            </span>
            <h3 className="text-sm font-semibold text-zinc-100 truncate" title={selectedNode.name}>
              {selectedNode.name}
            </h3>
          </div>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
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
            {/* Health Status */}
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
    </aside>
  );
};
