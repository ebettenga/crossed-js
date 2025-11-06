import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { secureStorage } from "./storageApi";

const CURRENT_TOKEN_STORAGE_KEY = "notifications:expoPushToken";
const LAST_SYNCED_TOKEN_STORAGE_KEY = "notifications:lastSyncedExpoPushToken";

type PermissionStatus = Notifications.PermissionStatus | null;

type UsePushNotificationsResult = {
  token: string | null;
  lastSyncedToken: string | null;
  permissionStatus: PermissionStatus;
  shouldSyncWithBackend: boolean;
  isDevice: boolean;
  refreshToken: () => Promise<string | null>;
  markTokenSynced: (token: string | null) => Promise<void>;
  clearStoredToken: () => Promise<void>;
};

const resolveProjectId = () => {
  const expoProjectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  return typeof expoProjectId === "string" ? expoProjectId : undefined;
};

const ensureAndroidNotificationChannel = async () => {
  if (Platform.OS !== "android") {
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
  } catch (error) {
    console.warn("Failed to configure Android notification channel", error);
  }
};

export const usePushNotifications = (): UsePushNotificationsResult => {
  const [token, setToken] = useState<string | null>(null);
  const [lastSyncedToken, setLastSyncedToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus>(null);
  const isMountedRef = useRef(true);
  const isDevice = Device.isDevice;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    ensureAndroidNotificationChannel();
  }, []);

  useEffect(() => {
    const loadStoredTokens = async () => {
      try {
        const [storedToken, storedLastSynced] = await Promise.all([
          secureStorage.get(CURRENT_TOKEN_STORAGE_KEY),
          secureStorage.get(LAST_SYNCED_TOKEN_STORAGE_KEY),
        ]);

        if (!isMountedRef.current) return;
        setToken(storedToken ?? null);
        setLastSyncedToken(storedLastSynced ?? null);
      } catch (error) {
        console.warn("Failed to load stored push tokens", error);
      }
    };

    loadStoredTokens();
  }, []);

  const persistCurrentToken = useCallback(async (value: string | null) => {
    if (!value) {
      await secureStorage.remove(CURRENT_TOKEN_STORAGE_KEY);
      if (isMountedRef.current) {
        setToken(null);
      }
      return;
    }

    await secureStorage.set(CURRENT_TOKEN_STORAGE_KEY, value);
    if (isMountedRef.current) {
      setToken(value);
    }
  }, []);

  const refreshToken = useCallback(async () => {
    if (!isDevice) {
      console.warn("Push notifications are only available on physical devices");
      await persistCurrentToken(null);
      return null;
    }

    try {
      const existingSettings = await Notifications.getPermissionsAsync();
      let status = existingSettings.status;

      if (status !== "granted") {
        const request = await Notifications.requestPermissionsAsync();
        status = request.status;
      }

      if (isMountedRef.current) {
        setPermissionStatus(status);
      }

      if (status !== "granted") {
        await persistCurrentToken(null);
        return null;
      }

      const projectId = resolveProjectId();
      const pushToken = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );

      const tokenValue = pushToken.data;
      await persistCurrentToken(tokenValue);
      return tokenValue;
    } catch (error) {
      console.warn("Failed to refresh Expo push token", error);
      await persistCurrentToken(null);
      return null;
    }
  }, [isDevice, persistCurrentToken]);

  const markTokenSynced = useCallback(async (value: string | null) => {
    if (!value) {
      await secureStorage.remove(LAST_SYNCED_TOKEN_STORAGE_KEY);
      if (isMountedRef.current) {
        setLastSyncedToken(null);
      }
      return;
    }

    await secureStorage.set(LAST_SYNCED_TOKEN_STORAGE_KEY, value);
    if (isMountedRef.current) {
      setLastSyncedToken(value);
    }
  }, []);

  const clearStoredToken = useCallback(async () => {
    await secureStorage.remove(CURRENT_TOKEN_STORAGE_KEY);
    await secureStorage.remove(LAST_SYNCED_TOKEN_STORAGE_KEY);
    if (isMountedRef.current) {
      setToken(null);
      setLastSyncedToken(null);
    }
  }, []);

  const shouldSyncWithBackend = useMemo(() => {
    if (!token) {
      return false;
    }
    if (!lastSyncedToken) {
      return true;
    }
    return token !== lastSyncedToken;
  }, [token, lastSyncedToken]);

  return {
    token,
    lastSyncedToken,
    permissionStatus,
    shouldSyncWithBackend,
    isDevice,
    refreshToken,
    markTokenSynced,
    clearStoredToken,
  };
};

export default usePushNotifications;

export const getStoredExpoPushToken = async (): Promise<string | null> => {
  try {
    return await secureStorage.get(CURRENT_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to load stored Expo push token", error);
    return null;
  }
};
