import React from "react";
import { useGraphStore } from "../../stores/graph-store.js";
import { Cloud, Server, Cpu, Database, HardDrive, Compass, Activity } from "lucide-react";

export const StatusBar: React.FC = () => {
  const { nodes, links, viewMode } = useGraphStore();

  return (
    <footer className="h-10 px-6 glass-panel border-t border-sky-500/20 flex items-center justify-between z-20 text-[11px] text-slate-400 shrink-0">
      {/* Left: Counts & Region */}
      <div className="flex items-center space-x-5">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span className="font-mono text-slate-300 font-semibold tracking-wider uppercase">
            Live {viewMode.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center space-x-4 border-l border-white/10 pl-4 font-mono">
          <span>
            Nodes: <strong className="text-white">{nodes.length}</strong>
          </span>
          <span>
            Edges: <strong className="text-white">{links.length}</strong>
          </span>
          <span>
            Region: <strong className="text-sky-400">us-east-1</strong>
          </span>
        </div>
      </div>

      {/* Center: Visual Legend */}
      <div className="hidden md:flex items-center space-x-4">
        <span className="flex items-center space-x-1.5 text-sky-400">
          <Cloud className="w-3.5 h-3.5" />
          <span>VPC Cloud</span>
        </span>
        <span className="flex items-center space-x-1.5 text-blue-400">
          <Server className="w-3.5 h-3.5" />
          <span>EC2 Server</span>
        </span>
        <span className="flex items-center space-x-1.5 text-amber-400">
          <Cpu className="w-3.5 h-3.5" />
          <span>Lambda Chip</span>
        </span>
        <span className="flex items-center space-x-1.5 text-purple-400">
          <Database className="w-3.5 h-3.5" />
          <span>RDS Cylinder</span>
        </span>
        <span className="flex items-center space-x-1.5 text-emerald-400">
          <HardDrive className="w-3.5 h-3.5" />
          <span>S3 Canister</span>
        </span>
      </div>

      {/* Right: Controls Hint */}
      <div className="flex items-center space-x-3 text-slate-400">
        <Compass className="w-3.5 h-3.5 text-sky-400" />
        <span>Left-click drag: Rotate • Scroll: Zoom • Click: Inspect</span>
      </div>
    </footer>
  );
};
