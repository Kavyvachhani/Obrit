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

      setScanStage("Discovering entire AWS account: VPCs, Subnets, EC2, Lambdas, RDS & S3...");
      setScanning(true);

      const scanResult = await triggerScan(newAcc.id);
      setScanStage(`Discovered ${scanResult.resourceCount} AWS resources. Rendering topology...`);

      const graph = await fetchGraph(newAcc.id);
      if (graph && graph.nodes && graph.nodes.length > 0) {
        setGraphData(graph);
      }

      await loadAccounts();
      setLastScannedAt(new Date().toLocaleTimeString());
      setSuccess(true);

      setTimeout(() => {
        setConnectModalOpen(false);
        setSuccess(false);
        setScanning(false);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect and scan AWS account.");
      setScanning(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#121215] rounded-xl p-6 border border-[#27272a] shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272a] pb-3.5">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-zinc-800 text-amber-400 border border-zinc-700">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Connect AWS Account</h2>
              <p className="text-xs text-zinc-400">Discover and visualize entire infrastructure in 3D</p>
            </div>
          </div>
          <button
            onClick={() => setConnectModalOpen(false)}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="p-3 rounded-lg bg-[#18181b] border border-[#27272a] flex items-start space-x-3 text-xs text-zinc-300">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              Orbit is strictly <strong>read-only</strong>. Credentials are saved locally with{" "}
              <span className="font-mono text-emerald-400">AES-256-GCM</span> encryption and never sent off your system.
            </p>
            <button
              type="button"
              onClick={() => setShowPolicy(!showPolicy)}
              className="text-amber-400 hover:text-amber-300 flex items-center space-x-1 font-medium pt-0.5"
            >
              <span>{showPolicy ? "Hide" : "View"} recommended IAM policy</span>
              {showPolicy ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Expandable IAM Policy Box */}
        {showPolicy && (
          <div className="p-3 rounded-lg bg-[#0c0c0e] border border-[#27272a] space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Read-Only IAM Policy:</span>
              <button
                type="button"
                onClick={handleCopyPolicy}
                className="flex items-center space-x-1 text-zinc-300 hover:text-white font-mono text-[11px]"
              >
                {copiedPolicy ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPolicy ? "Copied" : "Copy Policy"}</span>
              </button>
            </div>
            <pre className="font-mono text-[10px] text-zinc-300 max-h-36 overflow-y-auto leading-relaxed select-text p-2 rounded bg-[#16161a] border border-[#27272a]">
              {policyJson}
            </pre>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {scanStage && isSubmitting && (
          <div className="p-3 rounded-lg bg-[#18181b] border border-[#27272a] text-zinc-200 text-xs flex items-center space-x-2.5">
            <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="font-mono text-[11px]">{scanStage}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>AWS Infrastructure mapped successfully! Rendering topology...</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="font-medium text-zinc-300 block">Account Alias</label>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. Production-Main"
              className="w-full bg-[#18181b] border border-[#27272a] rounded-md px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-zinc-300 block">Region to Scan</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-md px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 font-mono"
            >
              {AWS_REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} ({r.value})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-medium text-zinc-300 block">AWS Access Key ID</label>
            <input
              type="text"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              className="w-full bg-[#18181b] border border-[#27272a] rounded-md px-3 py-1.5 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-zinc-300 block">AWS Secret Access Key</label>
            <input
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              className="w-full bg-[#18181b] border border-[#27272a] rounded-md px-3 py-1.5 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || success}
              className="w-full py-2.5 px-4 rounded-md bg-zinc-100 text-zinc-950 font-semibold text-xs hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Discovering Account Resources..." : "Connect & Scan Entire Account"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
