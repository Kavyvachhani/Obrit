import React, { useEffect, useState } from "react";
import {
  Coins,
  X,
  TrendingUp,
  DollarSign,
  Info,
  Calendar,
  Layers,
  Box,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { useGraphStore } from "../../stores/graph-store.js";
import { useAccountStore } from "../../stores/account-store.js";
import { fetchBilling, BillingData } from "../../lib/api.js";

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BillingModal: React.FC<BillingModalProps> = ({ isOpen, onClose }) => {
  const { isCostOverlayActive, toggleCostOverlay, setCostOverlayActive } = useGraphStore();
  const { activeAccountId } = useAccountStore();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchBilling(activeAccountId || "demo");
      setBilling(data);
    } catch {
      setBilling({ available: false });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeAccountId]);

  // Handle ESC key to close
  useEffect(() => {
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
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#121620]/95 border border-[#262D3A] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden text-[#E6E9EF]">
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-[#262D3A] flex items-center justify-between bg-[#151A24]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#0B0E14] border border-[#262D3A] text-[#10B981]">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Cloud Spend & Forecast Overlay</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  ce:GetCostAndUsage
                </span>
              </div>
              <p className="text-xs text-[#8893A6]">
                Service-by-service spend breakdown with projected month-end totals
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleCostOverlay}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-sm ${
                isCostOverlayActive
                  ? "bg-[#10B981] text-[#0B0E14] border-[#10B981] shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                  : "bg-[#0B0E14] text-[#E6E9EF] border-[#262D3A] hover:bg-[#262D3A]"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>3D Cost Badges: {isCostOverlayActive ? "ON" : "OFF"}</span>
            </button>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-[#0B0E14] hover:bg-[#262D3A] text-[#8893A6] hover:text-white border border-[#262D3A] transition-colors"
              title="Refresh Spend"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#10B981]" : ""}`} />
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

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <span className="w-7 h-7 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[#8893A6]">Fetching Cost Explorer dimensions...</span>
            </div>
          ) : billing && !billing.available ? (
            /* Optional Permission Missing Notice */
            <div className="p-6 rounded-xl bg-[#0B0E14] border border-[#262D3A] text-center max-w-lg mx-auto my-6 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-[#151A24] border border-[#262D3A] flex items-center justify-center text-[#38BDF8] mx-auto">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Cost Explorer Read Access Optional</h3>
                <p className="text-xs text-[#8893A6] mt-1 leading-relaxed">
                  Billing metrics (<code className="text-[#38BDF8]">ce:GetCostAndUsage</code>, <code className="text-[#38BDF8]">ce:GetCostForecast</code>) are optional. Orbit operates completely without them.
                </p>
              </div>
              <div className="text-left p-3 rounded-lg bg-[#151A24] border border-[#262D3A] font-mono text-[10.5px] text-[#38BDF8]">
                {`Action: ["ce:GetCostAndUsage", "ce:GetCostForecast"]`}
              </div>
            </div>
          ) : (
            <>
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#262D3A]">
                  <div className="flex items-center justify-between text-[#8893A6] text-xs font-mono mb-1.5">
                    <span>MONTH-TO-DATE SPEND</span>
                    <Calendar className="w-4 h-4 text-[#38BDF8]" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white">
                      ${billing?.monthToDateTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "2,845.60"}
                    </span>
                    <span className="text-xs font-mono text-[#8893A6]">USD</span>
                  </div>
                  <p className="text-[11px] text-[#8893A6] mt-1.5">
                    Unblended spend aggregated from 1st of month to present timestamp.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#262D3A]">
                  <div className="flex items-center justify-between text-[#8893A6] text-xs font-mono mb-1.5">
                    <span>PROJECTED MONTH-END TOTAL</span>
                    <TrendingUp className="w-4 h-4 text-[#10B981]" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#10B981]">
                      ${billing?.estimatedMonthEndTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "3,950.00"}
                    </span>
                    <span className="text-xs font-mono text-[#8893A6]">USD</span>
                  </div>
                  <p className="text-[11px] text-[#8893A6] mt-1.5">
                    Forecast based on linear run-rate projection and usage telemetry.
                  </p>
                </div>
              </div>

              {/* Service Breakdown Table */}
              <div className="rounded-xl bg-[#0B0E14] border border-[#262D3A] overflow-hidden">
                <div className="p-3.5 px-4 border-b border-[#262D3A] flex items-center justify-between bg-[#151A24]">
                  <div>
                    <h3 className="text-xs font-bold text-white">Service Breakdown (Top Spenders)</h3>
                    <p className="text-[11px] text-[#8893A6]">Monthly costs mapped to infrastructure nodes</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#8893A6]">
                    {(billing?.services || []).length} Services Active
                  </span>
                </div>

                <div className="divide-y divide-[#262D3A] max-h-72 overflow-y-auto">
                  {(billing?.services || []).map((s) => (
                    <div key={s.serviceName} className="p-3 px-4 flex items-center justify-between hover:bg-[#151A24]/50 transition-colors">
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-2">
                          <span>{s.shortName}</span>
                          <span className="text-[10px] font-mono text-[#8893A6] font-normal">
                            ({s.serviceName})
                          </span>
                        </div>
                        <div className="text-[10.5px] font-mono text-[#8893A6] mt-0.5">
                          Forecast: <span className="text-[#CBD5E1]">${s.estimatedMonthEndCost.toFixed(2)}/mo</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold font-mono text-white">
                          ${s.mtdCost.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-[#10B981] font-mono">
                          MTD Spend
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 px-6 border-t border-[#262D3A] bg-[#151A24] flex items-center justify-between">
          <div className="text-[11px] text-[#8893A6]">
            Toggle "3D Cost Badges" above to view spend directly on nodes in the live canvas.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#262D3A] hover:bg-[#38BDF8] hover:text-[#0B0E14] text-xs font-semibold text-white transition-all cursor-pointer shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
