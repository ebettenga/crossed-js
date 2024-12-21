import { commonConfig } from "./config.common";
import { localConfig } from "./config.local";

export const getConfig = () => {
  const env = process.env.NODE_ENV || "local";

  try {
    return { ...commonConfig, ...localConfig };
  } catch (e) {
    throw Error("Unknown environment, unable to load config");
  }
};

export const config = getConfig();
