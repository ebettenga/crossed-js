import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  RouteHandlerMethod,
} from "fastify";
import fp from "fastify-plugin";
import { config } from "../config/config";
import { redisService } from "../services/RedisService";

type ResponseCacheEntry<T = unknown> = {
  statusCode: number;
  payload: T;
};

export type ResponseCacheOptions<
  RequestType extends FastifyRequest = FastifyRequest,
> = {
  key: (request: RequestType) => string | Promise<string>;
  ttlSeconds?: number;
  shouldCache?: (request: RequestType) => boolean | Promise<boolean>;
};

declare module "fastify" {
  interface FastifyInstance {
    withResponseCache<
      Handler extends RouteHandlerMethod = RouteHandlerMethod,
    >(
      options: ResponseCacheOptions<Parameters<Handler>[0]>,
      handler: Handler,
    ): Handler;
  }
}

const responseCachePlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.decorate(
    "withResponseCache",
    function withResponseCache<
      Handler extends RouteHandlerMethod = RouteHandlerMethod,
    >(
      this: FastifyInstance,
      options: ResponseCacheOptions<Parameters<Handler>[0]>,
      handler: Handler,
    ): Handler {
      type RequestType = Parameters<Handler>[0];
      type ReplyType = Parameters<Handler>[1];

      const ttlSeconds = options.ttlSeconds ??
        config.redis.responseCacheTTL ??
        10;

      const instance = this;

      const wrapped = (async function (
        request: RequestType,
        reply: ReplyType,
      ) {
        const shouldCache = options.shouldCache
          ? await options.shouldCache(request)
          : true;

        if (!shouldCache) {
          return handler.call(instance, request, reply);
        }

        let cacheKeySuffix: string | undefined;
        try {
          cacheKeySuffix = await options.key(request);
        } catch (err) {
          request.log.error({ err }, "Failed to build cache key");
          return handler.call(instance, request, reply);
        }

        if (!cacheKeySuffix) {
          return handler.call(instance, request, reply);
        }

        const cacheKey = `route_cache:${cacheKeySuffix}`;

        try {
          const cached = await redisService.getJSON<ResponseCacheEntry>(
            cacheKey,
          );
          if (cached) {
            reply.header("x-cache-hit", "1");
            if (cached.statusCode) {
              reply.code(cached.statusCode);
            }
            return cached.payload;
          }
        } catch (err) {
          request.log.warn({ err, cacheKey }, "Failed to read response cache");
        }

        const result = await handler.call(instance, request, reply);

        if (result === undefined || reply.statusCode >= 400) {
          return result;
        }

        try {
          await redisService.setJSON(
            cacheKey,
            {
              statusCode: reply.statusCode,
              payload: result,
            },
            ttlSeconds,
          );
          reply.header("x-cache-hit", "0");
        } catch (err) {
          request.log.warn({ err, cacheKey }, "Failed to write response cache");
        }

        return result;
      }) as Handler;

      return wrapped;
    },
  );
});

export default responseCachePlugin;
