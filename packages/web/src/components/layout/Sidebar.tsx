import React, { useState } from "react";
import { useGraphStore } from "../../stores/graph-store.js";
import {
  Cloud,
  Server,
  Cpu,
  Database,
  HardDrive,
  Shield,
  ChevronRight,
  ChevronDown,
  Layers,
  Search,
  PanelLeftClose,
  PanelLeft,
  CheckCircle2,
  ListFilter,
} from "lucide-react";
import type { GraphNode } from "@orbit/core";

export const Sidebar: React.FC = () => {
  const { nodes, selectedNode, selectNode } = useGraphStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [activeTab, setActiveTab] = useState<"hierarchy" | "services">("hierarchy");
  const [expandedVpcs, setExpandedVpcs] = useState<Record<string, boolean>>({
    "vpc-0a8b9c1d2e3f4001": true,
  });

  const toggleVpc = (vpcId: string) => {
    setExpandedVpcs((prev) => ({ ...prev, [vpcId]: !prev[vpcId] }));
  };

  const vpcs = nodes.filter((n) => n.type === "vpc:vpc");
  const subnets = nodes.filter((n) => n.type === "vpc:subnet");
  const ec2s = nodes.filter((n) => n.type.startsWith("ec2:instance"));
  const lambdas = nodes.filter((n) => n.type.startsWith("lambda:"));
  const rdsList = nodes.filter((n) => n.type.startsWith("rds:"));
  const s3List = nodes.filter((n) => n.type.startsWith("s3:"));
  const sgs = nodes.filter((n) => n.type.startsWith("ec2:security-group"));

  const matchesFilter = (n: GraphNode) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return (
      n.name.toLowerCase().includes(q) ||
      n.id.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q) ||
      n.arn.toLowerCase().includes(q)
    );
  };

  if (isCollapsed) {
    return (
      <div className="absolute top-16 left-3 z-20">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded-md bg-[#121215] border border-[#27272a] text-zinc-400 hover:text-white shadow-sm"
          title="Expand Resource Hierarchy"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-80 h-full bg-[#121215] border-r border-[#27272a] flex flex-col z-20 shrink-0 text-xs font-sans select-none">
      {/* Header */}
      <div className="h-10 px-3.5 border-b border-[#27272a] flex items-center justify-between bg-[#141418]">
        <div className="flex items-center space-x-2">
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-semibold text-zinc-200 uppercase tracking-wider text-[11px]">
            AWS Resources
          </span>
          <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 text-[10px] font-mono">
            {nodes.length}
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          title="Collapse Panel"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2.5 border-b border-[#27272a] bg-[#121215]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter by name, ID, or type..."
            className="w-full bg-[#18181b] border border-[#27272a] rounded px-8 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
          />
          {filterText && (
            <button
              onClick={() => setFilterText("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tabs: Hierarchy vs By Service */}
      <div className="flex border-b border-[#27272a] bg-[#141418] text-[11px] font-medium text-zinc-400">
        <button
          onClick={() => setActiveTab("hierarchy")}
          className={`flex-1 py-1.5 text-center border-b-2 transition-colors ${
            activeTab === "hierarchy" ? "border-amber-400 text-zinc-100 font-semibold" : "border-transparent hover:text-zinc-200"
          }`}
        >
          Topology Tree
        </button>
        <button
          onClick={() => setActiveTab("services")}
          className={`flex-1 py-1.5 text-center border-b-2 transition-colors ${
            activeTab === "services" ? "border-amber-400 text-zinc-100 font-semibold" : "border-transparent hover:text-zinc-200"
          }`}
        >
          By Service ({vpcs.length + ec2s.length + lambdas.length + rdsList.length + s3List.length})
        </button>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
        {activeTab === "hierarchy" ? (
          <div className="space-y-2">
            {/* VPC Enclosures */}
            {vpcs.map((vpc) => {
              const isExpanded = expandedVpcs[vpc.id] ?? true;
              const isSelected = selectedNode?.id === vpc.id;
              const vpcSubnets = subnets.filter((s) => s.group === vpc.id);

              return (
                <div key={vpc.id} className="rounded border border-[#27272a] bg-[#141418] overflow-hidden">
                  {/* VPC Row */}
                  <div
                    onClick={() => selectNode(vpc)}
                    className={`p-2 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-zinc-800 border-l-2 border-purple-400 text-zinc-100 font-semibold"
                        : "hover:bg-zinc-800/60 text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 truncate">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVpc(vpc.id);
                        }}
                        className="p-0.5 text-zinc-500 hover:text-zinc-300"
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                      <Cloud className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate font-sans font-medium">{vpc.name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">{vpcSubnets.length} subnets</span>
                  </div>

                  {/* Subnets under this VPC */}
                  {isExpanded && (
                    <div className="pl-3 pr-1.5 py-1 space-y-1 bg-[#0f0f12] border-t border-[#27272a]">
                      {vpcSubnets.map((sub) => {
                        const isSubSelected = selectedNode?.id === sub.id;
                        const subResources = nodes.filter(
                          (n) => n.subGroup === sub.id || (n.rawConfig && (n.rawConfig as any).SubnetId === sub.id)
                        );

                        return (
                          <div key={sub.id} className="space-y-0.5">
                            {/* Subnet row */}
                            <div
                              onClick={() => selectNode(sub)}
                              className={`p-1.5 rounded flex items-center justify-between cursor-pointer transition-colors ${
                                isSubSelected
                                  ? "bg-zinc-800 text-cyan-300 font-semibold"
                                  : "hover:bg-zinc-800/40 text-zinc-400"
                              }`}
                            >
                              <div className="flex items-center space-x-1.5 truncate">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                                <span className="truncate text-[11px] font-sans">{sub.name}</span>
                              </div>
                              <span className="text-[10px] text-zinc-500">{subResources.length} res</span>
                            </div>

                            {/* Contained resources */}
                            {subResources.length > 0 && (
                              <div className="pl-3 space-y-0.5 border-l border-zinc-800 ml-2">
                                {subResources.map((res) => {
                                  const isResSelected = selectedNode?.id === res.id;
                                  return (
                                    <div
                                      key={res.id}
                                      onClick={() => selectNode(res)}
                                      className={`px-2 py-1 rounded flex items-center justify-between cursor-pointer text-[11px] transition-colors ${
                                        isResSelected
                                          ? "bg-zinc-800 text-amber-300 font-semibold"
                                          : "hover:bg-zinc-800/50 text-zinc-300"
                                      }`}
                                    >
                                      <div className="flex items-center space-x-1.5 truncate">
                                        {res.type.startsWith("ec2:") && (
                                          <Server className="w-3 h-3 text-amber-500 shrink-0" />
                                        )}
                                        {res.type.startsWith("lambda:") && (
                                          <Cpu className="w-3 h-3 text-yellow-400 shrink-0" />
                                        )}
                                        {res.type.startsWith("rds:") && (
                                          <Database className="w-3 h-3 text-sky-400 shrink-0" />
                                        )}
                                        <span className="truncate font-sans">{res.name}</span>
                                      </div>
                                      <span className="text-[9px] text-zinc-500 uppercase">{res.type.split(":")[1]}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Global S3 Buckets */}
            {s3List.length > 0 && (
              <div className="rounded border border-[#27272a] bg-[#141418] p-2 space-y-1">
                <div className="flex items-center justify-between text-zinc-400 text-[11px] font-sans font-medium pb-1 border-b border-zinc-800">
                  <span className="flex items-center space-x-1.5 text-emerald-400">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>S3 Storage ({s3List.length})</span>
                  </span>
                </div>
                {s3List.map((s3) => (
                  <div
                    key={s3.id}
                    onClick={() => selectNode(s3)}
                    className={`px-2 py-1 rounded flex items-center justify-between cursor-pointer text-[11px] transition-colors ${
                      selectedNode?.id === s3.id ? "bg-zinc-800 text-emerald-300 font-semibold" : "hover:bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    <span className="truncate font-sans">{s3.name}</span>
                    <span className="text-[9px] text-zinc-500">bucket</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Service Categories List */
          <div className="space-y-3 font-sans">
            {/* EC2 Instances */}
            <div>
              <div className="flex items-center justify-between text-zinc-400 text-[11px] font-medium pb-1 mb-1 border-b border-zinc-800">
                <span className="flex items-center space-x-1.5 text-amber-500">
                  <Server className="w-3.5 h-3.5" />
                  <span>EC2 Compute</span>
                </span>
                <span className="text-zinc-500 font-mono text-[10px]">{ec2s.length}</span>
              </div>
              <div className="space-y-0.5">
                {ec2s.filter(matchesFilter).map((res) => (
                  <div
                    key={res.id}
                    onClick={() => selectNode(res)}
                    className={`px-2 py-1.5 rounded flex items-center justify-between cursor-pointer text-[11px] transition-colors ${
                      selectedNode?.id === res.id ? "bg-zinc-800 text-amber-300 font-semibold" : "hover:bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    <span className="truncate">{res.name}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{res.status || "running"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Lambda Functions */}
            <div>
              <div className="flex items-center justify-between text-zinc-400 text-[11px] font-medium pb-1 mb-1 border-b border-zinc-800">
                <span className="flex items-center space-x-1.5 text-yellow-400">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Lambda Serverless</span>
                </span>
                <span className="text-zinc-500 font-mono text-[10px]">{lambdas.length}</span>
              </div>
              <div className="space-y-0.5">
                {lambdas.filter(matchesFilter).map((res) => (
                  <div
                    key={res.id}
                    onClick={() => selectNode(res)}
                    className={`px-2 py-1.5 rounded flex items-center justify-between cursor-pointer text-[11px] transition-colors ${
                      selectedNode?.id === res.id ? "bg-zinc-800 text-yellow-300 font-semibold" : "hover:bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    <span className="truncate">{res.name}</span>
                    <span className="text-[10px] font-mono text-zinc-500">active</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Databases */}
            <div>
              <div className="flex items-center justify-between text-zinc-400 text-[11px] font-medium pb-1 mb-1 border-b border-zinc-800">
                <span className="flex items-center space-x-1.5 text-sky-400">
                  <Database className="w-3.5 h-3.5" />
                  <span>RDS Databases</span>
                </span>
                <span className="text-zinc-500 font-mono text-[10px]">{rdsList.length}</span>
              </div>
              <div className="space-y-0.5">
                {rdsList.filter(matchesFilter).map((res) => (
                  <div
                    key={res.id}
                    onClick={() => selectNode(res)}
                    className={`px-2 py-1.5 rounded flex items-center justify-between cursor-pointer text-[11px] transition-colors ${
                      selectedNode?.id === res.id ? "bg-zinc-800 text-sky-300 font-semibold" : "hover:bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    <span className="truncate">{res.name}</span>
                    <span className="text-[10px] font-mono text-zinc-500">available</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
