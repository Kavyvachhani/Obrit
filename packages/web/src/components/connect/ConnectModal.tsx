import React, { useState } from "react";
import { useAccountStore } from "../../stores/account-store.js";
import { useGraphStore } from "../../stores/graph-store.js";
import { connectAccount, triggerScan, fetchGraph } from "../../lib/api.js";
import { AWS_REGIONS } from "@orbit/core";
import type { ScanRun } from "@orbit/core";
import {
  X,
  Key,
  Shield,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";

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
  const [successMessage, setSuccessMessage] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
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

  const steps = [
    "Encrypting credentials & saving locally with AES-256-GCM...",
    `Authenticating with AWS in ${region}...`,
    "Discovering VPCs, Subnets, Gateways, EC2, Lambdas, RDS & S3...",
    "Generating multi-tier 3D & 2D architecture topology...",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

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
      setCurrentStep(0);

      // Step 1: Encrypt & Store account
      const newAcc = await connectAccount({
        alias: alias.trim(),
        provider: "aws",
        region,
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
      });

      setCurrentStep(1);
      setScanning(true);

      // Step 2 & 3: Scan with 120-second timeout safety for comprehensive account discovery
      setCurrentStep(2);
      const scanPromise = triggerScan(newAcc.id);
      const timeoutPromise = new Promise<ScanRun>((_, reject) =>
        setTimeout(() => reject(new Error("AWS API scan timed out. Check your network or IAM credentials.")), 120000)
      );

      const scanResult = await Promise.race([scanPromise, timeoutPromise]);

      if (scanResult.status === "failed" && scanResult.errors && scanResult.errors.length > 0 && scanResult.errors[0]) {
        const firstErr = scanResult.errors[0];
        throw new Error(`AWS ${firstErr.service} error: ${firstErr.message}`);
      }

      // Step 4: Fetch graph & render
      setCurrentStep(3);
      const graph = await fetchGraph(newAcc.id);

      if (graph && graph.nodes && graph.nodes.length > 0) {
        setGraphData(graph);
        const warning = scanResult.errors?.length ? ` (${scanResult.errors.length} service data gaps)` : "";
        setSuccessMessage(`Discovered ${graph.nodes.length} AWS resources! Live 3D topology ready.${warning}`);
      } else if (scanResult.resourceCount > 0) {
        setSuccessMessage(`Discovered ${scanResult.resourceCount} AWS resources!`);
      } else {
        setSuccessMessage(`Account connected! No active resources found in region ${region}. Showing reference architecture.`);
      }

      await loadAccounts();
      setLastScannedAt(new Date().toLocaleTimeString());
      setSuccess(true);

      setTimeout(() => {
        setConnectModalOpen(false);
        setSuccess(false);
        setScanning(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect and scan AWS account. Please check credentials.");
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
              <p className="text-xs text-zinc-400">Discover and visualize entire cloud infrastructure in 3D & 2D</p>
            </div>
          </div>
          <button
            onClick={() => setConnectModalOpen(false)}
            disabled={isSubmitting}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-30"
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
              <span>{showPolicy ? "Hide" : "View"} recommended read-only IAM policy</span>
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

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <div>
              <div className="font-semibold text-red-200">Connection Failed</div>
              <div className="text-[11px] mt-0.5 leading-relaxed">{error}</div>
            </div>
          </div>
        )}

        {/* Active Animated Scan Progress */}
        {isSubmitting && (
          <div className="p-3.5 rounded-lg bg-[#16161b] border border-amber-500/40 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-amber-400 flex items-center space-x-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Scanning AWS Infrastructure...</span>
              </span>
              <span className="text-zinc-400 font-semibold">{currentStep + 1} / {steps.length}</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-400 h-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
            <div className="text-[11px] font-mono text-zinc-300 leading-relaxed">
              {steps[currentStep]}
            </div>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium text-emerald-200">{successMessage}</span>
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
              disabled={isSubmitting}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-md px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono disabled:opacity-50"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-zinc-300 block">Region to Scan</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-md px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 font-mono disabled:opacity-50"
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
              disabled={isSubmitting}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-md px-3 py-1.5 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
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
              disabled={isSubmitting}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-md px-3 py-1.5 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || success}
              className="w-full py-2.5 px-4 rounded-md bg-zinc-100 text-zinc-950 font-semibold text-xs hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning AWS Infrastructure...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Connect & Scan Entire Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
