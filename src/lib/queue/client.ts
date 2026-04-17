import IORedis from "ioredis";
import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL;
const hasUsableRedisUrl =
  typeof redisUrl === "string" &&
  redisUrl.length > 0 &&
  !redisUrl.includes("...") &&
  /^(redis|rediss):\/\//.test(redisUrl);

export const queueConnection = hasUsableRedisUrl
  ? new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 1500,
    })
  : null;

export const emailQueue = queueConnection
  ? new Queue("email", { connection: queueConnection })
  : null;
