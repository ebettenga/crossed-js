import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLogger } from "./useLogs";

const ELO_VISIBILITY_KEY = "@crossed_js:elo_visibility";

export const useEloVisibility = () => {
  const [isEloVisible, setIsEloVisible] = useState(true);
  const logger = useLogger();

  useEffect(() => {
    // Load saved preference
    const loadEloVisibility = async () => {
      try {
        const savedValue = await AsyncStorage.getItem(ELO_VISIBILITY_KEY);
        if (savedValue !== null) {
          setIsEloVisible(JSON.parse(savedValue));
        }
      } catch (error) {
        logger.mutate({
          log: { context: "loadEloVisibility failed in useEloVisibility" },
          severity: "error",
        });
        console.error("Error loading ELO visibility:", error);
      }
    };

    loadEloVisibility();
  }, []);

  const setEloVisibility = async (value: boolean) => {
    try {
      await AsyncStorage.setItem(ELO_VISIBILITY_KEY, JSON.stringify(value));
      setIsEloVisible(value);
    } catch (error) {
      logger.mutate({
        log: { context: "setEloVisibility failed in useEloVisibility" },
        severity: "error",
      });
      console.error("Error saving ELO visibility:", error);
    }
  };

  return {
    isEloVisible,
    setEloVisibility,
  };
};
