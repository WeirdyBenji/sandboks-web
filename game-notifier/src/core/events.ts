export type EventPriority = "min" | "low" | "default" | "high" | "max";

export interface NotificationEvent {
  eventId: string;
  topic: string;
  source: string;
  title: string;
  message: string;
  priority: EventPriority;
  startsAt?: Date;
  expiresAt?: Date;
  url?: string;
  metadata: Record<string, unknown>;
}

export interface StoredEvent extends NotificationEvent {
  status: "active" | "expired";
  createdAt: Date;
}
