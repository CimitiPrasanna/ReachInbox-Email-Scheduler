
import mysql from "mysql2/promise";
import { config } from "./config";

export const pool = mysql.createPool({
  ...config.mysql,

  // Secure TLS connection for TiDB Cloud
  ssl: {
    minVersion: "TLSv1.2"
  },

  waitForConnections: true,
  connectionLimit: 10,
  timezone: "Z",
  dateStrings: false
});

export async function initDb() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      google_id VARCHAR(255) UNIQUE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      avatar TEXT,
      slack_access_token TEXT,
      slack_team_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS emails (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      recipient VARCHAR(320) NOT NULL,
      subject VARCHAR(998) NOT NULL,
      body MEDIUMTEXT NOT NULL,
      scheduled_at DATETIME(3) NOT NULL,
      sent_at DATETIME(3) NULL,
      status ENUM(
        'scheduled',
        'processing',
        'sent',
        'failed'
      ) NOT NULL DEFAULT 'scheduled',
      idempotency_key VARCHAR(255) NOT NULL UNIQUE,
      error_message TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_status (user_id, status),
      CONSTRAINT fk_email_user
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log("Database tables initialized successfully");
}
