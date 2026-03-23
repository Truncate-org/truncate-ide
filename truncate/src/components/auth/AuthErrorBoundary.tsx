import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for the auth system.
 * SECURITY: Log error to Tauri system but NEVER include tokens.
 */
class AuthErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Auth System Error:", error, errorInfo);
    // In a real Tauri app, we would use tauri-plugin-log here:
    // log.error(`Auth Error: ${error.message}`);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#1e1e1e] flex items-center justify-center p-6 text-center select-none">
          <div className="max-w-md flex flex-col items-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertCircle className="w-8 h-8 text-[#f14c4c]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">
              Something went wrong during sign-in
            </h2>
            <p className="text-sm text-gray-400 mb-8 leading-relaxed">
              An unexpected error occurred while verifying your session. 
              Please restart Truncate or try again below.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-[#007acc] hover:bg-[#0062a3] text-white font-semibold rounded-md flex items-center gap-2 transition-all shadow-lg"
            >
              <RefreshCcw className="w-4 h-4" />
              Restart App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AuthErrorBoundary;
