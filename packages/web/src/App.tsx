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
import { Key, Shield, Cloud, Server, Cpu, Database, Sparkles } from "lucide-react";

export const App: React.FC = () => {
  const { viewMode, nodes, setGraphData, setLoading, isLoading } = useGraphStore();
  const { activeAccountId, loadAccounts, setConnectModalOpen } = useAccountStore();

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
        if (!cancelled && data && data.nodes) {
          setGraphData(data);
        }
      } catch {
        // Empty if none scanned
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
    <div className="relative w-screen h-screen flex flex-col bg-[#060911] select-none overflow-hidden font-sans">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Interactive Canvas Area */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {viewMode === "3d" ? <Graph3D /> : <Graph2D />}

        {/* Empty State Overlay when no nodes mapped */}
        {nodes.length === 0 && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none z-10">
            <div className="max-w-xl text-center glass-panel rounded-3xl p-8 border border-sky-500/30 shadow-2xl space-y-6 pointer-events-auto animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-sky-500/20 to-indigo-600/20 border border-sky-500/40 flex items-center justify-center shadow-glow">
                <Cloud className="w-8 h-8 text-sky-400 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Live 3D AWS Infrastructure Explorer
                </h1>
                <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
                  Connect your AWS credentials to discover and inspect your VPCs, subnets, EC2 server racks,
                  serverless Lambdas, databases, and network gateways in interactive 3D.
                </p>
              </div>

              <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
                <div className="flex items-center space-x-1.5 text-sky-400">
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Cloud VPCs</span>
                </div>
                <div className="flex items-center space-x-1.5 text-blue-400">
                  <Server className="w-3.5 h-3.5" />
                  <span>EC2 Racks</span>
                </div>
                <div className="flex items-center space-x-1.5 text-amber-400">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Lambda Chips</span>
                </div>
                <div className="flex items-center space-x-1.5 text-purple-400">
                  <Database className="w-3.5 h-3.5" />
                  <span>RDS Cylinders</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setConnectModalOpen(true)}
                  className="py-3 px-8 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 text-black font-semibold text-sm hover:shadow-glow transition-all flex items-center space-x-2.5 mx-auto"
                >
                  <Key className="w-4 h-4" />
                  <span>Connect AWS Account to Begin</span>
                </button>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-center space-x-6 text-[11px] text-slate-400 font-mono">
                <span className="flex items-center space-x-1">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span>100% Read-Only</span>
                </span>
                <span>•</span>
                <span>AES-256-GCM Local</span>
                <span>•</span>
                <span>No Docker Needed</span>
              </div>
            </div>
          </div>
        )}

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
