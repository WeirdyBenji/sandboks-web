import type { NotificationEvent, StoredEvent } from "./events.js";
import type { Store } from "../db/store.js";
import type { DiscordIntegration } from "../integrations/discord.js";
import type { NtfyIntegration } from "../integrations/ntfy.js";

export class Dispatcher {
  constructor(
    private readonly store: Store,
    private readonly discord: DiscordIntegration,
    private readonly ntfy: NtfyIntegration,
    private readonly expiredMessageAction: "delete" | "mark"
  ) {}

  async dispatch(event: NotificationEvent): Promise<void> {
    const jobs: Promise<void>[] = [];
    if (this.ntfy.topicFor(event.topic)) {
      jobs.push(this.deliverNtfy(event));
    }

    if (this.discord.enabled) {
      for (const target of this.store.getDeliveryTargets(event.topic)) {
        if (target.deliveryMode === "dm") {
          jobs.push(this.deliverDiscordDm(event, target.targetId));
        } else if (target.deliveryMode === "webhook") {
          jobs.push(this.deliverDiscordWebhook(event, target));
        } else {
          jobs.push(this.deliverDiscordChannel(event, target.targetId));
        }
      }
    }

    await Promise.all(jobs);
  }

  async expire(event: StoredEvent): Promise<void> {
    if (this.discord.enabled) {
      for (const reference of this.store.getDiscordMessages(event.eventId)) {
        try {
          if (event.topic === "warframe.invasions" || this.expiredMessageAction === "delete") {
            await this.discord.deleteMessage(reference);
            this.store.markDiscordMessageDeleted(event.eventId, reference.channelId);
          } else {
            await this.discord.markExpired(reference);
            this.store.markDiscordMessageExpired(event.eventId, reference.channelId);
          }
        } catch (error) {
          console.error("Unable to expire Discord message", { eventId: event.eventId, channelId: reference.channelId, error });
        }
      }
    }
    this.store.markEventExpired(event.eventId);
  }

  async refresh(storedEvent: StoredEvent, currentEvent: NotificationEvent): Promise<void> {
    const refreshedEvent: NotificationEvent = {
      ...currentEvent,
      eventId: storedEvent.eventId,
      metadata: {
        ...currentEvent.metadata,
        ...(storedEvent.metadata.manual === true ? {
          manual: true,
          originalEventId: storedEvent.metadata.originalEventId
        } : {})
      }
    };
    let updateSucceeded = true;
    if (this.discord.enabled) {
      for (const reference of this.store.getDiscordMessages(storedEvent.eventId)) {
        try {
          if (!await this.discord.updateMessage(reference, refreshedEvent)) {
            this.store.markDiscordMessageDeleted(storedEvent.eventId, reference.channelId);
          }
        } catch (error) {
          updateSucceeded = false;
          console.error("Unable to refresh Discord message", {
            eventId: storedEvent.eventId,
            channelId: reference.channelId,
            error
          });
        }
      }
    }
    if (updateSucceeded) this.store.updateEvent(storedEvent.eventId, refreshedEvent);
  }

  private async deliverDiscordChannel(event: NotificationEvent, channelId: string): Promise<void> {
    await this.deliver(event, "discord-channel", channelId, async () => {
      const reference = await this.discord.sendToChannel(channelId, event);
      this.store.saveDiscordMessage(event.eventId, reference.channelId, reference.messageId);
    });
  }

  private async deliverDiscordWebhook(
    event: NotificationEvent,
    target: { targetId: string; webhookId?: string; webhookToken?: string }
  ): Promise<void> {
    await this.deliver(event, "discord-channel", target.targetId, async () => {
      if (!target.webhookId || !target.webhookToken) throw new Error(`Webhook is not configured for channel ${target.targetId}`);
      const reference = await this.discord.sendToWebhook({
        channelId: target.targetId,
        webhookId: target.webhookId,
        webhookToken: target.webhookToken
      }, event);
      this.store.saveDiscordMessage(
        event.eventId,
        reference.channelId,
        reference.messageId,
        reference.webhookId,
        reference.webhookToken
      );
    });
  }

  private async deliverDiscordDm(event: NotificationEvent, userId: string): Promise<void> {
    await this.deliver(event, "discord-dm", userId, async () => {
      const reference = await this.discord.sendDm(userId, event);
      this.store.saveDiscordMessage(event.eventId, reference.channelId, reference.messageId);
    });
  }

  private async deliverNtfy(event: NotificationEvent): Promise<void> {
    const target = this.ntfy.topicFor(event.topic) ?? event.topic;
    await this.deliver(event, "ntfy", target, async () => {
      await this.ntfy.send(event);
    });
  }

  private async deliver(
    event: NotificationEvent,
    destination: string,
    target: string,
    operation: () => Promise<void>
  ): Promise<void> {
    if (this.store.hasSuccessfulDelivery(event.eventId, destination, target)) return;
    try {
      await operation();
      this.store.saveDelivery(event.eventId, destination, target, "sent");
    } catch (error) {
      this.store.saveDelivery(event.eventId, destination, target, "failed", error);
      console.error("Notification delivery failed", { eventId: event.eventId, destination, target, error });
    }
  }
}
