import React from "react";
import { useGraphStore } from "../../stores/graph-store.js";
import { ArrowRight, AlertTriangle, CheckCircle2, Zap } from "lucide-react";

export const EdgeTooltip: React.FC = () => {
  const { edgeTooltip } = useGraphStore();

  if (!edgeTooltip) return null;

  // Format relationship e.g. "routes-to" -> "routes_to"
  const formattedRelation = edgeTooltip.relation.replace(/-/g, "_");

  // Keep tooltip on screen
  const left = Math.min(Math.max(edgeTooltip.x + 16, 20), window.innerWidth - 380);
  const top = Math.min(Math.max(edgeTooltip.y - 40, 70), window.innerHeight - 160);

  return (
    <div
      style={{ left: `${left}px`, top: `${top}px` }}
      className="fixed z-50 pointer-events-none transition-all duration-75 ease-out select-none animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="w-[340px] rounded-xl bg-[#0e0e14]/95 backdrop-blur-md border border-zinc-700/80 p-3 shadow-2xl text-xs font-sans">
        {/* Endpoints header */}
        <div className="flex items-center space-x-2 text-zinc-100 font-semibold mb-1.5">
          <span className="truncate max-w-[130px] text-zinc-200" title={edgeTooltip.sourceName}>
            {edgeTooltip.sourceName}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="truncate max-w-[130px] text-zinc-200" title={edgeTooltip.targetName}>
            {edgeTooltip.targetName}
          </span>
        </div>

        {/* Relationship type badge */}
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-800">
          <div className="flex items-center space-x-1.5">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-[11px] font-mono text-amber-400 font-medium">
              ({formattedRelation})
            </span>
          </div>

          {edgeTooltip.isInferred ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800/90 text-zinc-300 border border-zinc-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
              Inferred
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Verified
            </span>
          )}
        </div>

        {/* Verification / Scan Gap Notice */}
        {edgeTooltip.isInferred ? (
          <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-700/80 space-y-1">
            <div className="flex items-center space-x-1.5 text-zinc-300 font-medium text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>Unverified Connection (Scan Gap)</span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
              {edgeTooltip.unverifiedReason ||
                "Orbit discovery pipeline encountered a tool-side scan gap on one of these endpoints. This connection is inferred from routing rules rather than confirmed ENI state."}
            </p>
          </div>
        ) : (
          <div className="text-[10.5px] text-zinc-400 flex items-center justify-between">
            <span>Direct confirmed relationship</span>
            <span className="text-[10px] text-zinc-500 font-mono">100% certainty</span>
          </div>
        )}
      </div>
    </div>
  );
};
