// configs/redis.js

import Redis from "ioredis";
import { REDIS_DB, REDIS_HOST, REDIS_PORT, REDIS_PW } from "./envConfig";

//자동으로 Redis 연결을 시도함
export const redisInst = new Redis({
  host: REDIS_HOST,
  password: REDIS_PW,
  port: parseInt(REDIS_PORT),
  db: parseInt(REDIS_DB),
});

export function disconnectToRedis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!redisInst) {
      console.log("Redis에 연결되어 있지 않음");
      resolve();
    }

    redisInst.quit((error, reply) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
