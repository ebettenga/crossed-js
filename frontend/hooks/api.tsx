import { secureStorage } from "./storageApi";
import { config } from "../config/config";

export type RequestOptions = {
  auth?: boolean;
  params?: Record<string, string>;
  headers?: Record<string, string>;
};

const defaultOptions: RequestOptions = {
  auth: true,
};

async function request<T>(
  endpoint: string,
  method: string,
  body?: any,
  options: RequestOptions = defaultOptions,
): Promise<T> {
  const { auth = true, params, headers = {} } = options;

  // Ensure endpoint starts with a slash
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Manually construct the full URL to preserve the /api path
  const fullUrl = `${config.api.baseURL}${cleanEndpoint}`;
  const url = new URL(fullUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const requestHeaders: Record<string, string> = {
    ...headers,
  };

  if (!(body instanceof FormData)) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = await secureStorage.get("token");
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: requestHeaders,
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "An error occurred");
  }

  return response.json();
}

export function get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  return request<T>(endpoint, "GET", undefined, options);
}

export function post<T>(
  endpoint: string,
  body?: any,
  options?: RequestOptions,
): Promise<T> {
  return request<T>(endpoint, "POST", body, options);
}

export function patch<T>(
  endpoint: string,
  body?: any,
  options?: RequestOptions,
): Promise<T> {
  return request<T>(endpoint, "PATCH", body, options);
}

export function del<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  return request<T>(endpoint, "DELETE", undefined, options);
}
