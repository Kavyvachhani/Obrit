import React, { useEffect } from "react";
import { Navbar } from "./components/layout/Navbar.js";
import { Sidebar } from "./components/layout/Sidebar.js";
import { Graph3D } from "./components/graph/Graph3D.js";
import { Graph2D } from "./components/graph/Graph2D.js";
import { InspectorPanel } from "./components/inspector/InspectorPanel.js";
import { ConnectModal } from "./components/connect/ConnectModal.js";
import { FaultChecklistModal } from "./components/resilience/FaultChecklistModal.js";
import { EdgeTooltip } from "./components/graph/EdgeTooltip.js";
import { useGraphStore } from "./stores/graph-store.js";
import { useAccountStore } from "./stores/account-store.js";
import { fetchGraph } from "./lib/api.js";

import { DEFAULT_AWS_TOPOLOGY } from "./lib/architecture-data.js";

import { GraphErrorBoundary } from "./components/graph/GraphErrorBoundary.js";

export const App: React.FC = () => {
  const { viewMode, setViewMode, setGraphData, setLoading } = useGraphStore();
  const { activeAccountId, loadAccounts } = useAccountStore();

  // Load accounts on initial mount
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Load graph for active account if available
  useEffect(() => {
    if (!activeAccountId || activeAccountId === "demo") {
      setGraphData(DEFAULT_AWS_TOPOLOGY);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchGraph(activeAccountId);
        if (!cancelled && data && data.nodes && data.nodes.length > 0) {
          setGraphData(data);
        } else if (!cancelled) {
          setGraphData(DEFAULT_AWS_TOPOLOGY);
        }
      } catch {
        if (!cancelled) {
          setGraphData(DEFAULT_AWS_TOPOLOGY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeAccountId, setGraphData, setLoading]);

  return (
    <div className="relative w-screen h-screen bg-[#0B0E14] select-none overflow-hidden font-sans text-[#E6E9EF]">
      {/* Full-bleed 3D/2D Canvas */}
      <main className="absolute inset-0 w-full h-full overflow-hidden bg-[#0B0E14]">
        {viewMode === "3d" ? (
          <GraphErrorBoundary fallbackTo2D={() => setViewMode("2d")}>
            <Graph3D />
          </GraphErrorBoundary>
        ) : (
          <Graph2D />
        )}
      </main>

      {/* Floating Top Navigation Chrome (Wireframe Row 1 & Row 2) */}
      <Navbar />

      {/* Floating Collapsible Left Sidebar (Overlay) */}
      <Sidebar />

      {/* Floating Selected Resource Inspector (On click only) */}
      <InspectorPanel />

      {/* Floating Connection Hover / Click Tooltip */}
      <EdgeTooltip />

      {/* Floating Bottom-Left Legend matching wireframe */}
      <div className="absolute bottom-5 left-5 z-20 pointer-events-auto flex items-center gap-3 px-3 py-1.5 bg-[#151A24]/85 backdrop-blur-md border border-[#262D3A] rounded-lg shadow-xl text-xs font-sans">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#8893A6]">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3DDC84]" />
          <span className="text-[11px] text-[#E6E9EF]">healthy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F2B33D]" />
          <span className="text-[11px] text-[#E6E9EF]">exposed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5C5C]" />
          <span className="text-[11px] text-[#E6E9EF]">failed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-dashed border-[#8893A6] bg-[#8893A6]/20" />
          <span className="text-[11px] text-[#8893A6]">incomplete</span>
        </div>
      </div>

      {/* Connect AWS Account Modal */}
      <ConnectModal />

      {/* Fault Tolerance & Resilience Checklist Modal */}
      <FaultChecklistModal />
    </div>
  );
};

export default App;
