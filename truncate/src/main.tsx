import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AuthGate from "./components/auth/AuthGate";
import AuthErrorBoundary from "./components/auth/AuthErrorBoundary";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthErrorBoundary>
      <AuthGate>
        <App />
      </AuthGate>
    </AuthErrorBoundary>
  </React.StrictMode>,
);
