import 'reflect-metadata';
import { FastifyInstance } from 'fastify';
import dbConnection from 'typeorm-fastify-plugin';
import { config } from './config/config';
import { DataSource } from 'typeorm';

export async function registerDb(fastify: FastifyInstance) {
  fastify.register(dbConnection, config.db);
}



export const AppDataSource = new DataSource(config.db);
