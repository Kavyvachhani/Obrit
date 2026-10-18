import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Layers } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTo2D?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GraphErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[GraphErrorBoundary] Caught rendering error in 3D graph:", error, errorInfo);
    this.setState({ errorInfo });
    // Auto-fallback to 2D after 1.5 seconds if fallback provided
    if (this.props.fallbackTo2D) {
      setTimeout(() => {
        if (this.state.hasError && this.props.fallbackTo2D) {
          this.props.fallbackTo2D();
        }
      }, 1500);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const isWebGL =
        this.state.error?.message?.toLowerCase().includes("webgl") ||
        this.state.error?.message?.toLowerCase().includes("context") ||
        this.state.error?.message?.toLowerCase().includes("three");

      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-[#0B0E14] text-[#E6E9EF] z-20 select-text">
          <div className="max-w-md w-full p-6 rounded-2xl bg-[#121824]/95 border border-[#FF5C5C]/40 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#FF5C5C]/15 border border-[#FF5C5C]/30 flex items-center justify-center mb-4 text-[#FF5C5C]">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold text-white mb-1.5">
              {isWebGL ? "3D WebGL Rendering Interrupted" : "3D View Rendering Error"}
            </h3>

            <p className="text-xs text-[#94A3B8] mb-4 leading-relaxed">
              {isWebGL
                ? "WebGL hardware acceleration is disabled, context was lost, or container dimensions were uninitialized. Switching to 2D Schematic mode."
                : "An unexpected error occurred while rendering the 3D scene. The rest of Orbit remains fully operational."}
            </p>

            {this.state.error && (
              <div className="w-full p-3 rounded-lg bg-[#070A10] border border-[#2B374E] text-left mb-5 overflow-x-auto">
                <div className="text-[10px] font-mono font-semibold text-[#FF5C5C] uppercase tracking-wider mb-1">
                  Diagnostic Error Details:
                </div>
                <code className="text-[11px] font-mono text-[#CBD5E1] break-all block">
                  {this.state.error.name}: {this.state.error.message}
                </code>
              </div>
            )}

            <div className="flex items-center gap-3 w-full">
              {this.props.fallbackTo2D && (
                <button
                  onClick={this.props.fallbackTo2D}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-semibold text-xs transition-colors"
                >
                  <Layers className="w-4 h-4" />
                  <span>Switch to 2D Mode</span>
                </button>
              )}

              <button
                onClick={this.handleRetry}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-semibold text-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry 3D</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
