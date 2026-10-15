import React, { useState } from "react";
import { useAccountStore } from "../../stores/account-store.js";
import { connectAccount, triggerScan } from "../../lib/api.js";
import { AWS_REGIONS } from "@orbit/core";
import { X, Key, Shield, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";

export const ConnectModal: React.FC = () => {
  const { isConnectModalOpen, setConnectModalOpen, loadAccounts, seedDemo } = useAccountStore();

  const [alias, setAlias] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isConnectModalOpen) return null;

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
      const newAcc = await connectAccount({
        alias: alias.trim(),
        provider: "aws",
        region,
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
      });

      setSuccess(true);
      await triggerScan(newAcc.id).catch(() => {});
      await loadAccounts();
      setTimeout(() => {
        setConnectModalOpen(false);
        setSuccess(false);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect AWS account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-sky-500/30 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Connect AWS Account</h2>
              <p className="text-xs text-slate-400">Read-only infrastructure discovery engine</p>
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
          <p>
            Orbit is strictly <strong>read-only</strong>. Credentials are encrypted on your machine using{" "}
            <span className="font-mono text-emerald-400">AES-256-GCM</span> and never sent off-system.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Connected successfully! Initiating initial scan...</span>
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
            <label className="text-xs font-medium text-slate-300 block">Primary Region</label>
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

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                seedDemo();
                setConnectModalOpen(false);
              }}
              className="flex items-center space-x-1.5 text-xs text-purple-400 hover:text-purple-300 font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explore Demo Cloud instead</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting || success}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-black font-semibold text-xs hover:shadow-glow transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Connecting & Scanning..." : "Connect Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
