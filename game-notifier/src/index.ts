import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { Store, type ChannelSubscriptions, type TrackedDiscordMessage } from "./db/store.js";
import { Dispatcher } from "./core/dispatcher.js";
import type { EventProvider } from "./core/providers.js";
import { topics } from "./core/topics.js";
import { DiscordIntegration } from "./integrations/discord.js";
import { NtfyIntegration } from "./integrations/ntfy.js";
import { WarframeProvider } from "./providers/warframe.js";
import { FreeGamesProvider } from "./providers/free-games.js";
import { GameDealsProvider } from "./providers/game-deals.js";
import { DebugProvider } from "./providers/debug.js";
import { CodaProvider } from "./providers/coda.js";
import { createWebServer } from "./web/server.js";

const store = new Store(config.DATABASE_PATH);
const discord = new DiscordIntegration(config.DISCORD_BOT_TOKEN, config.PUBLIC_URL);
const ntfy = new NtfyIntegration(config.NTFY_BASE_URL, config.NTFY_TOKEN, config.NTFY_TOPIC_MAP);
const dispatcher = new Dispatcher(
  store,
  discord,
  ntfy,
  config.DISCORD_EXPIRED_MESSAGE_ACTION
);
const providers: EventProvider[] = [];

if (config.DEBUG_INTERVAL_MINUTES) providers.push(new DebugProvider(config.DEBUG_INTERVAL_MINUTES));
if (config.WARFRAME_ENABLED) {
  providers.push(new WarframeProvider("missions"));
  providers.push(new WarframeProvider("sortie"));
  providers.push(new WarframeProvider("darvo", config.DARVO_REFERENCE_MS));
}
if (config.LICH_MIN_BONUS !== undefined) providers.push(new CodaProvider({
  minimumBonus: config.LICH_MIN_BONUS
}));
if (config.FREE_GAMES_ENABLED) providers.push(new FreeGamesProvider());
if (config.GAME_DEALS_ENABLED) providers.push(new GameDealsProvider(config.GAME_DEALS_WATCHLIST));

const triggerableTopics = [...new Set(providers.flatMap((provider) => [...provider.topics]))];

discord.configureChannelTopicButtons(
  topics.map((topic) => ({ id: topic.id, label: topic.label })),
  async (channelId, topic) => store.toggleChannelSubscription(channelId, topic)
);

async function triggerTopic(topic: string, ignoreSeen: boolean): Promise<{ found: number; sent: number; skipped: number }> {
  const provider = providers.find((candidate) => candidate.topics.includes(topic));
  if (!provider) throw new Error(`No active provider supports topic ${topic}`);

  const result = await provider.poll();
  store.insertObservations(result.observations);
  const events = result.events.filter((event) => event.topic === topic);
  let sent = 0;
  let skipped = 0;

  for (const event of events) {
    if (ignoreSeen) {
      if (!store.insertEvent(event)) {
        skipped++;
        continue;
      }
      await dispatcher.dispatch(event);
    } else {
      const manualEvent = {
        ...event,
        eventId: `${event.eventId}:manual:${randomUUID()}`,
        metadata: { ...event.metadata, manual: true, originalEventId: event.eventId }
      };
      store.insertEvent(manualEvent);
      await dispatcher.dispatch(manualEvent);
    }
    sent++;
  }

  return { found: events.length, sent, skipped };
}

async function deleteDiscordMessages(messageIds: readonly string[]): Promise<{ selected: number; deleted: number; failed: number }> {
  const uniqueMessageIds = [...new Set(messageIds)].slice(0, 200);
  let deleted = 0;
  let failed = 0;

  for (const messageId of uniqueMessageIds) {
    const tracked = store.getDiscordMessageForDeletion(messageId);
    if (!tracked) {
      failed++;
      continue;
    }
    try {
      await discord.deleteMessage({ channelId: tracked.channelId, messageId: tracked.messageId });
      store.markDiscordMessageDeleted(tracked.eventId, tracked.channelId);
      deleted++;
    } catch (error) {
      console.error("Discord batch deletion failed", { messageId, error });
      failed++;
    }
  }

  return { selected: uniqueMessageIds.length, deleted, failed };
}

function listTrackedDiscordMessages(): TrackedDiscordMessage[] {
  return store.listDiscordMessagesForDeletion();
}

async function listExistingDiscordMessages(): Promise<TrackedDiscordMessage[]> {
  const candidates = store.listDiscordMessagesForDeletion();
  if (!discord.enabled) return candidates;

  const existing: TrackedDiscordMessage[] = [];
  for (const message of candidates) {
    try {
      if (await discord.messageExists({ channelId: message.channelId, messageId: message.messageId })) {
        existing.push(message);
      } else {
        store.markDiscordMessageDeleted(message.eventId, message.channelId);
      }
    } catch (error) {
      console.error("Discord message reconciliation failed", { messageId: message.messageId, error });
      existing.push(message);
    }
  }
  return existing;
}

async function listDiscordChannels(): Promise<ChannelSubscriptions[]> {
  const channels = store.listChannelSubscriptions();
  if (!discord.enabled) return channels;
  for (const channel of channels) {
    if (channel.channelName !== channel.channelId) continue;
    try {
      channel.channelName = await discord.getChannelName(channel.channelId);
      store.upsertDiscordChannel(channel.channelId, channel.channelName);
    } catch (error) {
      console.error("Discord channel name resolution failed", { channelId: channel.channelId, error });
    }
  }
  return channels;
}

async function saveChannelSubscriptions(
  destination: string,
  channelTopics: readonly string[],
  createWebhook: boolean
): Promise<string> {
  if (!discord.enabled) throw new Error("Discord bot is disabled");
  const isChannelId = /^\d{17,20}$/.test(destination);
  let webhook = isChannelId ? undefined : await discord.resolveWebhookUrl(destination);
  const channelId = webhook?.channelId ?? destination;
  const existing = store.getDiscordChannel(channelId);
  const channelName = await discord.getChannelName(channelId);
  if (isChannelId && createWebhook) {
    webhook = existing?.deliveryMode === "webhook" && existing.webhookId && existing.webhookToken
      ? { channelId, webhookId: existing.webhookId, webhookToken: existing.webhookToken }
      : await discord.createChannelWebhook(channelId);
  }
  store.configureDiscordChannel(channelId, channelName, webhook ? "webhook" : "bot", webhook);
  store.replaceChannelSubscriptions(channelId, channelTopics);

  if (existing?.controlMessageId) {
    const updated = await discord.updateChannelSubscriptionPanel(
      { channelId, messageId: existing.controlMessageId },
      channelTopics
    );
    if (updated) return channelId;
  }
  const panel = await discord.sendChannelSubscriptionPanel(channelId, channelTopics);
  store.setChannelControlMessage(channelId, panel.messageId);
  return channelId;
}

async function initializeChannelSubscriptionPanels(): Promise<void> {
  if (!discord.enabled) return;
  for (const channel of await listDiscordChannels()) {
    try {
      if (channel.controlMessageId) {
        const updated = await discord.updateChannelSubscriptionPanel(
          { channelId: channel.channelId, messageId: channel.controlMessageId },
          channel.topics
        );
        if (updated) continue;
      }
      const panel = await discord.sendChannelSubscriptionPanel(channel.channelId, channel.topics);
      store.setChannelControlMessage(channel.channelId, panel.messageId);
    } catch (error) {
      console.error("Discord channel subscription panel creation failed", { channelId: channel.channelId, error });
    }
  }
}

let polling = false;
const lastProviderPolls = new Map<string, number>();
const lastProviderScheduleKeys = new Map<string, string>();
async function poll(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    for (const provider of providers) {
      if (
        provider.name === "internal-debug"
        && store.getDeliveryTargets("system.debug").length === 0
        && !ntfy.topicFor("system.debug")
      ) continue;

      const now = Date.now();
      const scheduleKey = provider.scheduleKey?.(new Date(now));
      if (provider.scheduleKey) {
        if (!scheduleKey || lastProviderScheduleKeys.get(provider.name) === scheduleKey) continue;
      } else {
        const intervalMs = (provider.pollIntervalSeconds ?? config.POLL_INTERVAL_SECONDS) * 1000;
        const lastPoll = lastProviderPolls.get(provider.name);
        if (lastPoll !== undefined && now - lastPoll < intervalMs) continue;
      }
      try {
        const result = await provider.poll();
        store.insertObservations(result.observations);
        let newEvents = 0;
        for (const event of result.events) {
          const alreadyKnown = store.hasEvent(event.eventId);
          if (!alreadyKnown && provider.maxNewEventsPerPoll !== undefined && newEvents >= provider.maxNewEventsPerPoll) {
            continue;
          }
          if (store.insertEvent(event)) newEvents++;
          await dispatcher.dispatch(event);
        }
        for (const topic of provider.authoritativeTopics ?? []) {
          const activeEvents = new Map(result.events
            .filter((event) => event.topic === topic)
            .map((event) => [event.eventId, event]));
          for (const storedEvent of store.getActiveEvents(topic)) {
            const originalEventId = typeof storedEvent.metadata.originalEventId === "string"
              ? storedEvent.metadata.originalEventId
              : storedEvent.eventId;
            const currentEvent = activeEvents.get(originalEventId);
            if (!currentEvent) {
              await dispatcher.expire(storedEvent);
            } else if (storedEvent.message !== currentEvent.message) {
              await dispatcher.refresh(storedEvent, currentEvent);
            }
          }
        }
        lastProviderPolls.set(provider.name, Date.now());
        if (scheduleKey) lastProviderScheduleKeys.set(provider.name, scheduleKey);
      } catch (error) {
        console.error("Provider poll failed", { provider: provider.name, error });
      }
    }
    for (const event of store.getExpiredEvents()) await dispatcher.expire(event);
  } finally {
    polling = false;
  }
}

await discord.start();
await initializeChannelSubscriptionPanels();
const web = await createWebServer(store, {
  host: config.HOST,
  port: config.PORT,
  publicUrl: config.PUBLIC_URL,
  redirectUri: config.discordRedirectUri,
  discordClientId: config.DISCORD_CLIENT_ID,
  discordClientSecret: config.DISCORD_CLIENT_SECRET,
  adminUserIds: config.discordAdminUserIds,
  secureCookies: config.isProduction,
  triggerableTopics,
  triggerTopic,
  deleteDiscordMessages,
  listTrackedDiscordMessages,
  listExistingDiscordMessages,
  listDiscordChannels,
  saveChannelSubscriptions
});

await poll();
const interval = setInterval(() => void poll(), config.POLL_INTERVAL_SECONDS * 1000);

async function shutdown(): Promise<void> {
  clearInterval(interval);
  await web.close();
  await discord.stop();
  store.close();
}

process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
