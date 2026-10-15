import React, { useEffect } from "react";
import { Navbar } from "./components/layout/Navbar.js";
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

  // Load graph for active account
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
        // Keeps fallback demo graph in store
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
    <div className="relative w-screen h-screen flex flex-col bg-[#060911] select-none overflow-hidden">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Interactive Canvas Area */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {viewMode === "3d" ? <Graph3D /> : <Graph2D />}

        {/* Selected Resource Inspector Panel */}
        <InspectorPanel />
      </main>

      {/* Bottom Status & Legend Bar */}
      <StatusBar />

      {/* Account Connection Modal */}
      <ConnectModal />
    </div>
  );
};

export default App;
