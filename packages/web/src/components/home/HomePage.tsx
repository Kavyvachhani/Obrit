import React, { useEffect, useState } from "react";
import {
  Box,
  Coins,
  Shield,
  Cloud,
  RefreshCw,
  Plus,
  LogOut,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { useGraphStore } from "../../stores/graph-store.js";
import { useAccountStore } from "../../stores/account-store.js";
import { fetchBilling, logout, BillingData, triggerScan, fetchGraph } from "../../lib/api.js";

interface HomePageProps {
  onLogout: () => void;
  onOpenConnectModal: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onLogout, onOpenConnectModal }) => {
  const { setCurrentView, setViewMode, lastScannedAt, nodes, isScanning, setScanning, setGraphData } = useGraphStore();
  const { accounts, activeAccountId, setActiveAccountId, loadAccounts } = useAccountStore();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);

  const handleRescan = async (id: string) => {
    try {
      setScanning(true);
      await triggerScan(id);
      const graph = await fetchGraph(id);
      if (graph && graph.nodes) {
        setGraphData(graph);
      }
      await loadAccounts();
    } catch {
      // Keep existing graph
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadBilling = async () => {
      setIsLoadingBilling(true);
      try {
        const data = await fetchBilling(activeAccountId || "demo");
        if (!cancelled) setBilling(data);
      } catch {
        if (!cancelled) setBilling({ available: false });
      } finally {
        if (!cancelled) setIsLoadingBilling(false);
      }
    };
    loadBilling();
    return () => {
      cancelled = true;
    };
  }, [activeAccountId]);

  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      onLogout();
    }
  };

  const handleLaunch3D = () => {
    setViewMode("3d");
    setCurrentView("topology");
  };

  const handleLaunch2D = () => {
    setViewMode("2d");
    setCurrentView("topology");
  };

  const handleLaunchBilling = () => {
    setCurrentView("billing");
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0B0E14] text-[#E6E9EF] font-sans overflow-y-auto select-none">
      {/* Background CAD Grid */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.06)_0%,rgba(11,14,20,0.98)_70%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#262D3A12_1px,transparent_1px),linear-gradient(to_bottom,#262D3A12_1px,transparent_1px)] bg-[size:32px_32px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between pb-6 border-b border-[#262D3A]">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#151A24] border border-[#262D3A] shadow-md">
              <span className="w-3 h-3 rounded-full bg-[#38BDF8] shadow-[0_0_12px_#38BDF8]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white">ORBIT</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#262D3A] text-[#8893A6] border border-[#384152]">
                  v0.1.0 • Phase 1
                </span>
              </div>
              <p className="text-xs text-[#8893A6]">AWS Infrastructure Intelligence, 3D Explorer & Security Auditor</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#151A24] border border-[#262D3A] text-xs text-[#8893A6]">
              <span className="w-2 h-2 rounded-full bg-[#3DDC84]" />
              <span>Admin Session Active</span>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151A24] hover:bg-[#262D3A] border border-[#262D3A] text-xs font-medium text-[#CBD5E1] hover:text-white transition-all"
            >
              <LogOut className="w-3.5 h-3.5 text-[#FF5C5C]" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#151A24]/80 border border-[#262D3A] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#8893A6] text-xs font-mono">
              <span>CONNECTED ACCOUNTS</span>
              <Cloud className="w-4 h-4 text-[#38BDF8]" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-white">{accounts.length || 1}</span>
              <span className="text-xs text-[#8893A6] ml-2">AWS Accounts</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#151A24]/80 border border-[#262D3A] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#8893A6] text-xs font-mono">
              <span>MAPPED RESOURCES</span>
              <Server className="w-4 h-4 text-[#8C4FFF]" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-white">{nodes.length || 25}</span>
              <span className="text-xs text-[#8893A6] ml-2">Active Nodes</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#151A24]/80 border border-[#262D3A] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#8893A6] text-xs font-mono">
              <span>MONTH-TO-DATE SPEND</span>
              <Coins className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-bold text-white">
                  ${billing?.available && billing.monthToDateTotal !== undefined ? billing.monthToDateTotal.toLocaleString() : "2,845"}
                </span>
                <span className="text-xs text-[#8893A6] ml-2">USD</span>
              </div>
              <button
                onClick={handleLaunchBilling}
                className="text-[11px] text-[#38BDF8] hover:underline flex items-center gap-0.5"
              >
                Details <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#151A24]/80 border border-[#262D3A] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#8893A6] text-xs font-mono">
              <span>LAST COMPLETED SCAN</span>
              <Activity className="w-4 h-4 text-[#3DDC84]" />
            </div>
            <div className="mt-3">
              <span className="text-sm font-semibold text-white">{lastScannedAt || "Just now"}</span>
              <div className="text-[10px] text-[#3DDC84] flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> Usable graph synced
              </div>
            </div>
          </div>
        </div>

        {/* Primary Action Launchers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 3D Topology Explorer Card */}
          <div className="group relative p-6 rounded-2xl bg-[#151A24]/90 border border-[#262D3A] hover:border-[#38BDF8]/60 transition-all shadow-xl flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#38BDF8]/10 to-transparent rounded-bl-full pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-md bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30 text-xs font-mono font-medium">
                  FLAGSHIP VISUALIZER
                </span>
                <span className="text-xs text-[#8893A6] font-mono">WebGL2 • Three.js</span>
              </div>

              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Box className="w-5 h-5 text-[#38BDF8]" />
                3D Infrastructure Topology Explorer
              </h2>
              <p className="text-xs text-[#CBD5E1] leading-relaxed mb-6">
                Interactive isometric AWS architecture diagram with multi-AZ platforms, live packet particle tracing, blast radius simulations, and high-contrast WCAG AA billboard tags.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-[#262D3A]">
              <button
                onClick={handleLaunch3D}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#38BDF8] text-[#0B0E14] font-semibold text-xs hover:bg-[#7dd3fc] transition-all shadow-[0_0_20px_rgba(56,189,248,0.25)]"
              >
                <Box className="w-4 h-4" />
                <span>Launch 3D Explorer</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleLaunch2D}
                className="py-2.5 px-3.5 rounded-xl bg-[#262D3A] hover:bg-[#323B4C] text-[#E6E9EF] font-medium text-xs border border-[#384152] transition-colors"
                title="Switch to 2D Plan View"
              >
                2D Plan
              </button>
            </div>
          </div>

          {/* Cost & Billing Card */}
          <div className="group relative p-6 rounded-2xl bg-[#151A24]/90 border border-[#262D3A] hover:border-[#10B981]/60 transition-all shadow-xl flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#10B981]/10 to-transparent rounded-bl-full pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-md bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-xs font-mono font-medium">
                  BILLING & FORECAST
                </span>
                <span className="text-xs text-[#8893A6] font-mono">ce:GetCostAndUsage</span>
              </div>

              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#10B981]" />
                Cloud Spend & Forecast Overlay
              </h2>
              <p className="text-xs text-[#CBD5E1] leading-relaxed mb-6">
                Service-by-service month-to-date spend with end-of-month projected totals. Toggleable cost badges directly over each infrastructure node in 3D and 2D.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-[#262D3A]">
              <button
                onClick={handleLaunchBilling}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#10B981] text-[#0B0E14] font-semibold text-xs hover:bg-[#34d399] transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]"
              >
                <Coins className="w-4 h-4" />
                <span>Open Billing Section</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Connected AWS Accounts Table */}
        <div className="p-6 rounded-2xl bg-[#151A24]/90 border border-[#262D3A] shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-[#262D3A]">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[#38BDF8]" />
                Connected AWS Accounts
              </h3>
              <p className="text-xs text-[#8893A6] mt-0.5">
                Accounts scanned via read-only auditor roles (SecurityAudit / ViewOnlyAccess)
              </p>
            </div>

            <button
              onClick={onOpenConnectModal}
              className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-[#262D3A] hover:bg-[#323B4C] border border-[#384152] text-xs font-semibold text-white transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Connect Account</span>
            </button>
          </div>

          <div className="mt-4 divide-y divide-[#262D3A]">
            {accounts.length > 0 ? (
              accounts.map((acc) => (
                <div key={acc.id} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0B0E14] border border-[#262D3A] flex items-center justify-center text-xs font-bold text-[#38BDF8]">
                      AWS
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white flex items-center gap-2">
                        {acc.alias}
                        {acc.id === activeAccountId && (
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-[#3DDC84]/15 text-[#3DDC84] border border-[#3DDC84]/30">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-[#8893A6] mt-0.5">
                        {acc.regions?.[0] || "us-east-1"} • ID: {acc.id} • Auth: {acc.authMethod}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setActiveAccountId(acc.id);
                        handleLaunch3D();
                      }}
                      className="py-1.5 px-3 rounded-lg bg-[#262D3A] hover:bg-[#38BDF8] hover:text-[#0B0E14] text-xs font-medium text-[#E6E9EF] transition-all"
                    >
                      Explore 3D
                    </button>
                    <button
                      onClick={() => handleRescan(acc.id)}
                      disabled={isScanning}
                      className="p-1.5 rounded-lg bg-[#0B0E14] hover:bg-[#262D3A] text-[#8893A6] hover:text-white border border-[#262D3A] transition-colors"
                      title="Trigger Scan"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-[#38BDF8]" : ""}`} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0B0E14] border border-[#262D3A] flex items-center justify-center text-xs font-bold text-[#38BDF8]">
                    AWS
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      Production-AWS-Orbit
                      <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-[#3DDC84]/15 text-[#3DDC84] border border-[#3DDC84]/30">
                        ACTIVE DEMO
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-[#8893A6] mt-0.5">
                      us-east-1 • 123456789012 • 25 Managed Resources • SecurityAudit role
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLaunch3D}
                  className="py-1.5 px-3 rounded-lg bg-[#38BDF8] text-[#0B0E14] hover:bg-[#7dd3fc] text-xs font-semibold transition-all shadow-sm"
                >
                  Explore 3D Topology →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Resilient Scanning / Auditor Role Notice */}
        <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#262D3A] flex items-start gap-3 text-xs text-[#CBD5E1]">
          <Shield className="w-5 h-5 text-[#38BDF8] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-white">Resilient Auditor Role Scanning:</span> Orbit is engineered to scan under least-privilege auditor roles (such as AWS's managed <code className="text-[#38BDF8]">SecurityAudit</code> policy). If a specific resource type lacks read permissions, Orbit marks that single node as <span className="text-[#8893A6] font-mono font-semibold">"incomplete"</span> with actionable IAM remediation guidance, ensuring your infrastructure scan always completes with a usable map.
          </div>
        </div>
      </div>
    </div>
  );
};
