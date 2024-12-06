import Fastify from 'fastify';
import { config } from './config/config';

export const fastify = Fastify({
  logger: config.logger
});
