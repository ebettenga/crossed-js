import { commonConfig } from './config-common';
import { config as localConfig } from './config-local';
import { config as ciConfig } from './config-ci';

export const getConfig = () => {
  const env = process.env.NODE_ENV || 'local';

  try {
    let config;
    if (process.env.CI === 'true') {
      config = { ...commonConfig, ...ciConfig };
    } else {
      config = { ...commonConfig, ...localConfig };
    }

    // Set timezone from config
    process.env.TZ = config.timezone;
    
    return config;
  } catch (e) {
    throw Error('Unknown environment, unable to load config');
  }
};

export const config = getConfig();
