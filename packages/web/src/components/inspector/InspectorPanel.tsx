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
  const typeColor = (RESOURCE_TYPE_COLORS as Record<string, string>)[selectedNode.type] || "#38bdf8";
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
    if (selectedNode.type.startsWith("vpc:")) return <Cloud className="w-5 h-5" style={{ color: typeColor }} />;
    if (selectedNode.type.startsWith("ec2:")) return <Server className="w-5 h-5" style={{ color: typeColor }} />;
    if (selectedNode.type.startsWith("lambda:")) return <Cpu className="w-5 h-5" style={{ color: typeColor }} />;
    if (selectedNode.type.startsWith("rds:")) return <Database className="w-5 h-5" style={{ color: typeColor }} />;
    if (selectedNode.type.startsWith("s3:")) return <FolderGit2 className="w-5 h-5" style={{ color: typeColor }} />;
    return <Layers className="w-5 h-5" style={{ color: typeColor }} />;
  };

  return (
    <aside className="absolute top-20 right-6 bottom-6 w-96 max-w-[calc(100vw-3rem)] glass-panel rounded-2xl flex flex-col z-30 shadow-2xl border border-sky-500/20 animate-in slide-in-from-right duration-300 overflow-hidden">
      {/* Panel Header */}
      <div className="p-5 border-b border-white/10 flex items-start justify-between bg-slate-950/40">
        <div className="flex items-start space-x-3 pr-2 overflow-hidden">
          <div className="p-2 rounded-xl bg-slate-800/80 border border-white/10 shrink-0 mt-0.5">
            {getTypeIcon()}
          </div>
          <div className="overflow-hidden">
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium inline-block mb-1 border"
              style={{
                backgroundColor: `${typeColor}20`,
                borderColor: `${typeColor}60`,
                color: typeColor,
              }}
            >
              {typeLabel}
            </span>
            <h3 className="text-base font-semibold text-white truncate" title={selectedNode.name}>
              {selectedNode.name}
            </h3>
          </div>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Close Inspector"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 px-5 bg-slate-950/20 text-xs font-medium">
        <button
          onClick={() => setActiveTab("overview")}
          className={`py-3 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === "overview"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>
        <button
          onClick={() => setActiveTab("config")}
          className={`py-3 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === "config"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>Raw Config</span>
        </button>
        <button
          onClick={() => setActiveTab("tags")}
          className={`py-3 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
            activeTab === "tags"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Tags ({Object.keys(selectedNode.tags || {}).length})</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="p-5 overflow-y-auto flex-1 space-y-5 text-sm">
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Health Status */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
              <span className="text-xs text-slate-400">Health Status</span>
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  {selectedNode.status || "Healthy"}
                </span>
              </div>
            </div>

            {/* ARN Box */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 flex items-center justify-between">
                <span>Amazon Resource Name (ARN)</span>
                <button
                  onClick={handleCopyArn}
                  className="flex items-center space-x-1 text-sky-400 hover:text-sky-300 text-[11px]"
                >
                  {copiedArn ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedArn ? "Copied" : "Copy"}</span>
                </button>
              </label>
              <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 break-all select-text border border-white/5">
                {selectedNode.arn}
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 block">Region</span>
                <span className="font-mono text-xs text-white font-medium">{selectedNode.region}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 block">Account</span>
                <span className="font-mono text-xs text-white font-medium truncate block">
                  {selectedNode.accountId}
                </span>
              </div>
            </div>

            {/* Grouping Details */}
            {selectedNode.group && (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 block">Parent VPC Enclosure</span>
                <span className="font-mono text-xs text-sky-400 font-medium">{selectedNode.group}</span>
              </div>
            )}
            {selectedNode.subGroup && (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 block">Subnet / Availability Zone</span>
                <span className="font-mono text-xs text-emerald-400 font-medium">{selectedNode.subGroup}</span>
              </div>
            )}

            {/* Deep link button */}
            {consoleUrl && (
              <a
                href={consoleUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 hover:text-white flex items-center justify-center space-x-2 text-xs font-semibold transition-all shadow-glow"
              >
                <span>Open in AWS Console</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {activeTab === "config" && (
          <div className="space-y-2">
            <span className="text-xs text-slate-400 block">Decoded AWS Configuration:</span>
            <pre className="p-3 rounded-xl bg-slate-950 font-mono text-[11px] text-sky-300/90 overflow-x-auto border border-white/5 leading-relaxed select-text">
              {JSON.stringify(selectedNode.rawConfig || {}, null, 2)}
            </pre>
          </div>
        )}

        {activeTab === "tags" && (
          <div className="space-y-3">
            {Object.keys(selectedNode.tags || {}).length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">No AWS tags assigned to this resource</div>
            ) : (
              <div className="divide-y divide-white/5 rounded-xl bg-slate-900/60 border border-white/5 overflow-hidden">
                {Object.entries(selectedNode.tags || {}).map(([key, val]) => (
                  <div key={key} className="p-3 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-400 font-medium">{key}</span>
                    <span className="font-mono text-slate-200 select-text">{val}</span>
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
