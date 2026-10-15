import React, { useEffect } from "react";
import { Navbar } from "./components/layout/Navbar.js";
import { Sidebar } from "./components/layout/Sidebar.js";
import { StatusBar } from "./components/layout/StatusBar.js";
import { Graph3D } from "./components/graph/Graph3D.js";
import { Graph2D } from "./components/graph/Graph2D.js";
import { InspectorPanel } from "./components/inspector/InspectorPanel.js";
import { ConnectModal } from "./components/connect/ConnectModal.js";
import { useGraphStore } from "./stores/graph-store.js";
import { useAccountStore } from "./stores/account-store.js";
import { fetchGraph } from "./lib/api.js";

export const App: React.FC = () => {
  const { viewMode, setGraphData, setLoading } = useGraphStore();
  const { activeAccountId, loadAccounts } = useAccountStore();

  // Load accounts on initial mount
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Load graph for active account if available
  useEffect(() => {
    if (!activeAccountId) return;

    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchGraph(activeAccountId);
        if (!cancelled && data && data.nodes && data.nodes.length > 0) {
          setGraphData(data);
        }
      } catch {
        // Fall back gracefully to active architecture topology
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
    <div className="relative w-screen h-screen flex flex-col bg-[#09090b] select-none overflow-hidden font-sans text-zinc-100">
      {/* Top Navigation Bar */}
      <Navbar />

      {/* Main Studio Body: Sidebar on Left, 3D/2D Canvas in Center, Inspector on Right */}
      <div className="relative flex-1 flex w-full h-[calc(100vh-3.5rem-2rem)] overflow-hidden">
        {/* Left: Infrastructure Hierarchy Tree */}
        <Sidebar />

        {/* Center: Real 3D / 2D WebGL Topology Canvas */}
        <main className="relative flex-1 h-full overflow-hidden bg-[#09090b]">
          {viewMode === "3d" ? <Graph3D /> : <Graph2D />}

          {/* Right: Selected Resource Configuration Inspector */}
          <InspectorPanel />
        </main>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar />

      {/* Connect AWS Account Modal */}
      <ConnectModal />
    </div>
  );
};

export default App;
