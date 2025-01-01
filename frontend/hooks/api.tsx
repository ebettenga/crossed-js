import { config } from "@/config/config";
import { secureStorage } from "./storageApi";

const headers = (token: string) => {
  return {
    "authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };
};

export const get = async (url: string) => {
  try {
    const token = await secureStorage.get("token");
    console.log(token);
    const response = await fetch(`${config.api.baseURL}${url}`, {
      method: 'GET',
      headers: headers(token)
    });
    return await response.json();
  } catch (error) {
    await log({ message: 'GET request failed', error, time: new Date().toISOString() }, 'error');
    throw error;
  }
};

export const post = async (url: string, body: any) => {
  try {
    const token = await secureStorage.get("token");
    const response = await fetch(`${config.api.baseURL}${url}`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (error) {
    await log({ message: 'POST request failed', error, time: new Date().toISOString() }, 'error');
    throw error;
  }
};

export const put = async (url: string, body: any) => {
  try {
    const token = await secureStorage.get("token");
    const response = await fetch(`${config.api.baseURL}${url}`, {
      method: 'PUT',
      headers: headers(token),
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (error) {
    await log({ message: 'PUT request failed', error, time: new Date().toISOString() }, 'error');
    throw error;
  }
};

export const del = async (url: string) => {
  try {
    const token = await secureStorage.get("token");
    const response = await fetch(`${config.api.baseURL}${url}`, {
      method: 'DELETE',
      headers: headers(token)
    });
    return await response.json();
  } catch (error) {
    await log({ message: 'DELETE request failed', error, time: new Date().toISOString() }, 'error');
    throw error;
  }
};


export const log = async (data: Record<string, any> | string, severity: 'info' | 'warning' | 'error' | 'debug' | 'trace') => {

  const payload = {
    log: data,
    severity
  };

  try {
    const token = await secureStorage.get("token");
    const response = await fetch(`${config.api.baseURL}/logs`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error('LOG request failed', error);
  }
};
