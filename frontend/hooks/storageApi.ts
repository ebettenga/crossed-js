import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const storage = {
  set: async (key: string, value: any) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Error storing value:', e);
    }
  },
  get: async (key: string) => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      console.error('Error retrieving value:', e);
      return null;
    }
  },
  getString: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.error('Error retrieving string:', e);
      return null;
    }
  },
  remove: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error('Error removing value:', e);
    }
  }
}; 



export const secureStorage = {
  set: async (key: string, value: any) => {
    try {
      await SecureStore.setItemAsync(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) {
      console.error('Error storing value:', e);
    }
  },
  get: async (key: string) => {
    try {
      const value = await SecureStore.getItemAsync(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      console.error('Error retrieving value:', e);
      return null;
    }
  },
  getString: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.error('Error retrieving string:', e);
      return null;
    }
  },
  remove: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.error('Error removing value:', e);
    }
  }
}; 