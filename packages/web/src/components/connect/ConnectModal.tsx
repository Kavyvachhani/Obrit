import React, { useState } from "react";
import { useAccountStore } from "../../stores/account-store.js";
import { useGraphStore } from "../../stores/graph-store.js";
import { connectAccount, triggerScan, fetchGraph } from "../../lib/api.js";
import { AWS_REGIONS } from "@orbit/core";
import { X, Key, Shield, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

export const ConnectModal: React.FC = () => {
  const { isConnectModalOpen, setConnectModalOpen, loadAccounts } = useAccountStore();
  const { setGraphData, setScanning, setLastScannedAt } = useGraphStore();

  const [alias, setAlias] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [scanStage, setScanStage] = useState<string>("");
  const [showPolicy, setShowPolicy] = useState(false);
  const [copiedPolicy, setCopiedPolicy] = useState(false);

  if (!isConnectModalOpen) return null;

  const policyJson = JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "OrbitReadOnlyDiscovery",
          Effect: "Allow",
          Action: [
            "ec2:DescribeVpcs",
            "ec2:DescribeSubnets",
            "ec2:DescribeRouteTables",
            "ec2:DescribeInternetGateways",
            "ec2:DescribeNatGateways",
            "ec2:DescribeSecurityGroups",
            "ec2:DescribeInstances",
            "ec2:DescribeNetworkInterfaces",
            "elasticloadbalancing:DescribeLoadBalancers",
            "elasticloadbalancing:DescribeTargetGroups",
            "elasticloadbalancing:DescribeTargetHealth",
            "lambda:ListFunctions",
            "lambda:GetFunction",
            "rds:DescribeDBInstances",
            "rds:DescribeDBClusters",
            "s3:ListAllMyBuckets",
            "s3:GetBucketLocation",
            "iam:ListRoles",
            "iam:ListAttachedRolePolicies",
          ],
          Resource: "*",
        },
      ],
    },
    null,
    2
  );

  const handleCopyPolicy = () => {
    navigator.clipboard.writeText(policyJson);
    setCopiedPolicy(true);
    setTimeout(() => setCopiedPolicy(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!alias.trim() || !accessKeyId.trim() || !secretAccessKey.trim()) {
      setError("Please fill in all required credentials.");
      return;
    }

    if (!/^(AKIA|ASIA)[A-Z0-9]{16}$/.test(accessKeyId.trim())) {
      setError("Invalid Access Key ID format. It should start with AKIA or ASIA followed by 16 alphanumeric characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      setScanStage("Encrypting credentials and connecting account...");

      const newAcc = await connectAccount({
        alias: alias.trim(),
        provider: "aws",
        region,
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
      });

      setScanStage("Discovering VPCs, Subnets, EC2, Lambdas, RDS & S3...");
      setScanning(true);

      const scanResult = await triggerScan(newAcc.id);
      setScanStage(`Discovered ${scanResult.resourceCount} AWS resources. Building 3D graph...`);

      const graph = await fetchGraph(newAcc.id);
      if (graph) {
        setGraphData(graph);
      }

      await loadAccounts();
      setLastScannedAt(new Date().toLocaleTimeString());
      setSuccess(true);

      setTimeout(() => {
        setConnectModalOpen(false);
        setSuccess(false);
        setScanning(false);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect and scan AWS account.");
      setScanning(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-sky-500/30 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Connect AWS Account</h2>
              <p className="text-xs text-slate-400">Live Read-Only AWS Topology Visualizer</p>
            </div>
          </div>
          <button
            onClick={() => setConnectModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 flex items-start space-x-3 text-xs text-slate-300">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              Orbit is strictly <strong>read-only</strong>. Credentials are encrypted on your local machine using{" "}
              <span className="font-mono text-emerald-400">AES-256-GCM</span> and never sent off-system.
            </p>
            <button
              type="button"
              onClick={() => setShowPolicy(!showPolicy)}
              className="text-sky-400 hover:text-sky-300 flex items-center space-x-1 font-medium pt-1"
            >
              <span>{showPolicy ? "Hide" : "View"} recommended IAM policy</span>
              {showPolicy ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable IAM Policy Box */}
        {showPolicy && (
          <div className="p-3 rounded-2xl bg-slate-950 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Least-Privilege Policy:</span>
              <button
                type="button"
                onClick={handleCopyPolicy}
                className="flex items-center space-x-1 text-sky-400 hover:text-sky-300 font-mono text-[11px]"
              >
                {copiedPolicy ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPolicy ? "Copied" : "Copy Policy"}</span>
              </button>
            </div>
            <pre className="font-mono text-[10px] text-sky-300/80 max-h-36 overflow-y-auto leading-relaxed select-text p-2 rounded-xl bg-slate-900/60 border border-white/5">
              {policyJson}
            </pre>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {scanStage && isSubmitting && (
          <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs flex items-center space-x-2.5 animate-pulse">
            <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>{scanStage}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>AWS Infrastructure mapped successfully! Rendering 3D cloud...</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 block">Account / Environment Alias</label>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. Production-VPC-East"
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 block">Primary Region to Scan</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
            >
              {AWS_REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} ({r.value})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 block">AWS Access Key ID</label>
            <input
              type="text"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 block">AWS Secret Access Key</label>
            <input
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={isSubmitting || success}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-black font-semibold text-xs hover:shadow-glow transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Shield className="w-4 h-4" />
              <span>{isSubmitting ? "Scanning AWS Infrastructure..." : "Connect & Scan AWS Infrastructure"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
