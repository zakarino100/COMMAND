import { logger } from "./logger.js";

export async function sendDiscordNotification(message: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn("DISCORD_WEBHOOK_URL not set, skipping notification");
    return;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Discord webhook returned non-OK status");
    }
  } catch (err) {
    logger.error({ err }, "Failed to send Discord notification");
  }
}
