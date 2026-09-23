import { execFile } from "node:child_process";
import type { NotificationEvent } from "../core/events.js";
import type { EventProvider, ProviderPollResult } from "../core/providers.js";

function getDebugMessage(): Promise<string> {
  const fallback = `Le moteur de notifications fonctionne (${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}).`;

  return new Promise((resolve) => {
    execFile("fortune", ["-s"], { timeout: 2_000, maxBuffer: 16_384 }, (error, stdout) => {
      const fortune = stdout.trim();
      resolve(!error && fortune ? fortune : fallback);
    });
  });
}

export class DebugProvider implements EventProvider {
  readonly name = "internal-debug";
  readonly topics = ["system.debug"] as const;
  readonly pollIntervalSeconds: number;

  constructor(private readonly intervalMinutes: number) {
    this.pollIntervalSeconds = intervalMinutes * 60;
  }

  async poll(): Promise<ProviderPollResult> {
    const intervalMs = this.intervalMinutes * 60_000;
    const bucketStartMs = Math.floor(Date.now() / intervalMs) * intervalMs;
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + 5 * 60_000);

    const event: NotificationEvent = {
      eventId: `debug:${new Date(bucketStartMs).toISOString()}`,
      topic: "system.debug",
      source: this.name,
      title: "Notification debug",
      message: await getDebugMessage(),
      priority: "default",
      startsAt,
      expiresAt,
      metadata: { intervalMinutes: this.intervalMinutes }
    };
    return { events: [event], observations: [] };
  }
}
