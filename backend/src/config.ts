import dotenv from "dotenv";
dotenv.config();
export const config = {
  port: Number(process.env.PORT || 4000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  sessionSecret: process.env.SESSION_SECRET || "development-only-change-me",
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "reachuser",
    password: process.env.MYSQL_PASSWORD || "reachpass",
    database: process.env.MYSQL_DATABASE || "reachinbox"
  },
  redis: { host: process.env.REDIS_HOST || "127.0.0.1", port: Number(process.env.REDIS_PORT || 6379) },
  elasticUrl: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
  googleId: process.env.GOOGLE_CLIENT_ID || "",
  googleSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallback: process.env.GOOGLE_CALLBACK_URL || "http://localhost:4000/auth/google/callback",
  slackId: process.env.SLACK_CLIENT_ID || "",
  slackSecret: process.env.SLACK_CLIENT_SECRET || "",
  slackCallback: process.env.SLACK_CALLBACK_URL || "http://localhost:4000/auth/slack/callback",
  concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
  minInterval: Number(process.env.MIN_SEND_INTERVAL_MS || 1000),
  hourlyLimit: Number(process.env.MAX_EMAILS_PER_HOUR || 100)
};
