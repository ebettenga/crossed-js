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

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (error: any) => void; }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

async function refreshToken(): Promise<string> {
  try {
    const refresh_token = await secureStorage.get("refresh_token");
    if (!refresh_token) throw new Error("No refresh token");

    const response = await fetch(`${config.api.baseURL}/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token }),
    });

    if (!response.ok) {
      throw new Error("Failed to refresh token");
    }

    const data = await response.json();
    await secureStorage.set("token", data.access_token);
    return data.access_token;
  } catch (error) {
    await secureStorage.remove("token");
    await secureStorage.remove("refresh_token");
    throw error;
  }
}

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

  const shouldSendJson =
    ["POST", "PATCH", "PUT", "DELETE"].includes(method) &&
    body !== undefined &&
    !(body instanceof FormData);

  if (shouldSendJson) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = await secureStorage.get("token");
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: requestHeaders,
      body: body instanceof FormData ? body : JSON.stringify(body),
    });

    // Handle token refresh
    if (response.status === 403 && auth) {
      if (isRefreshing) {
        // Wait for the token to be refreshed
        const token = await new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
        requestHeaders["Authorization"] = `Bearer ${token}`;
        return request<T>(endpoint, method, body, options);
      }

      isRefreshing = true;

      try {
        const newToken = await refreshToken();
        isRefreshing = false;
        processQueue(null, newToken);
        requestHeaders["Authorization"] = `Bearer ${newToken}`;
        await secureStorage.set("token", newToken);
        return request<T>(endpoint, method, body, options);
      } catch (error) {
        isRefreshing = false;
        processQueue(error);
        throw error;
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message =
        error?.message ||
        error?.error ||
        `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return response.json();
  } catch (error) {
    throw error;
  }
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

export function del<T>(
  endpoint: string,
  bodyOrOptions?: any,
  maybeOptions?: RequestOptions,
): Promise<T> {
  const isOptionsObject =
    bodyOrOptions &&
    !Array.isArray(bodyOrOptions) &&
    typeof bodyOrOptions === "object" &&
    (Object.prototype.hasOwnProperty.call(bodyOrOptions, "auth") ||
      Object.prototype.hasOwnProperty.call(bodyOrOptions, "params") ||
      Object.prototype.hasOwnProperty.call(bodyOrOptions, "headers"));

  if (isOptionsObject && maybeOptions === undefined) {
    return request<T>(endpoint, "DELETE", undefined, bodyOrOptions);
  }

  return request<T>(endpoint, "DELETE", bodyOrOptions, maybeOptions);
}
