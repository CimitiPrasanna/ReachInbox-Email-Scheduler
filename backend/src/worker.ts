
import { Worker, Job, DelayedError } from "bullmq";
import { redis } from "./queue";
import { config } from "./config";
import { pool, initDb } from "./db";
import { getTransporter } from "./mailer";
import { indexEmail } from "./search";
import { notifySlack } from "./slack";

type Payload = {
  emailId: number;
  hourlyLimit?: number;
};

async function processEmail(job: Job<Payload>, token?: string) {
  // ==========================================
  // VALIDATE JOB DATA
  // ==========================================

  console.log("Processing job:", job.id);
  console.log("Job payload:", job.data);

  const emailId = Number(job.data?.emailId);

  if (!Number.isInteger(emailId) || emailId <= 0) {
    throw new Error(
      `Invalid emailId in BullMQ job ${job.id}. Payload: ${JSON.stringify(job.data)}`
    );
  }

  // ==========================================
  // FETCH EMAIL FROM MYSQL
  // ==========================================

  const [rows] = await pool.execute<any[]>(
    "SELECT * FROM emails WHERE id = ?",
    [emailId]
  );

  const email = rows[0];

  if (!email) {
    console.error(`Email record not found: ${emailId}`);
    return;
  }

  if (email.status === "sent") {
    console.log(`Email ${emailId} already sent`);
    return;
  }

  if (
    email.recipient == null ||
    email.subject == null ||
    email.body == null ||
    email.user_id == null
  ) {
    throw new Error(
      `Email ${emailId} has missing recipient, subject, body or user_id`
    );
  }

  // ==========================================
  // HOURLY RATE LIMIT
  // ==========================================

  const limit = Math.max(
    1,
    Number(job.data.hourlyLimit) || config.hourlyLimit
  );

  const window = Math.floor(Date.now() / 3600000);
  const counterKey = `reachinbox:hour:${window}`;

  const count = await redis.incr(counterKey);

  if (count === 1) {
    await redis.expire(counterKey, 3700);
  }

  if (count > limit) {
    await redis.decr(counterKey);

    const nextHour = (window + 1) * 3600000;

    await pool.execute(
      "UPDATE emails SET status = 'scheduled' WHERE id = ? AND status != 'sent'",
      [email.id]
    );

    const noticeKey =
      `reachinbox:slack-limit-notice:${email.user_id}:${window}`;

    const firstNotice = await redis.set(
      noticeKey,
      "1",
      "EX",
      3700,
      "NX"
    );

    if (firstNotice) {
      await notifySlack(
        Number(email.user_id),
        `ReachInbox hourly sending limit (${limit}) reached. Remaining messages have been delayed until the next hourly window.`
      );
    }

    if (!token) {
      throw new Error("BullMQ job token is missing; cannot delay job");
    }

    await job.moveToDelayed(nextHour, token);
    throw new DelayedError();
  }

  // ==========================================
  // CLAIM EMAIL RECORD
  // ==========================================

  const [claim]: any = await pool.execute(
    "UPDATE emails SET status = 'processing' WHERE id = ? AND status = 'scheduled'",
    [email.id]
  );

  if (claim.affectedRows === 0) {
    await redis.decr(counterKey);
    console.log(`Email ${emailId} was already claimed or processed`);
    return;
  }

  // ==========================================
  // MINIMUM SEND INTERVAL
  // ==========================================

  const lastKey = "reachinbox:last-send-at";

  const last = Number(await redis.get(lastKey) || 0);

  const wait = Math.max(
    0,
    config.minInterval - (Date.now() - last)
  );

  if (wait > 0) {
    await pool.execute(
      "UPDATE emails SET status = 'scheduled' WHERE id = ?",
      [email.id]
    );

    await redis.decr(counterKey);

    if (!token) {
      throw new Error("BullMQ job token is missing; cannot delay job");
    }

    await job.moveToDelayed(Date.now() + wait, token);
    throw new DelayedError();
  }

  await redis.set(lastKey, String(Date.now()));

  // ==========================================
  // SEND EMAIL
  // ==========================================

  try {
    const transporter = await getTransporter();

    const info = await transporter.sendMail({
      from: '"ReachInbox Demo" <no-reply@reachinbox.test>',
      to: email.recipient,
      subject: email.subject,
      text: email.body
    });

    const sentAt = new Date();

    await pool.execute(
      "UPDATE emails SET status = 'sent', sent_at = ? WHERE id = ?",
      [sentAt, email.id]
    );

    await indexEmail({
      ...email,
      status: "sent",
      sent_at: sentAt
    });

    const nodemailer = await import("nodemailer");

    console.log(
      "Ethereal preview:",
      nodemailer.default.getTestMessageUrl(info)
    );

    console.log(`Email ${emailId} sent successfully`);

  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error ?? "Unknown email sending error");

    await pool.execute(
      "UPDATE emails SET status = 'failed', error_message = ? WHERE id = ?",
      [errorMessage, email.id]
    );

    await indexEmail({
      ...email,
      status: "failed"
    });

    throw error;
  }
}

// ==========================================
// START WORKER
// ==========================================

async function startWorker() {
  await initDb();

  const worker = new Worker<Payload>(
    "email-queue",
    processEmail,
    {
      connection: redis,
      concurrency: config.concurrency
    }
  );

  worker.on("completed", (job) => {
    console.log(`Completed job ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(
      `Job ${job?.id} failed:`,
      error.message
    );
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  console.log(
    `Email worker started with concurrency ${config.concurrency}`
  );
}

startWorker().catch((error) => {
  console.error("Worker startup failed:", error);
  process.exit(1);
});
