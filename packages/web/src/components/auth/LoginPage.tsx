import React, { useState } from "react";
import { Lock, UserPlus, Sparkles, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2, User, KeyRound, Shield } from "lucide-react";
import { login, register, loginAsGuest } from "../../lib/api.js";

interface LoginPageProps {
  onLoginSuccess: (user?: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === "signup") {
        if (!username || username.trim().length < 2) {
          throw new Error("Username must be at least 2 characters");
        }
        const res = await register(username.trim(), password, email.trim() || undefined);
        setSuccessMsg("Account created! Entering workspace...");
        setTimeout(() => onLoginSuccess(res.user), 400);
      } else {
        // Login mode: supports username+password or admin password
        const res = await login(username.trim() || password, username.trim() ? password : undefined);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please check credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestEntry = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await loginAsGuest();
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err?.message || "Failed to start local guest session");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#0B0E14] text-[#E6E9EF] font-sans overflow-hidden select-none">
      {/* Background CAD Matrix Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.08)_0%,rgba(11,14,20,0.95)_75%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#262D3A12_1px,transparent_1px),linear-gradient(to_bottom,#262D3A12_1px,transparent_1px)] bg-[size:36px_36px]" />

      {/* Main Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-md mx-4 p-8 bg-[#151A24]/90 backdrop-blur-xl border border-[#262D3A] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-[#0B0E14] border border-[#262D3A] shadow-inner mb-3">
            <span className="w-3.5 h-3.5 rounded-full bg-[#38BDF8] shadow-[0_0_16px_#38BDF8]" />
            <div className="absolute inset-0 rounded-xl border border-[#38BDF8]/40 animate-pulse" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            ORBIT <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30 font-mono font-medium">AWS STUDIO</span>
          </h1>
          <p className="text-xs text-[#8893A6] mt-1">
            Live 3D Infrastructure Visualizer & Security Inspector
          </p>
        </div>

        {/* Tab Switcher: Log In vs Sign Up */}
        <div className="flex p-1 mb-6 rounded-xl bg-[#0B0E14] border border-[#262D3A]">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === "login"
                ? "bg-[#262D3A] text-white shadow-sm"
                : "text-[#8893A6] hover:text-[#CBD5E1]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === "signup"
                ? "bg-[#262D3A] text-white shadow-sm"
                : "text-[#8893A6] hover:text-[#CBD5E1]"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#FF5C5C]/15 border border-[#FF5C5C]/40 text-xs text-[#FF5C5C] animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-xs text-[#34D399]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "signup" && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#8893A6] mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8893A6]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. dev_engineer"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#262D3A] focus:border-[#38BDF8] rounded-xl text-sm text-white placeholder-[#475569] focus:outline-none focus:ring-1 focus:ring-[#38BDF8]/20 transition-all font-mono"
                />
              </div>
            </div>
          )}

          {mode === "login" && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#8893A6] mb-1.5">
                Username (Optional for admin)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8893A6]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or registered username"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-[#262D3A] focus:border-[#38BDF8] rounded-xl text-sm text-white placeholder-[#475569] focus:outline-none focus:ring-1 focus:ring-[#38BDF8]/20 transition-all font-mono"
                />
              </div>
            </div>
          )}

          {mode === "signup" && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#8893A6] mb-1.5">
                Email (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dev@company.com"
                className="w-full px-3.5 py-2.5 bg-[#0B0E14] border border-[#262D3A] focus:border-[#38BDF8] rounded-xl text-sm text-white placeholder-[#475569] focus:outline-none focus:ring-1 focus:ring-[#38BDF8]/20 transition-all font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#8893A6] mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8893A6]">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Set secure password" : "Enter password (default: orbit-admin)"}
                required
                className="w-full pl-10 pr-10 py-2.5 bg-[#0B0E14] border border-[#262D3A] focus:border-[#38BDF8] rounded-xl text-sm text-white placeholder-[#475569] focus:outline-none focus:ring-1 focus:ring-[#38BDF8]/20 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8893A6] hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mode === "login" && (
              <div className="mt-1 flex justify-between items-center text-[10.5px] text-[#8893A6]">
                <span>Stored locally in database</span>
                <span className="font-mono text-[#38BDF8]/80">Default admin: orbit-admin</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !password}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-lg mt-2 ${
              isLoading || !password
                ? "bg-[#262D3A] text-[#8893A6] cursor-not-allowed border border-[#262D3A]"
                : "bg-[#38BDF8] text-[#0B0E14] hover:bg-[#7dd3fc] hover:shadow-[0_0_20px_rgba(56,189,248,0.35)] active:scale-[0.99]"
            }`}
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-[#0B0E14] border-t-transparent rounded-full animate-spin" />
            ) : mode === "signup" ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Local Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Sign In to Orbit</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* 1-Click Fast Guest Entry */}
        <div className="mt-5 pt-4 border-t border-[#262D3A]/60 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleGuestEntry}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#0B0E14] hover:bg-[#262D3A] border border-[#262D3A] text-xs font-semibold text-[#CBD5E1] hover:text-white transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Continue as Guest / Local Dev (1-Click)</span>
          </button>

          <div className="flex items-center justify-between text-[10.5px] text-[#8893A6] px-1 pt-1">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#3DDC84]" /> Local persistence
            </span>
            <span>Passwords hashed with bcrypt</span>
          </div>
        </div>
      </div>
    </div>
  );
};
