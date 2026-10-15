import React from "react";
import { useGraphStore } from "../../stores/graph-store.js";
import { Cloud, Server, Cpu, Database, HardDrive, Compass } from "lucide-react";

export const StatusBar: React.FC = () => {
  const { nodes, links, viewMode } = useGraphStore();

  return (
    <footer className="h-8 px-4 bg-[#101013] border-t border-[#27272a] flex items-center justify-between z-20 text-[11px] text-zinc-400 shrink-0 font-mono">
      {/* Left: Mode and Node Counts */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-zinc-300 font-semibold uppercase tracking-wider text-[10px]">
            {viewMode.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center space-x-3 border-l border-[#27272a] pl-3 text-zinc-400">
          <span>
            Nodes: <strong className="text-zinc-100">{nodes.length}</strong>
          </span>
          <span>
            Edges: <strong className="text-zinc-100">{links.length}</strong>
          </span>
          <span>
            Region: <strong className="text-zinc-200">us-east-1</strong>
          </span>
        </div>
      </div>

      {/* Center: Visual Legend */}
      <div className="hidden lg:flex items-center space-x-4 text-[10px]">
        <span className="flex items-center space-x-1 text-purple-400">
          <Cloud className="w-3 h-3" />
          <span>VPC</span>
        </span>
        <span className="flex items-center space-x-1 text-amber-500">
          <Server className="w-3 h-3" />
          <span>EC2</span>
        </span>
        <span className="flex items-center space-x-1 text-yellow-400">
          <Cpu className="w-3 h-3" />
          <span>Lambda</span>
        </span>
        <span className="flex items-center space-x-1 text-blue-400">
          <Database className="w-3 h-3" />
          <span>RDS</span>
        </span>
        <span className="flex items-center space-x-1 text-emerald-400">
          <HardDrive className="w-3 h-3" />
          <span>S3</span>
        </span>
      </div>

      {/* Right: Controls Hint */}
      <div className="flex items-center space-x-2 text-zinc-500 text-[10px]">
        <Compass className="w-3 h-3 text-zinc-400" />
        <span>Drag: Rotate • Scroll: Zoom • Click: Inspect Node</span>
      </div>
    </footer>
  );
};
