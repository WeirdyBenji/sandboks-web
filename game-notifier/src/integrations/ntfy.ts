import type { NotificationEvent } from "../core/events.js";

export class NtfyIntegration {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly token: string | undefined,
    private readonly topicMap: Record<string, string>
  ) {}

  topicFor(eventTopic: string): string | undefined {
    return this.baseUrl ? this.topicMap[eventTopic] : undefined;
  }

  async send(event: NotificationEvent): Promise<string | undefined> {
    const topic = this.topicFor(event.topic);
    if (!this.baseUrl || !topic) return undefined;
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "title": encodeHeader(event.title),
        "priority": event.priority,
        "tags": event.topic.replaceAll(".", ","),
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
      },
      body: `${event.message}${event.url ? `\n${event.url}` : ""}`
    });
    if (!response.ok) throw new Error(`ntfy returned HTTP ${response.status}`);
    return topic;
  }
}

function encodeHeader(value: string): string {
  const normalized = value.replace(/[\r\n]/g, " ");
  return /^[\x20-\x7e]*$/.test(normalized)
    ? normalized
    : `=?UTF-8?B?${Buffer.from(normalized, "utf8").toString("base64")}?=`;
}
