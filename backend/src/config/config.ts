import { commonConfig } from "./config-common";
import { config as localConfig } from "./config-local";
import { config as ciConfig } from "./config-ci";
import { config as productionConfig } from "./config-production";
export const getConfig = () => {
  const env = process.env.NODE_ENV;

  switch (env) {
    case "production":
      return { ...commonConfig, ...productionConfig };
    default:
      if (process.env.CI === "true") {
        return { ...commonConfig, ...ciConfig };
      }
      return { ...commonConfig, ...localConfig };
  }
};

export const config = getConfig();
