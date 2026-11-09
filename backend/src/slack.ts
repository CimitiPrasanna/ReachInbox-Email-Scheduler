import axios from "axios";
import { pool } from "./db";

export async function notifySlack(userId: number, message: string) {
  const [rows] = await pool.execute<any[]>(
    "SELECT slack_access_token FROM users WHERE id = ?", [userId]
  );
  const token = rows[0]?.slack_access_token;
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!token || !channel) {
    console.warn("Slack notification skipped: connect Slack and set SLACK_CHANNEL_ID.");
    return;
  }
  try {
    const result = await axios.post("https://slack.com/api/chat.postMessage",
      { channel, text: message },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" } }
    );
    if (!result.data.ok) console.error("Slack API rejected notification:", result.data.error);
  } catch (e) {
    console.error("Slack notification failed:", (e as Error).message);
  }
}
