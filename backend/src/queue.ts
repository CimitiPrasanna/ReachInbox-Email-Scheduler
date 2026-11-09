import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config";

export const redis = new IORedis({ ...config.redis, maxRetriesPerRequest: null });
export const emailQueue = new Queue("email-queue", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3, backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 1000, removeOnFail: 2000
  }
});
