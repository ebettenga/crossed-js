import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const storage = {
  set: async (key: string, value: any) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Error storing value:", e);
    }
  },
  get: async (key: string) => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? value : null;
    } catch (e) {
      console.error("Error retrieving value:", e);
      return null;
    }
  },
  getJSON: async (key: string) => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      console.error("Error retrieving JSON:", e);
      return null;
    }
  },
  getString: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.error("Error retrieving string:", e);
      return null;
    }
  },
  remove: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error("Error removing value:", e);
    }
  },
};

const webStorage = {
  set: async (key: string, value: any) => {
    try {
      localStorage.setItem(
        key,
        typeof value === "string" ? value : JSON.stringify(value),
      );
    } catch (e) {
      console.error("Error storing value:", e);
    }
  },
  get: (key: string) => {
    try {
      const value = localStorage.getItem(key);
      return value ? value : null;
    } catch (e) {
      console.error("Error retrieving value:", e);
      return null;
    }
  },
  getJSON: (key: string) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      console.error("Error retrieving JSON:", e);
      return null;
    }
  },
  getString: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error("Error retrieving string:", e);
      return null;
    }
  },
  remove: async (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error("Error removing value:", e);
    }
  },
};

export const secureStorage = Platform.select({
  web: webStorage,
  default: {
    set: async (key: string, value: any) => {
      try {
        await SecureStore.setItemAsync(
          key,
          typeof value === "string" ? value : JSON.stringify(value),
        );
      } catch (e) {
        console.error("Error storing value:", e);
      }
    },
    get: (key: string) => {
      try {
        const value = SecureStore.getItem(key);
        return value ? value : null;
      } catch (e) {
        console.error("Error retrieving value:", e);
        return null;
      }
    },
    getJSON: (key: string) => {
      try {
        const value = SecureStore.getItem(key);
        return value ? JSON.parse(value) : null;
      } catch (e) {
        console.error("Error retrieving JSON:", e);
        return null;
      }
    },
    getString: (key: string) => {
      try {
        return SecureStore.getItem(key) as string;
      } catch (e) {
        console.error("Error retrieving string:", e);
        return null;
      }
    },
    remove: async (key: string) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (e) {
        console.error("Error removing value:", e);
      }
    },
  },
});
