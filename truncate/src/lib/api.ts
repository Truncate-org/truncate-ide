import { invoke } from "@tauri-apps/api/core";

const BASE_URL = "https://truncate-demo-portal.onrender.com";

export interface ApiError extends Error {
  status?: number;
  code?: string;
  data?: any;
}

interface ProxyResponse {
  status: number;
  data: any;
}

/**
 * Base request wrapper using Rust proxy to bypass CORS.
 */
export async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const method = options.method || "GET";

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Custom headers from options
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers[key] = String(value);
    });
  }

  // Parse body if it's a string (standard for fetch RequestInit)
  let bodyValue = null;
  if (options.body) {
    try {
      bodyValue = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    } catch (e) {
      bodyValue = options.body;
    }
  }

  try {
    const response = await invoke<ProxyResponse>("api_proxy", {
      request: {
        method,
        url,
        headers,
        body: bodyValue
      }
    });

    if (response.status >= 400) {
      const error = new Error(response.data.message || `API Error (${response.status})`) as ApiError;
      error.status = response.status;
      error.code = response.data.code;
      error.data = response.data;
      throw error;
    }

    return response.data as T;
  } catch (error: any) {
    // If it's already a processed ApiError, rethrow
    if (error.status) throw error;

    // Handle tauri-invoke failures or rust-level panics/errors
    const rawError = error.toString();
    let userFriendlyMessage = "An unexpected network error occurred.";

    if (rawError.includes("Network error:") || rawError.includes("dns error") || rawError.includes("failed to lookup address")) {
      userFriendlyMessage = "Unable to connect to the server. Please check your internet connection or try again later.";
    } else if (rawError.includes("timeout")) {
      userFriendlyMessage = "The request timed out. Please try again.";
    } else {
      userFriendlyMessage = rawError; // Fallback to raw if we don't recognize it, but the ones above catch most network issues
    }

    const apiError = new Error(userFriendlyMessage) as ApiError;
    throw apiError;
  }
}

export const api = {
  get: <T>(endpoint: string, token?: string | null) =>
    request<T>(endpoint, { method: "GET" }, token),

  post: <T>(endpoint: string, body: any, token?: string | null) =>
    request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body)
    }, token),

  delete: <T>(endpoint: string, token?: string | null) =>
    request<T>(endpoint, { method: "DELETE" }, token),
};
