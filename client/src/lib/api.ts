import { apiRequest } from "./queryClient";

const API_URL = import.meta.env.VITE_API_URL || "";

let accessToken: string | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
  localStorage.setItem("accessToken", token);
}

export function getAccessToken(): string | null {
  if (!accessToken) {
    accessToken = localStorage.getItem("accessToken");
  }
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (res.ok) {
      const data = await res.json();
      setAccessToken(data.accessToken);
      return data.accessToken;
    }
  } catch (error) {
    console.error("Token refresh failed:", error);
  }

  clearAccessToken();
  return null;
}

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  let token = getAccessToken();

  const headers: HeadersInit = {
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 403) {
    token = await refreshAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });
    }
  }

  return res;
}
