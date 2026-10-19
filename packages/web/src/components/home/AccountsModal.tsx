import React from "react";
import {
  Cloud,
  X,
  Plus,
  RefreshCw,
  Server,
  Coins,
  Activity,
  CheckCircle2,
  Shield,
  Layers,
} from "lucide-react";
import { useGraphStore } from "../../stores/graph-store.js";
import { useAccountStore } from "../../stores/account-store.js";
import { triggerScan, fetchGraph } from "../../lib/api.js";

interface AccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenConnectModal: () => void;
}

export const AccountsModal: React.FC<AccountsModalProps> = ({
  isOpen,
  onClose,
  onOpenConnectModal,
}) => {
  const { nodes, lastScannedAt, isScanning, setScanning, setGraphData } = useGraphStore();
  const { accounts, activeAccountId, setActiveAccountId, loadAccounts } = useAccountStore();

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

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 font-sans select-none">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#121620]/95 border border-[#262D3A] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden text-[#E6E9EF]">
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-[#262D3A] flex items-center justify-between bg-[#151A24]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#0B0E14] border border-[#262D3A] text-[#38BDF8]">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">AWS Infrastructure & Accounts</h2>
              <p className="text-xs text-[#8893A6]">
                Manage connected AWS environments and view audit status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenConnectModal();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#262D3A] hover:bg-[#38BDF8] hover:text-[#0B0E14] text-xs font-semibold text-white transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect Account</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#0B0E14] hover:bg-[#262D3A] text-[#8893A6] hover:text-white border border-[#262D3A] transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#262D3A]">
              <div className="text-[11px] font-mono text-[#8893A6] flex items-center justify-between">
                <span>ACCOUNTS</span>
                <Cloud className="w-3.5 h-3.5 text-[#38BDF8]" />
              </div>
              <div className="text-xl font-bold text-white mt-1">
                {accounts.length || 1}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#262D3A]">
              <div className="text-[11px] font-mono text-[#8893A6] flex items-center justify-between">
                <span>RESOURCES</span>
                <Server className="w-3.5 h-3.5 text-[#8C4FFF]" />
              </div>
              <div className="text-xl font-bold text-white mt-1">
                {nodes.length}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#262D3A]">
              <div className="text-[11px] font-mono text-[#8893A6] flex items-center justify-between">
                <span>LAST SCAN</span>
                <Activity className="w-3.5 h-3.5 text-[#3DDC84]" />
              </div>
              <div className="text-xs font-semibold text-white mt-1.5 truncate">
                {lastScannedAt || "Just now"}
              </div>
            </div>
          </div>

          {/* Connected Accounts List */}
          <div className="rounded-xl bg-[#0B0E14] border border-[#262D3A] overflow-hidden">
            <div className="p-3 px-4 bg-[#151A24] border-b border-[#262D3A] text-xs font-semibold text-white">
              Connected Cloud Environments
            </div>

            <div className="divide-y divide-[#262D3A]">
              {accounts.length > 0 ? (
                accounts.map((acc) => (
                  <div key={acc.id} className="p-3.5 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#151A24] border border-[#262D3A] flex items-center justify-center text-xs font-bold text-[#FF9900]">
                        AWS
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-2">
                          {acc.alias}
                          {acc.id === activeAccountId && (
                            <span className="text-[9.5px] font-mono px-2 py-0.2 rounded-full bg-[#3DDC84]/15 text-[#3DDC84] border border-[#3DDC84]/30">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] font-mono text-[#8893A6] mt-0.5">
                          {acc.regions?.[0] || "us-east-1"} • ID: {acc.id}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setActiveAccountId(acc.id);
                          onClose();
                        }}
                        className="py-1 px-2.5 rounded-lg bg-[#262D3A] hover:bg-[#38BDF8] hover:text-[#0B0E14] text-xs font-medium text-[#E6E9EF] transition-all"
                      >
                        Select
                      </button>
                      <button
                        onClick={() => handleRescan(acc.id)}
                        disabled={isScanning}
                        className="p-1.5 rounded-lg bg-[#151A24] hover:bg-[#262D3A] text-[#8893A6] hover:text-white border border-[#262D3A] transition-colors"
                        title="Rescan"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-[#38BDF8]" : ""}`} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3.5 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#151A24] border border-[#262D3A] flex items-center justify-center text-xs font-bold text-[#FF9900]">
                      AWS
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        Production-AWS-Orbit
                        <span className="text-[9.5px] font-mono px-2 py-0.2 rounded-full bg-[#3DDC84]/15 text-[#3DDC84] border border-[#3DDC84]/30">
                          ACTIVE DEMO
                        </span>
                      </div>
                      <div className="text-[10.5px] font-mono text-[#8893A6] mt-0.5">
                        us-east-1 • 123456789012 • 25 Managed Resources
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveAccountId("demo");
                      onClose();
                    }}
                    className="py-1 px-3 rounded-lg bg-[#38BDF8] text-[#0B0E14] hover:bg-[#7dd3fc] text-xs font-semibold transition-all"
                  >
                    Active
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Least Privilege Security Notice */}
          <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#262D3A] flex items-start gap-2.5 text-xs text-[#8893A6]">
            <Shield className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Orbit runs strictly under read-only auditor roles (e.g. <code className="text-[#38BDF8]">SecurityAudit</code>). Credentials are stored with AES-256-GCM encryption on your local machine.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 px-6 border-t border-[#262D3A] bg-[#151A24] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#262D3A] hover:bg-[#38BDF8] hover:text-[#0B0E14] text-xs font-semibold text-white transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
