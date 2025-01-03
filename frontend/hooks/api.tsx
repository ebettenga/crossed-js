import { config } from "@/config/config";
import { secureStorage } from "./storageApi";

const headers = (token: string) => {
  return {
    "authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };
};


const getToken = async () => {
  const token = await secureStorage.get("token");
  if (!token) {
    throw new Error("No token found");
  }
  return token;
};

export const get = async (url: string) => {
  try {
    const token = await getToken();
    const response = await fetch(`${config.api.baseURL}${url}`, {
      method: 'GET',
      headers: headers(token)
    });
    return await response.json();
  } catch (error) {
    throw error;
  }
};

type RequestOptions = {
  auth?: boolean;
}

export const post = async (url: string, body: any, options: RequestOptions = { auth: true }) => {
  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json"
    };

    if (options.auth) {
      const token = await getToken();
      headers["authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${config.api.baseURL}${url}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const put = async (url: string, body: any) => {
  try {
    const token = await getToken();
    const response = await fetch(`${config.api.baseURL}${url}`, {
      method: 'PUT',
      headers: headers(token),
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const del = async (url: string) => {
  try {
    const token = await getToken();
    const response = await fetch(`${config.api.baseURL}${url}`, {
      method: 'DELETE',
      headers: headers(token)
    });
    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const postWithoutAuth = async (url: string, body: any) => {
  try {
    const response = await fetch(`${config.api.baseURL}${url}`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const log = async (data: Record<string, any> | string, severity: 'info' | 'warning' | 'error' | 'debug' | 'trace') => {

  const payload = {
    log: data,
    severity
  };
  const token = await getToken();

  if (!token) {
    console.error("No token found");
    return;
  }

  const response = await fetch(`${config.api.baseURL}/logs`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(payload)
  });
  return await response.json();
};
