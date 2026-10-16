import React, { useState, useMemo } from "react";
import { useGraphStore } from "../../stores/graph-store.js";
import {
  auditGraphFaultTolerance,
  ResilienceFault,
  FaultCategory,
  FaultSeverity,
  exportSecurityReportMarkdown,
  exportSecurityReportJson,
  THREAT_SCENARIOS,
} from "../../lib/fault-tolerance.js";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  X,
  ExternalLink,
  Crosshair,
  Wrench,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Info,
  Server,
  Cloud,
  Database,
  Lock,
  Download,
  Copy,
  Check,
  Terminal,
  Code2,
  Zap,
} from "lucide-react";

export const FaultChecklistModal: React.FC = () => {
  const { nodes, links, isFaultsOpen, setFaultsOpen, selectNode, setActiveThreatScenario, setSecurityHeatmap } = useGraphStore();
  const [activeCategory, setActiveCategory] = useState<"all" | FaultCategory>("all");
  const [activeSeverity, setActiveSeverity] = useState<"all" | FaultSeverity>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [resolvedFaultIds, setResolvedFaultIds] = useState<Set<string>>(new Set());
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [activeRemediationTab, setActiveRemediationTab] = useState<Record<string, "guide" | "cli" | "terraform">>({});

  // Run audit algorithm on active graph
  const auditReport = useMemo(() => {
    return auditGraphFaultTolerance(nodes, links);
  }, [nodes, links]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleDownload = (type: "md" | "json") => {
    const content = type === "md" ? exportSecurityReportMarkdown(auditReport) : exportSecurityReportJson(auditReport);
    const mime = type === "md" ? "text/markdown" : "application/json";
    const filename = `orbit-security-resilience-audit-${new Date().toISOString().slice(0, 10)}.${type}`;
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulateThreat = (scenarioId: string) => {
    setActiveThreatScenario(scenarioId);
    setSecurityHeatmap(true);
    setFaultsOpen(false);
  };

  if (!isFaultsOpen) return null;

  const toggleResolved = (id: string) => {
    setResolvedFaultIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLocateNode = (nodeId?: string) => {
    if (!nodeId) return;
    const target = nodes.find((n) => n.id === nodeId);
    if (target) {
      selectNode(target);
      setFaultsOpen(false);
      // Dispatch camera focus event
      window.dispatchEvent(
        new CustomEvent("orbit:focus-node", {
          detail: { id: target.id },
        })
      );
    }
  };

  const filteredFaults = auditReport.faults.filter((f) => {
    if (activeCategory !== "all" && f.category !== activeCategory) return false;
    if (activeSeverity !== "all" && f.severity !== activeSeverity) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.remediation.toLowerCase().includes(q) ||
        (f.affectedNodeName && f.affectedNodeName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return "#3DDC84";
    if (score >= 75) return "#38BDF8";
    if (score >= 60) return "#F2B33D";
    return "#FF5C5C";
  };

  const getSeverityBadge = (severity: FaultSeverity) => {
    switch (severity) {
      case "critical":
        return {
          bg: "bg-[#FF5C5C]/15",
          border: "border-[#FF5C5C]/40",
          text: "text-[#FF5C5C]",
          label: "CRITICAL OUTAGE RISK",
        };
      case "high":
        return {
          bg: "bg-[#F2B33D]/15",
          border: "border-[#F2B33D]/40",
          text: "text-[#F2B33D]",
          label: "HIGH SEVERITY",
        };
      case "medium":
        return {
          bg: "bg-[#38BDF8]/15",
          border: "border-[#38BDF8]/40",
          text: "text-[#38BDF8]",
          label: "MEDIUM WARNING",
        };
      case "low":
        return {
          bg: "bg-[#8893A6]/15",
          border: "border-[#8893A6]/40",
          text: "text-[#8893A6]",
          label: "LOW / INFO",
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#10141D] border border-[#262D3A] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#E6E9EF] font-sans">
        {/* Header */}
        <div className="p-5 border-b border-[#262D3A] bg-[#151A24]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF5C5C]/20 to-[#10141D] border border-[#FF5C5C]/30 flex items-center justify-center text-[#FF5C5C] shadow-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#E6E9EF]">
                  Fault Tolerance & Resilience Checklist
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#262D3A] text-[#8893A6] border border-[#262D3A]">
                  AWS Well-Architected REL
                </span>
              </div>
              <p className="text-xs text-[#8893A6] mt-0.5">
                Automated multi-AZ redundancy audit, single-points-of-failure (SPOF), and broken wiring detection
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownload("md")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B0E14] border border-[#262D3A] hover:border-[#38BDF8] text-xs font-medium text-[#38BDF8] hover:bg-[#262D3A] transition-all"
              title="Export complete security audit in Markdown format"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export MD</span>
            </button>
            <button
              onClick={() => handleDownload("json")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B0E14] border border-[#262D3A] hover:border-[#38BDF8] text-xs font-medium text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A] transition-all"
              title="Export raw JSON audit telemetry"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
            <button
              onClick={() => setFaultsOpen(false)}
              className="p-1.5 rounded-lg text-[#8893A6] hover:text-[#E6E9EF] hover:bg-[#262D3A] transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Resilience Overview Banner */}
        <div className="px-6 py-4 bg-[#0B0E14] border-b border-[#262D3A] grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
          {/* Health Score */}
          <div className="flex items-center gap-3 pr-4 border-r border-[#262D3A]/60">
            <div
              className="w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center shadow-lg"
              style={{
                borderColor: getScoreColor(auditReport.score),
                backgroundColor: `${getScoreColor(auditReport.score)}10`,
              }}
            >
              <span className="text-lg font-black" style={{ color: getScoreColor(auditReport.score) }}>
                {auditReport.grade}
              </span>
              <span className="text-[9px] font-mono font-bold text-[#8893A6]">
                {auditReport.score}%
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-[#E6E9EF]">Resilience Score</div>
              <div className="text-[11px] text-[#8893A6] mt-0.5">
                {auditReport.score >= 80 ? "Production Resilient" : "Action Required"}
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-mono text-[#8893A6] uppercase">Critical SPOFs</span>
            <span className="text-sm font-bold text-[#FF5C5C] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              {auditReport.summary.spofCount} Single Points of Failure
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-mono text-[#8893A6] uppercase">Wiring & Gaps</span>
            <span className="text-sm font-bold text-[#F2B33D] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {auditReport.summary.wiringFailures} Connection Flaws
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-mono text-[#8893A6] uppercase">Security Hazards</span>
            <span className="text-sm font-bold text-[#38BDF8] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              {auditReport.summary.securityRisks} Public Ingress Open
            </span>
          </div>
        </div>

        {/* Threat Scenario Simulation Bar */}
        <div className="px-6 py-2.5 bg-[#121622] border-b border-[#262D3A] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#F2B33D]" />
            <span className="font-semibold text-[#E6E9EF]">Threat Simulation:</span>
            <span className="text-[#8893A6] text-[11px]">Test attack blast radius & lateral movement</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {THREAT_SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSimulateThreat(s.id)}
                className="px-2.5 py-1 rounded bg-[#1A202C] hover:bg-[#2D3748] border border-[#262D3A] hover:border-[#F2B33D] text-[11px] text-[#E6E9EF] flex items-center gap-1.5 transition-all"
                title={s.description}
              >
                <Flame className="w-3 h-3 text-[#FF5C5C]" />
                <span>{s.title.split(":")[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 border-b border-[#262D3A] bg-[#151A24]/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeCategory === "all"
                  ? "bg-[#262D3A] text-[#E6E9EF] border border-[#4DA3FF]"
                  : "text-[#8893A6] hover:text-[#E6E9EF]"
              }`}
            >
              All Faults ({auditReport.summary.total})
            </button>
            <button
              onClick={() => setActiveCategory("spof")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeCategory === "spof"
                  ? "bg-[#262D3A] text-[#FF5C5C] border border-[#FF5C5C]"
                  : "text-[#8893A6] hover:text-[#E6E9EF]"
              }`}
            >
              SPOF ({auditReport.summary.spofCount})
            </button>
            <button
              onClick={() => setActiveCategory("wiring")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeCategory === "wiring"
                  ? "bg-[#262D3A] text-[#F2B33D] border border-[#F2B33D]"
                  : "text-[#8893A6] hover:text-[#E6E9EF]"
              }`}
            >
              Wiring ({auditReport.summary.wiringFailures})
            </button>
            <button
              onClick={() => setActiveCategory("security")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeCategory === "security"
                  ? "bg-[#262D3A] text-[#38BDF8] border border-[#38BDF8]"
                  : "text-[#8893A6] hover:text-[#E6E9EF]"
              }`}
            >
              Security ({auditReport.summary.securityRisks})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8893A6] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search faults, resources..."
              className="pl-8 pr-3 py-1 bg-[#0B0E14] border border-[#262D3A] rounded-lg text-xs text-[#E6E9EF] placeholder-[#8893A6] focus:outline-none focus:border-[#4DA3FF] w-48"
            />
          </div>
        </div>

        {/* Fault List Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
          {filteredFaults.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-[#8893A6]">
              <CheckCircle2 className="w-10 h-10 text-[#3DDC84] mb-2" />
              <div className="text-sm font-semibold text-[#E6E9EF]">No Active Faults Found</div>
              <div className="text-xs max-w-sm mt-1">
                Your topology matches high-availability resilience criteria for this category filter.
              </div>
            </div>
          ) : (
            filteredFaults.map((fault) => {
              const badge = getSeverityBadge(fault.severity);
              const isResolved = resolvedFaultIds.has(fault.id);

              return (
                <div
                  key={fault.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isResolved
                      ? "bg-[#151A24]/40 border-[#262D3A] opacity-60"
                      : "bg-[#151A24] border-[#262D3A] hover:border-[#8893A6]/40 shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <button
                        onClick={() => toggleResolved(fault.id)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isResolved
                            ? "bg-[#3DDC84] border-[#3DDC84] text-[#0B0E14]"
                            : "border-[#8893A6]/60 hover:border-[#E6E9EF]"
                        }`}
                        title={isResolved ? "Mark Unresolved" : "Mark Acknowledged"}
                      >
                        {isResolved && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${badge.bg} ${badge.border} ${badge.text}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[10px] font-mono text-[#8893A6]">
                            {fault.frameworkRef}
                          </span>
                        </div>

                        <h3 className={`text-sm font-bold mt-1.5 ${isResolved ? "line-through text-[#8893A6]" : "text-[#E6E9EF]"}`}>
                          {fault.title}
                        </h3>
                      </div>
                    </div>

                    {fault.affectedNodeId && (
                      <button
                        onClick={() => handleLocateNode(fault.affectedNodeId)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B0E14] border border-[#262D3A] hover:border-[#4DA3FF] text-[11px] font-medium text-[#4DA3FF] hover:bg-[#262D3A] transition-all shrink-0"
                        title="Locate & Focus in 3D/2D View"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>Locate</span>
                      </button>
                    )}
                  </div>

                  {/* Impact & Description */}
                  <div className="mt-3 pl-6 space-y-2 text-xs">
                    <p className="text-[#8893A6] leading-relaxed">
                      {fault.description}
                    </p>

                    <div className="p-2.5 rounded-lg bg-[#0B0E14]/70 border border-[#262D3A] text-[11px] text-[#F2B33D] flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-[#E6E9EF]">Failure Blast Radius:</strong> {fault.impact}
                      </span>
                    </div>

                    {/* Remediation Playbook & Code Generator */}
                    <div className="mt-2.5 rounded-lg bg-[#0B0E14] border border-[#262D3A] overflow-hidden text-xs">
                      {/* Sub-tabs */}
                      <div className="px-3 py-1.5 bg-[#10141D] border-b border-[#262D3A] flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setActiveRemediationTab((prev) => ({ ...prev, [fault.id]: "guide" }))}
                            className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                              (activeRemediationTab[fault.id] || "guide") === "guide"
                                ? "bg-[#262D3A] text-[#3DDC84] font-medium"
                                : "text-[#8893A6] hover:text-[#E6E9EF]"
                            }`}
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Guide</span>
                          </button>
                          {fault.cliRemediation && (
                            <button
                              onClick={() => setActiveRemediationTab((prev) => ({ ...prev, [fault.id]: "cli" }))}
                              className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                                activeRemediationTab[fault.id] === "cli"
                                  ? "bg-[#262D3A] text-[#38BDF8] font-medium"
                                  : "text-[#8893A6] hover:text-[#E6E9EF]"
                              }`}
                            >
                              <Terminal className="w-3 h-3" />
                              <span>AWS CLI</span>
                            </button>
                          )}
                          {fault.terraformRemediation && (
                            <button
                              onClick={() => setActiveRemediationTab((prev) => ({ ...prev, [fault.id]: "terraform" }))}
                              className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                                activeRemediationTab[fault.id] === "terraform"
                                  ? "bg-[#262D3A] text-[#8C4FFF] font-medium"
                                  : "text-[#8893A6] hover:text-[#E6E9EF]"
                              }`}
                            >
                              <Code2 className="w-3 h-3" />
                              <span>Terraform HCL</span>
                            </button>
                          )}
                        </div>

                        {/* Copy Code Button for Active Tab */}
                        {activeRemediationTab[fault.id] === "cli" && fault.cliRemediation && (
                          <button
                            onClick={() => handleCopy(fault.id, fault.cliRemediation!)}
                            className="flex items-center gap-1 text-[10px] text-[#38BDF8] hover:text-white transition-colors"
                          >
                            {copiedCodeId === fault.id ? <Check className="w-3 h-3 text-[#3DDC84]" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedCodeId === fault.id ? "Copied" : "Copy CLI"}</span>
                          </button>
                        )}
                        {activeRemediationTab[fault.id] === "terraform" && fault.terraformRemediation && (
                          <button
                            onClick={() => handleCopy(fault.id, fault.terraformRemediation!)}
                            className="flex items-center gap-1 text-[10px] text-[#8C4FFF] hover:text-white transition-colors"
                          >
                            {copiedCodeId === fault.id ? <Check className="w-3 h-3 text-[#3DDC84]" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedCodeId === fault.id ? "Copied" : "Copy HCL"}</span>
                          </button>
                        )}
                      </div>

                      {/* Tab Content */}
                      <div className="p-2.5">
                        {(activeRemediationTab[fault.id] || "guide") === "guide" && (
                          <div className="text-[11px] text-[#E6E9EF] leading-relaxed flex items-start gap-2">
                            <span className="font-semibold text-[#3DDC84] shrink-0">Remediation:</span>
                            <span>{fault.remediation}</span>
                          </div>
                        )}
                        {activeRemediationTab[fault.id] === "cli" && fault.cliRemediation && (
                          <pre className="text-[10px] font-mono text-[#38BDF8] overflow-x-auto whitespace-pre p-2 bg-[#06080D] rounded border border-[#262D3A]">
                            {fault.cliRemediation}
                          </pre>
                        )}
                        {activeRemediationTab[fault.id] === "terraform" && fault.terraformRemediation && (
                          <pre className="text-[10px] font-mono text-[#E2E8F0] overflow-x-auto whitespace-pre p-2 bg-[#06080D] rounded border border-[#262D3A]">
                            {fault.terraformRemediation}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#262D3A] bg-[#151A24]/90 flex items-center justify-between text-xs text-[#8893A6]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3DDC84]" />
            <span>Audit updated live from active AWS configuration</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFaultsOpen(false)}
              className="px-4 py-1.5 rounded-lg bg-[#262D3A] hover:bg-[#323B4C] text-[#E6E9EF] font-medium transition-colors"
            >
              Close Checklist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
