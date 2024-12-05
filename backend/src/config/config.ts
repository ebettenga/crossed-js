import { commonConfig } from './config-common';
import { config as localConfig } from './config-local';
import { config as ciConfig } from './config-ci';

export const getConfig = () => {
  const env = process.env.NODE_ENV || 'local';

  try {
    if (process.env.CI === 'true') {
      return { ...commonConfig, ...ciConfig };
    }
    return { ...commonConfig, ...localConfig };
  } catch (e) {
    throw Error('Unknown environment, unable to load config');
  }
};

export const config = getConfig();
