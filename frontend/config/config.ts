import { commonConfig } from "./config.common";
import { localConfig } from "./config.local";
import { productionConfig } from "./config.production";

export const getConfig = () => {
  const env = process.env.NODE_ENV || "local";

  try {
    if (env === "production") {
      return { ...commonConfig, ...productionConfig };
    }

    return { ...commonConfig, ...localConfig };
  } catch (e) {
    throw Error("Unknown environment, unable to load config");
  }
};

export const config = getConfig();
