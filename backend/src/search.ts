import { Client } from "@elastic/elasticsearch";
import { config } from "./config";
export const es = new Client({ node: config.elasticUrl });

export async function indexEmail(email: {
  id: number; user_id: number; recipient: string; subject: string; body: string;
  status: string; scheduled_at: Date; sent_at?: Date | null
}) {
  try {
    await es.index({
      index: "reachinbox-emails",
      id: String(email.id),
      document: { ...email, scheduled_at: email.scheduled_at, sent_at: email.sent_at || null }
    });
  } catch (error) {
    console.error("Elasticsearch indexing skipped:", (error as Error).message);
  }
}
