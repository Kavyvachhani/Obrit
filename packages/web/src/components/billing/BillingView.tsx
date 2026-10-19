import React, { useEffect, useState } from "react";
import {
  Coins,
  ArrowLeft,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Info,
  Calendar,
  Layers,
  Box,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useGraphStore } from "../../stores/graph-store.js";
import { useAccountStore } from "../../stores/account-store.js";
import { fetchBilling, BillingData } from "../../lib/api.js";

export const BillingView: React.FC = () => {
  const {
    setCurrentView,
    setViewMode,
    isCostOverlayActive,
    toggleCostOverlay,
    setCostOverlayActive,
  } = useGraphStore();
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
    loadData();
  }, [activeAccountId]);

  const handleOpen3DWithCosts = () => {
    setCostOverlayActive(true);
    setViewMode("3d");
    setCurrentView("topology");
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0B0E14] text-[#E6E9EF] font-sans overflow-y-auto select-none">
      {/* Background CAD Grid */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.06)_0%,rgba(11,14,20,0.98)_70%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#262D3A12_1px,transparent_1px),linear-gradient(to_bottom,#262D3A12_1px,transparent_1px)] bg-[size:32px_32px]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between pb-6 border-b border-[#262D3A]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentView("topology")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#151A24] hover:bg-[#262D3A] border border-[#262D3A] text-xs font-medium text-[#CBD5E1] hover:text-white transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Topology</span>
            </button>
            <div className="h-4 w-px bg-[#262D3A]" />
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#10B981]" />
                Cloud Spend & Forecast Overlay
              </h1>
              <p className="text-xs text-[#8893A6]">
                Read-only cost analysis powered by AWS Cost Explorer (<code className="text-[#10B981]">ce:GetCostAndUsage</code>, <code className="text-[#10B981]">ce:GetCostForecast</code>)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleCostOverlay}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm ${
                isCostOverlayActive
                  ? "bg-[#10B981] text-[#0B0E14] border-[#10B981] shadow-[0_0_16px_rgba(16,185,129,0.3)]"
                  : "bg-[#151A24] text-[#E6E9EF] border-[#262D3A] hover:bg-[#262D3A]"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Cost Badges in 3D: {isCostOverlayActive ? "ON" : "OFF"}</span>
            </button>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl bg-[#151A24] border border-[#262D3A] text-[#8893A6] hover:text-white transition-colors"
              title="Refresh Spend"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#10B981]" : ""}`} />
            </button>
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <span className="w-8 h-8 border-3 border-[#10B981] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[#8893A6]">Querying Cost Explorer endpoints...</span>
          </div>
        ) : billing && !billing.available ? (
          /* Clean Optional Permission Absence State */
          <div className="p-8 rounded-2xl bg-[#151A24]/90 border border-[#262D3A] shadow-xl flex flex-col items-center text-center max-w-2xl mx-auto my-8">
            <div className="w-12 h-12 rounded-2xl bg-[#0B0E14] border border-[#262D3A] flex items-center justify-center text-[#38BDF8] mb-4">
              <Info className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-bold text-white mb-2">Cost Explorer Access Not Granted (Optional)</h2>
            <p className="text-xs text-[#CBD5E1] leading-relaxed mb-6">
              Cost Explorer read permissions (<code className="text-[#38BDF8]">ce:GetCostAndUsage</code>, <code className="text-[#38BDF8]">ce:GetCostForecast</code>) are explicitly optional. In standard AWS Organizations setups, billing APIs are commonly restricted to the payer or management root account.
            </p>

            <div className="w-full text-left p-4 rounded-xl bg-[#0B0E14] border border-[#262D3A] text-xs font-mono text-[#8893A6] mb-6">
              <div className="text-[11px] font-semibold text-[#CBD5E1] mb-1 font-sans">
                Optional IAM Permission Policy snippet:
              </div>
              <pre className="text-[11px] overflow-x-auto text-[#38BDF8]">
{`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ce:GetCostAndUsage",
      "ce:GetCostForecast",
      "ce:GetDimensionValues"
    ],
    "Resource": "*"
  }]
}`}
              </pre>
            </div>

            <button
              onClick={() => setCurrentView("topology")}
              className="py-2.5 px-6 rounded-xl bg-[#38BDF8] text-[#0B0E14] font-semibold text-xs hover:bg-[#7dd3fc] transition-all"
            >
              Return to 3D Topology Explorer
            </button>
          </div>
        ) : (
          /* Billing Metrics & Breakdown Table */
          <div className="space-y-6">
            {/* Top Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* MTD Box */}
              <div className="p-6 rounded-2xl bg-[#151A24]/90 border border-[#262D3A] shadow-xl">
                <div className="flex items-center justify-between text-[#8893A6] text-xs font-mono mb-2">
                  <span>CURRENT MONTH-TO-DATE SPEND</span>
                  <Calendar className="w-4 h-4 text-[#38BDF8]" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">
                    ${billing?.monthToDateTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "2,845.60"}
                  </span>
                  <span className="text-xs font-mono text-[#8893A6]">USD</span>
                </div>
                <p className="text-[11.5px] text-[#8893A6] mt-2">
                  Actual unblended spend aggregated from 1st of the month to present timestamp.
                </p>
              </div>

              {/* Forecast Box */}
              <div className="p-6 rounded-2xl bg-[#151A24]/90 border border-[#262D3A] shadow-xl">
                <div className="flex items-center justify-between text-[#8893A6] text-xs font-mono mb-2">
                  <span>PROJECTED MONTH-END TOTAL</span>
                  <TrendingUp className="w-4 h-4 text-[#10B981]" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-[#10B981]">
                    ${billing?.estimatedMonthEndTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "3,950.00"}
                  </span>
                  <span className="text-xs font-mono text-[#8893A6]">USD</span>
                </div>
                <p className="text-[11.5px] text-[#8893A6] mt-2">
                  Estimated month-end bill via <code className="text-[#10B981]">ce:GetCostForecast</code> run-rate projection.
                </p>
              </div>
            </div>

            {/* Service Breakdown Table */}
            <div className="p-6 rounded-2xl bg-[#151A24]/90 border border-[#262D3A] shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#262D3A] mb-4">
                <div>
                  <h2 className="text-base font-bold text-white">Service Breakdown (Top Spenders)</h2>
                  <p className="text-xs text-[#8893A6]">Cost per AWS service grouped by dimension</p>
                </div>

                <button
                  onClick={handleOpen3DWithCosts}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#262D3A] hover:bg-[#38BDF8] hover:text-[#0B0E14] text-xs font-semibold text-white transition-all"
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>Overlay onto 3D Topology</span>
                </button>
              </div>

              <div className="divide-y divide-[#262D3A]">
                {(billing?.services || []).map((s) => (
                  <div key={s.serviceName} className="py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-white flex items-center gap-2">
                        {s.shortName}
                        <span className="text-[10px] font-mono text-[#8893A6] font-normal truncate max-w-xs">
                          ({s.serviceName})
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-[#8893A6] mt-0.5">
                        Forecasted: <span className="text-[#CBD5E1]">${s.estimatedMonthEndCost.toFixed(2)}/mo</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-white font-mono">
                        ${s.mtdCost.toFixed(2)}
                      </div>
                      <div className="text-[10.5px] text-[#10B981] font-mono font-medium">
                        MTD Spend
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
