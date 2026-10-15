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
  ExternalLink,
  Zap,
} from "lucide-react";
import type { GraphNode } from "@orbit/core";

export const Sidebar: React.FC = () => {
  const { nodes, selectedNode, selectNode, setFilterCategory, filterCategory } = useGraphStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [activeTab, setActiveTab] = useState<"services" | "topology">("services");
  const [expandedSection, setExpandedSection] = useState<Record<string, boolean>>({
    compute: true,
    lambda: true,
    network: true,
    database: true,
    storage: true,
  });

  const toggleSection = (sec: string) => {
    setExpandedSection((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const vpcs = nodes.filter((n) => n.type === "vpc:vpc");
  const subnets = nodes.filter((n) => n.type === "vpc:subnet");
  const gateways = nodes.filter((n) => n.type.includes("gateway") || n.type.startsWith("elb:"));
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
          title="Expand Resource Panel"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-84 h-full bg-[#121215] border-r border-[#27272a] flex flex-col z-20 shrink-0 text-xs font-sans select-none">
      {/* Header */}
      <div className="h-10 px-3.5 border-b border-[#27272a] flex items-center justify-between bg-[#141418]">
        <div className="flex items-center space-x-2">
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-semibold text-zinc-200 uppercase tracking-wider text-[11px]">
            Cloud Infrastructure
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
            placeholder="Search resources, IPs, ARNs..."
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

      {/* Tabs */}
      <div className="flex border-b border-[#27272a] bg-[#141418] text-[11px] font-medium text-zinc-400">
        <button
          onClick={() => setActiveTab("services")}
          className={`flex-1 py-1.5 text-center border-b-2 transition-colors ${
            activeTab === "services" ? "border-amber-400 text-zinc-100 font-semibold" : "border-transparent hover:text-zinc-200"
          }`}
        >
          Services Inventory
        </button>
        <button
          onClick={() => setActiveTab("topology")}
          className={`flex-1 py-1.5 text-center border-b-2 transition-colors ${
            activeTab === "topology" ? "border-amber-400 text-zinc-100 font-semibold" : "border-transparent hover:text-zinc-200"
          }`}
        >
          VPC Hierarchy ({vpcs.length})
        </button>
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2.5 font-mono text-xs">
        {activeTab === "services" ? (
          <div className="space-y-2.5">
            {/* ─── 1. NETWORKING SECTION ───────────────────────────── */}
            <div className="rounded border border-[#27272a] bg-[#141418] overflow-hidden">
              <div
                onClick={() => {
                  toggleSection("network");
                  setFilterCategory("network");
                }}
                className="p-2 flex items-center justify-between cursor-pointer hover:bg-zinc-800/60 font-sans"
              >
                <div className="flex items-center space-x-2">
                  {expandedSection.network ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <Cloud className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-zinc-200 text-xs">Entire Networking</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.2 rounded font-mono">
                    {vpcs.length + subnets.length + gateways.length}
                  </span>
                </div>
              </div>

              {expandedSection.network && (
                <div className="p-2 bg-[#0c0c0e] border-t border-[#27272a] space-y-1.5">
                  {/* VPC list */}
                  {vpcs.map((vpc) => {
                    const isSelected = selectedNode?.id === vpc.id;
                    const vpcCidr = (vpc.rawConfig as any)?.CidrBlock || "10.0.0.0/16";
                    return (
                      <div
                        key={vpc.id}
                        onClick={() => selectNode(vpc)}
                        className={`p-2 rounded border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-zinc-800 border-purple-500 text-purple-300"
                            : "bg-[#141418] border-[#27272a] hover:bg-zinc-800/50 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between font-sans">
                          <span className="font-semibold text-xs">{vpc.name}</span>
                          <span className="text-[10px] font-mono text-purple-400">{vpcCidr}</span>
                        </div>
                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-zinc-700/60 text-[10px] space-y-1 text-zinc-400 font-mono">
                            <div>VPC ID: <span className="text-zinc-200">{vpc.id}</span></div>
                            <div>Region: <span className="text-zinc-200">{vpc.region}</span></div>
                            <div>Status: <span className="text-emerald-400">AVAILABLE</span></div>
                            <div>Subnets: <span className="text-cyan-400">{subnets.filter((s) => s.group === vpc.id).length} attached</span></div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Subnets list */}
                  <div className="pt-1 text-[10px] text-zinc-500 uppercase font-sans font-semibold">
                    Subnets & Gateways ({subnets.length + gateways.length})
                  </div>
                  {subnets.concat(gateways).filter(matchesFilter).map((item) => {
                    const isSelected = selectedNode?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => selectNode(item)}
                        className={`p-1.5 rounded flex items-center justify-between cursor-pointer text-[11px] ${
                          isSelected ? "bg-zinc-800 text-cyan-300 font-semibold" : "hover:bg-zinc-800/40 text-zinc-400"
                        }`}
                      >
                        <div className="flex items-center space-x-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                          <span className="truncate font-sans">{item.name}</span>
                        </div>
                        <span className="text-[9px] font-mono text-zinc-500">{item.type.split(":")[1]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── 2. LAMBDA SERVERLESS SECTION ───────────────────── */}
            <div className="rounded border border-[#27272a] bg-[#141418] overflow-hidden">
              <div
                onClick={() => {
                  toggleSection("lambda");
                  setFilterCategory("compute");
                }}
                className="p-2 flex items-center justify-between cursor-pointer hover:bg-zinc-800/60 font-sans"
              >
                <div className="flex items-center space-x-2">
                  {expandedSection.lambda ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <Cpu className="w-4 h-4 text-yellow-400" />
                  <span className="font-semibold text-zinc-200 text-xs">Lambda Functions</span>
                </div>
                <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.2 rounded font-mono">
                  {lambdas.length}
                </span>
              </div>

              {expandedSection.lambda && (
                <div className="p-2 bg-[#0c0c0e] border-t border-[#27272a] space-y-1.5">
                  {lambdas.filter(matchesFilter).map((fn) => {
                    const isSelected = selectedNode?.id === fn.id;
                    const runtime = (fn.rawConfig as any)?.Runtime || "nodejs20.x";
                    const memory = (fn.rawConfig as any)?.MemorySize || "512MB";
                    const timeout = (fn.rawConfig as any)?.Timeout || "30s";
                    const handler = (fn.rawConfig as any)?.Handler || "index.handler";

                    return (
                      <div
                        key={fn.id}
                        onClick={() => selectNode(fn)}
                        className={`p-2 rounded border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-zinc-800 border-yellow-500 text-yellow-300"
                            : "bg-[#141418] border-[#27272a] hover:bg-zinc-800/50 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between font-sans">
                          <span className="font-semibold text-xs flex items-center space-x-1">
                            <span className="text-yellow-400 font-bold">λ</span>
                            <span>{fn.name}</span>
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">{runtime}</span>
                        </div>

                        {/* Configurations shown directly */}
                        <div className="mt-1.5 pt-1.5 border-t border-zinc-800 text-[10px] grid grid-cols-2 gap-1 text-zinc-400 font-mono">
                          <div>Memory: <span className="text-zinc-200">{memory}</span></div>
                          <div>Timeout: <span className="text-zinc-200">{timeout}</span></div>
                          <div className="col-span-2 truncate">Handler: <span className="text-zinc-200">{handler}</span></div>
                          {fn.subGroup && (
                            <div className="col-span-2 truncate text-cyan-400">VPC Subnet: {fn.subGroup}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── 3. EC2 COMPUTE SECTION ─────────────────────────── */}
            <div className="rounded border border-[#27272a] bg-[#141418] overflow-hidden">
              <div
                onClick={() => {
                  toggleSection("compute");
                  setFilterCategory("compute");
                }}
                className="p-2 flex items-center justify-between cursor-pointer hover:bg-zinc-800/60 font-sans"
              >
                <div className="flex items-center space-x-2">
                  {expandedSection.compute ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <Server className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-zinc-200 text-xs">EC2 Instances</span>
                </div>
                <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.2 rounded font-mono">
                  {ec2s.length}
                </span>
              </div>

              {expandedSection.compute && (
                <div className="p-2 bg-[#0c0c0e] border-t border-[#27272a] space-y-1.5">
                  {ec2s.filter(matchesFilter).map((inst) => {
                    const isSelected = selectedNode?.id === inst.id;
                    const instType = (inst.rawConfig as any)?.InstanceType || "t3.medium";
                    const ip = (inst.rawConfig as any)?.PrivateIpAddress || "10.0.1.24";
                    const az = (inst.rawConfig as any)?.Placement?.AvailabilityZone || "us-east-1a";

                    return (
                      <div
                        key={inst.id}
                        onClick={() => selectNode(inst)}
                        className={`p-2 rounded border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-zinc-800 border-amber-500 text-amber-300"
                            : "bg-[#141418] border-[#27272a] hover:bg-zinc-800/50 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between font-sans">
                          <span className="font-semibold text-xs">{inst.name}</span>
                          <span className="text-[10px] font-mono text-emerald-400">running</span>
                        </div>
                        <div className="mt-1.5 pt-1.5 border-t border-zinc-800 text-[10px] grid grid-cols-2 gap-1 text-zinc-400 font-mono">
                          <div>Type: <span className="text-zinc-200">{instType}</span></div>
                          <div>IP: <span className="text-zinc-200">{ip}</span></div>
                          <div className="col-span-2 text-zinc-400">Zone: <span className="text-zinc-200">{az}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── 4. RDS DATABASES SECTION ───────────────────────── */}
            <div className="rounded border border-[#27272a] bg-[#141418] overflow-hidden">
              <div
                onClick={() => {
                  toggleSection("database");
                  setFilterCategory("database");
                }}
                className="p-2 flex items-center justify-between cursor-pointer hover:bg-zinc-800/60 font-sans"
              >
                <div className="flex items-center space-x-2">
                  {expandedSection.database ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <Database className="w-4 h-4 text-sky-400" />
                  <span className="font-semibold text-zinc-200 text-xs">RDS Databases</span>
                </div>
                <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.2 rounded font-mono">
                  {rdsList.length}
                </span>
              </div>

              {expandedSection.database && (
                <div className="p-2 bg-[#0c0c0e] border-t border-[#27272a] space-y-1.5">
                  {rdsList.filter(matchesFilter).map((db) => {
                    const isSelected = selectedNode?.id === db.id;
                    const engine = (db.rawConfig as any)?.Engine || "postgres (15.3)";
                    const dbClass = (db.rawConfig as any)?.DBInstanceClass || "db.r6g.4xlarge";

                    return (
                      <div
                        key={db.id}
                        onClick={() => selectNode(db)}
                        className={`p-2 rounded border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-zinc-800 border-sky-500 text-sky-300"
                            : "bg-[#141418] border-[#27272a] hover:bg-zinc-800/50 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between font-sans">
                          <span className="font-semibold text-xs">{db.name}</span>
                          <span className="text-[10px] font-mono text-emerald-400">AVAILABLE</span>
                        </div>
                        <div className="mt-1.5 pt-1.5 border-t border-zinc-800 text-[10px] space-y-0.5 text-zinc-400 font-mono">
                          <div>Engine: <span className="text-zinc-200">{engine}</span></div>
                          <div>Class: <span className="text-zinc-200">{dbClass}</span></div>
                          <div>Deployment: <span className="text-cyan-400">Multi-AZ (Writer + Reader)</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── 5. S3 STORAGE SECTION ──────────────────────────── */}
            <div className="rounded border border-[#27272a] bg-[#141418] overflow-hidden">
              <div
                onClick={() => {
                  toggleSection("storage");
                  setFilterCategory("storage");
                }}
                className="p-2 flex items-center justify-between cursor-pointer hover:bg-zinc-800/60 font-sans"
              >
                <div className="flex items-center space-x-2">
                  {expandedSection.storage ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-zinc-200 text-xs">S3 Storage Buckets</span>
                </div>
                <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.2 rounded font-mono">
                  {s3List.length}
                </span>
              </div>

              {expandedSection.storage && (
                <div className="p-2 bg-[#0c0c0e] border-t border-[#27272a] space-y-1.5">
                  {s3List.filter(matchesFilter).map((s3) => {
                    const isSelected = selectedNode?.id === s3.id;
                    return (
                      <div
                        key={s3.id}
                        onClick={() => selectNode(s3)}
                        className={`p-2 rounded border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-zinc-800 border-emerald-500 text-emerald-300"
                            : "bg-[#141418] border-[#27272a] hover:bg-zinc-800/50 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between font-sans">
                          <span className="font-semibold text-xs">{s3.name}</span>
                          <span className="text-[10px] font-mono text-zinc-400">{s3.region}</span>
                        </div>
                        {isSelected && (
                          <div className="mt-1.5 pt-1.5 border-t border-zinc-800 text-[10px] space-y-0.5 text-zinc-400 font-mono">
                            <div>Encryption: <span className="text-emerald-400">AES-256 (SSE-S3)</span></div>
                            <div>Versioning: <span className="text-zinc-200">Enabled</span></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Topology Tree View */
          <div className="space-y-2">
            {vpcs.map((vpc) => {
              const vpcSubnets = subnets.filter((s) => s.group === vpc.id);
              return (
                <div key={vpc.id} className="rounded border border-[#27272a] bg-[#141418] p-2 space-y-1.5">
                  <div
                    onClick={() => selectNode(vpc)}
                    className="flex items-center justify-between cursor-pointer font-sans font-semibold text-purple-300"
                  >
                    <span className="flex items-center space-x-1.5">
                      <Cloud className="w-4 h-4 text-purple-400" />
                      <span>{vpc.name}</span>
                    </span>
                    <span className="text-[10px] text-zinc-500">{vpcSubnets.length} subnets</span>
                  </div>

                  <div className="pl-3 space-y-1 border-l border-zinc-800">
                    {vpcSubnets.map((sub) => {
                      const subRes = nodes.filter((n) => n.subGroup === sub.id);
                      return (
                        <div key={sub.id} className="space-y-0.5">
                          <div
                            onClick={() => selectNode(sub)}
                            className="p-1 rounded hover:bg-zinc-800 cursor-pointer flex items-center justify-between text-cyan-300 text-[11px]"
                          >
                            <span>{sub.name}</span>
                            <span className="text-[9px] text-zinc-500">{subRes.length} items</span>
                          </div>
                          <div className="pl-3 space-y-0.5 border-l border-zinc-800/80">
                            {subRes.map((r) => (
                              <div
                                key={r.id}
                                onClick={() => selectNode(r)}
                                className="px-1.5 py-0.5 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 text-[10px] flex items-center justify-between"
                              >
                                <span className="truncate">{r.name}</span>
                                <span className="text-[9px] text-zinc-500 uppercase">{r.type.split(":")[1]}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
