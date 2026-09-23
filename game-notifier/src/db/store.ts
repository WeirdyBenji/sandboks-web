import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import type { NotificationEvent, StoredEvent } from "../core/events.js";
import type { ProviderObservation } from "../core/providers.js";

export type DeliveryMode = "dm" | "ntfy";

export interface User {
  discordUserId: string;
  username: string;
  avatarUrl?: string;
  isAdmin: boolean;
}

export interface Subscription {
  topic: string;
  deliveryMode: DeliveryMode;
  enabled: boolean;
}

export interface DeliveryTarget {
  targetId: string;
  deliveryMode: "dm" | "channel" | "webhook";
  webhookId?: string;
  webhookToken?: string;
}

export interface ChannelSubscriptions {
  channelId: string;
  channelName: string;
  controlMessageId?: string;
  deliveryMode: "bot" | "webhook";
  webhookId?: string;
  webhookToken?: string;
  topics: string[];
}

export interface TrackedDiscordMessage {
  eventId: string;
  topic: string;
  title: string;
  channelId: string;
  messageId: string;
  webhookId?: string;
  webhookToken?: string;
  createdAt: Date;
  state: "active" | "marked_expired";
}

export interface EventLog extends StoredEvent {
  discordMessageState: "none" | "active" | "marked_expired" | "deleted" | "mixed";
}

export interface ProviderObservationRecord {
  observationId: string;
  provider: string;
  category: string;
  observedAt: Date;
  payload: Record<string, unknown>;
}

interface EventRow {
  event_id: string;
  topic: string;
  source: string;
  title: string;
  message: string;
  priority: NotificationEvent["priority"];
  starts_at: string | null;
  expires_at: string | null;
  url: string | null;
  metadata: string;
  status: "active" | "expired";
  created_at: string;
}

interface EventLogRow extends EventRow {
  message_count: number;
  active_message_count: number;
  marked_message_count: number;
  deleted_message_count: number;
}

interface ProviderObservationRow {
  observationId: string;
  provider: string;
  category: string;
  observedAt: string;
  payload: string;
}

export class Store {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        priority TEXT NOT NULL,
        starts_at TEXT,
        expires_at TEXT,
        url TEXT,
        metadata TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        hidden_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        discord_user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        avatar_url TEXT,
        is_admin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        last_login_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        discord_user_id TEXT NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
        topic TEXT NOT NULL,
        delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('dm', 'ntfy')),
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (discord_user_id, topic, delivery_mode)
      );

      CREATE TABLE IF NOT EXISTS discord_channels (
        channel_id TEXT PRIMARY KEY,
        channel_name TEXT NOT NULL,
        control_message_id TEXT,
        delivery_mode TEXT NOT NULL DEFAULT 'bot',
        webhook_id TEXT,
        webhook_token TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS channel_subscriptions (
        channel_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (channel_id, topic)
      );

      CREATE TABLE IF NOT EXISTS discord_messages (
        event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        webhook_id TEXT,
        webhook_token TEXT,
        expired_at TEXT,
        deleted_at TEXT,
        PRIMARY KEY (event_id, channel_id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        discord_user_id TEXT NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS oauth_states (
        state_hash TEXT PRIMARY KEY,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS deliveries (
        event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
        destination TEXT NOT NULL,
        target TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        attempted_at TEXT NOT NULL,
        PRIMARY KEY (event_id, destination, target)
      );

      CREATE TABLE IF NOT EXISTS provider_observations (
        observation_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        category TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS events_expiry_idx ON events(status, expires_at);
      CREATE INDEX IF NOT EXISTS subscriptions_topic_idx ON subscriptions(topic, enabled);
      CREATE INDEX IF NOT EXISTS channel_subscriptions_topic_idx ON channel_subscriptions(topic, enabled);
      CREATE INDEX IF NOT EXISTS provider_observations_lookup_idx
        ON provider_observations(provider, category, observed_at);
    `);
    const messageColumns = this.db.prepare("PRAGMA table_info(discord_messages)").all() as Array<{ name: string }>;
    if (!messageColumns.some((column) => column.name === "deleted_at")) {
      this.db.exec("ALTER TABLE discord_messages ADD COLUMN deleted_at TEXT");
    }
    if (!messageColumns.some((column) => column.name === "webhook_id")) {
      this.db.exec("ALTER TABLE discord_messages ADD COLUMN webhook_id TEXT");
    }
    if (!messageColumns.some((column) => column.name === "webhook_token")) {
      this.db.exec("ALTER TABLE discord_messages ADD COLUMN webhook_token TEXT");
    }
    const channelColumns = this.db.prepare("PRAGMA table_info(discord_channels)").all() as Array<{ name: string }>;
    if (!channelColumns.some((column) => column.name === "delivery_mode")) {
      this.db.exec("ALTER TABLE discord_channels ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'bot'");
    }
    if (!channelColumns.some((column) => column.name === "webhook_id")) {
      this.db.exec("ALTER TABLE discord_channels ADD COLUMN webhook_id TEXT");
    }
    if (!channelColumns.some((column) => column.name === "webhook_token")) {
      this.db.exec("ALTER TABLE discord_channels ADD COLUMN webhook_token TEXT");
    }
    const eventColumns = this.db.prepare("PRAGMA table_info(events)").all() as Array<{ name: string }>;
    if (!eventColumns.some((column) => column.name === "hidden_at")) {
      this.db.exec("ALTER TABLE events ADD COLUMN hidden_at TEXT");
    }
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT OR IGNORE INTO discord_channels (channel_id, channel_name, created_at, updated_at)
      SELECT DISTINCT channel_id, channel_id, ?, ? FROM channel_subscriptions
    `).run(now, now);
    this.migrateFreeGameSubscriptions(now);
  }

  private migrateFreeGameSubscriptions(now: string): void {
    const topics = ["games.free.steam", "games.free.epic", "games.free.itchio", "games.free.other"];
    const migrate = this.db.transaction(() => {
      const insertUserSubscription = this.db.prepare(`
        INSERT OR IGNORE INTO subscriptions (
          discord_user_id, topic, delivery_mode, enabled, created_at, updated_at
        )
        SELECT discord_user_id, ?, delivery_mode, enabled, created_at, ?
        FROM subscriptions WHERE topic = 'games.free'
      `);
      const insertChannelSubscription = this.db.prepare(`
        INSERT OR IGNORE INTO channel_subscriptions (
          channel_id, topic, enabled, created_at, updated_at
        )
        SELECT channel_id, ?, enabled, created_at, ?
        FROM channel_subscriptions WHERE topic = 'games.free'
      `);
      for (const topic of topics) {
        insertUserSubscription.run(topic, now);
        insertChannelSubscription.run(topic, now);
      }
      this.db.prepare("DELETE FROM subscriptions WHERE topic = 'games.free'").run();
      this.db.prepare("DELETE FROM channel_subscriptions WHERE topic = 'games.free'").run();
    });
    migrate();
  }

  insertEvent(event: NotificationEvent): boolean {
    const result = this.db.prepare(`
      INSERT OR IGNORE INTO events (
        event_id, topic, source, title, message, priority, starts_at, expires_at, url, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.eventId,
      event.topic,
      event.source,
      event.title,
      event.message,
      event.priority,
      event.startsAt?.toISOString() ?? null,
      event.expiresAt?.toISOString() ?? null,
      event.url ?? null,
      JSON.stringify(event.metadata),
      new Date().toISOString()
    );
    return result.changes === 1;
  }

  hasEvent(eventId: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM events WHERE event_id = ?").get(eventId));
  }

  insertObservations(observations: readonly ProviderObservation[]): number {
    const insert = this.db.transaction(() => {
      const statement = this.db.prepare(`
        INSERT OR IGNORE INTO provider_observations (
          observation_id, provider, category, observed_at, payload
        ) VALUES (?, ?, ?, ?, ?)
      `);
      let inserted = 0;
      for (const observation of observations) {
        inserted += statement.run(
          observation.observationId,
          observation.provider,
          observation.category,
          observation.observedAt.toISOString(),
          JSON.stringify(observation.payload)
        ).changes;
      }
      return inserted;
    });
    return insert();
  }

  listProviderObservations(limit = 500): ProviderObservationRecord[] {
    const rows = this.db.prepare(`
      SELECT
        observation_id AS observationId,
        provider,
        category,
        observed_at AS observedAt,
        payload
      FROM provider_observations
      WHERE (provider = 'warframe' AND category = 'darvo')
         OR (provider = 'warframe-coda-wiki' AND category = 'rotations')
      ORDER BY observed_at DESC
      LIMIT ?
    `).all(limit) as ProviderObservationRow[];
    return rows.map((row) => ({
      ...row,
      observedAt: new Date(row.observedAt),
      payload: parseObservationPayload(row.payload)
    }));
  }

  getExpiredEvents(now = new Date()): StoredEvent[] {
    const rows = this.db.prepare(`
      SELECT * FROM events WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= ?
    `).all(now.toISOString()) as EventRow[];
    return rows.map(mapEventRow);
  }

  getActiveEvents(topic: string): StoredEvent[] {
    const rows = this.db.prepare(`
      SELECT * FROM events WHERE status = 'active' AND topic = ?
    `).all(topic) as EventRow[];
    return rows.map(mapEventRow);
  }

  updateEvent(eventId: string, event: NotificationEvent): void {
    this.db.prepare(`
      UPDATE events SET
        title = ?, message = ?, priority = ?, starts_at = ?, expires_at = ?, url = ?, metadata = ?
      WHERE event_id = ? AND status = 'active'
    `).run(
      event.title,
      event.message,
      event.priority,
      event.startsAt?.toISOString() ?? null,
      event.expiresAt?.toISOString() ?? null,
      event.url ?? null,
      JSON.stringify(event.metadata),
      eventId
    );
  }

  markEventExpired(eventId: string): void {
    this.db.prepare("UPDATE events SET status = 'expired' WHERE event_id = ?").run(eventId);
  }

  listRecentEvents(limit = 50): EventLog[] {
    const rows = this.db.prepare(`
      SELECT
        events.*,
        COUNT(messages.message_id) AS message_count,
        SUM(CASE WHEN messages.expired_at IS NULL AND messages.deleted_at IS NULL THEN 1 ELSE 0 END) AS active_message_count,
        SUM(CASE WHEN messages.expired_at IS NOT NULL AND messages.deleted_at IS NULL THEN 1 ELSE 0 END) AS marked_message_count,
        SUM(CASE WHEN messages.deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS deleted_message_count
      FROM events
      LEFT JOIN discord_messages AS messages ON messages.event_id = events.event_id
      WHERE events.hidden_at IS NULL
      GROUP BY events.event_id
      ORDER BY events.created_at DESC
      LIMIT ?
    `).all(limit) as EventLogRow[];
    return rows.map((row) => ({ ...mapEventRow(row), discordMessageState: messageState(row) }));
  }

  hideEvents(eventIds: readonly string[]): number {
    const uniqueEventIds = [...new Set(eventIds)].slice(0, 200);
    const hide = this.db.transaction(() => {
      const statement = this.db.prepare("UPDATE events SET hidden_at = ? WHERE event_id = ? AND hidden_at IS NULL");
      const now = new Date().toISOString();
      let hidden = 0;
      for (const eventId of uniqueEventIds) hidden += statement.run(now, eventId).changes;
      return hidden;
    });
    return hide();
  }

  saveDiscordMessage(eventId: string, channelId: string, messageId: string, webhookId?: string, webhookToken?: string): void {
    this.db.prepare(`
      INSERT INTO discord_messages (event_id, channel_id, message_id, webhook_id, webhook_token)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(event_id, channel_id) DO UPDATE SET
        message_id = excluded.message_id,
        webhook_id = excluded.webhook_id,
        webhook_token = excluded.webhook_token
    `).run(eventId, channelId, messageId, webhookId ?? null, webhookToken ?? null);
  }

  getDiscordMessages(eventId: string): Array<{ channelId: string; messageId: string; webhookId?: string; webhookToken?: string }> {
    return this.db.prepare(`
      SELECT channel_id AS channelId, message_id AS messageId,
        webhook_id AS webhookId, webhook_token AS webhookToken
      FROM discord_messages WHERE event_id = ? AND expired_at IS NULL
    `).all(eventId) as Array<{ channelId: string; messageId: string; webhookId?: string; webhookToken?: string }>;
  }

  listDiscordMessagesForDeletion(limit = 200): TrackedDiscordMessage[] {
    const rows = this.db.prepare(`
      SELECT
        messages.event_id AS eventId,
        events.topic,
        events.title,
        messages.channel_id AS channelId,
        messages.message_id AS messageId,
        messages.webhook_id AS webhookId,
        messages.webhook_token AS webhookToken,
        events.created_at AS createdAt,
        messages.expired_at AS expiredAt
      FROM discord_messages AS messages
      JOIN events ON events.event_id = messages.event_id
      WHERE messages.deleted_at IS NULL
      ORDER BY events.created_at DESC
      LIMIT ?
    `).all(limit) as Array<Omit<TrackedDiscordMessage, "createdAt" | "state"> & { createdAt: string; expiredAt: string | null }>;
    return rows.map(({ expiredAt, ...row }) => ({
      ...row,
      createdAt: new Date(row.createdAt),
      state: expiredAt ? "marked_expired" : "active"
    }));
  }

  getDiscordMessageForDeletion(messageId: string): TrackedDiscordMessage | undefined {
    const row = this.db.prepare(`
      SELECT
        messages.event_id AS eventId,
        events.topic,
        events.title,
        messages.channel_id AS channelId,
        messages.message_id AS messageId,
        messages.webhook_id AS webhookId,
        messages.webhook_token AS webhookToken,
        events.created_at AS createdAt,
        messages.expired_at AS expiredAt
      FROM discord_messages AS messages
      JOIN events ON events.event_id = messages.event_id
      WHERE messages.message_id = ? AND messages.deleted_at IS NULL
    `).get(messageId) as (Omit<TrackedDiscordMessage, "createdAt" | "state"> & { createdAt: string; expiredAt: string | null }) | undefined;
    if (!row) return undefined;
    const { expiredAt, ...message } = row;
    return {
      ...message,
      createdAt: new Date(message.createdAt),
      state: expiredAt ? "marked_expired" : "active"
    };
  }

  markDiscordMessageExpired(eventId: string, channelId: string): void {
    this.db.prepare(`
      UPDATE discord_messages SET expired_at = ? WHERE event_id = ? AND channel_id = ?
    `).run(new Date().toISOString(), eventId, channelId);
  }

  markDiscordMessageDeleted(eventId: string, channelId: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE discord_messages
      SET expired_at = COALESCE(expired_at, ?), deleted_at = ?
      WHERE event_id = ? AND channel_id = ?
    `).run(now, now, eventId, channelId);
  }

  saveDelivery(eventId: string, destination: string, target: string, status: "sent" | "failed", error?: unknown): void {
    const errorMessage = error instanceof Error ? error.message : error ? String(error) : null;
    this.db.prepare(`
      INSERT INTO deliveries (event_id, destination, target, status, error, attempted_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id, destination, target) DO UPDATE SET
        status = excluded.status, error = excluded.error, attempted_at = excluded.attempted_at
    `).run(eventId, destination, target, status, errorMessage?.slice(0, 500) ?? null, new Date().toISOString());
  }

  hasSuccessfulDelivery(eventId: string, destination: string, target: string): boolean {
    return Boolean(this.db.prepare(`
      SELECT 1 FROM deliveries WHERE event_id = ? AND destination = ? AND target = ? AND status = 'sent'
    `).get(eventId, destination, target));
  }

  upsertUser(user: User): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO users (discord_user_id, username, avatar_url, is_admin, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(discord_user_id) DO UPDATE SET
        username = excluded.username,
        avatar_url = excluded.avatar_url,
        is_admin = excluded.is_admin,
        last_login_at = excluded.last_login_at
    `).run(user.discordUserId, user.username, user.avatarUrl ?? null, user.isAdmin ? 1 : 0, now, now);
  }

  getUser(discordUserId: string): User | undefined {
    const row = this.db.prepare(`
      SELECT discord_user_id AS discordUserId, username, avatar_url AS avatarUrl, is_admin AS isAdmin
      FROM users WHERE discord_user_id = ?
    `).get(discordUserId) as (Omit<User, "isAdmin"> & { isAdmin: number }) | undefined;
    return row ? { ...row, isAdmin: row.isAdmin === 1 } : undefined;
  }

  listSubscriptions(discordUserId: string): Subscription[] {
    const rows = this.db.prepare(`
      SELECT topic, delivery_mode AS deliveryMode, enabled
      FROM subscriptions WHERE discord_user_id = ?
    `).all(discordUserId) as Array<Omit<Subscription, "enabled"> & { enabled: number }>;
    return rows.map((row) => ({ ...row, enabled: row.enabled === 1 }));
  }

  replaceSubscriptions(discordUserId: string, subscriptions: Subscription[]): void {
    const replace = this.db.transaction(() => {
      this.db.prepare("DELETE FROM subscriptions WHERE discord_user_id = ?").run(discordUserId);
      const insert = this.db.prepare(`
        INSERT INTO subscriptions (discord_user_id, topic, delivery_mode, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      for (const subscription of subscriptions) {
        insert.run(discordUserId, subscription.topic, subscription.deliveryMode, subscription.enabled ? 1 : 0, now, now);
      }
    });
    replace();
  }

  getDeliveryTargets(topic: string): DeliveryTarget[] {
    return this.db.prepare(`
      SELECT discord_user_id AS targetId, 'dm' AS deliveryMode,
        NULL AS webhookId, NULL AS webhookToken
      FROM subscriptions WHERE topic = ? AND delivery_mode = 'dm' AND enabled = 1
      UNION ALL
      SELECT subscriptions.channel_id AS targetId,
        CASE WHEN channels.delivery_mode = 'webhook' THEN 'webhook' ELSE 'channel' END AS deliveryMode,
        channels.webhook_id AS webhookId, channels.webhook_token AS webhookToken
      FROM channel_subscriptions AS subscriptions
      JOIN discord_channels AS channels ON channels.channel_id = subscriptions.channel_id
      WHERE subscriptions.topic = ? AND subscriptions.enabled = 1
    `).all(topic, topic) as DeliveryTarget[];
  }

  listChannelSubscriptions(): ChannelSubscriptions[] {
    const rows = this.db.prepare(`
      SELECT
        channels.channel_id AS channelId,
        channels.channel_name AS channelName,
        channels.control_message_id AS controlMessageId,
        channels.delivery_mode AS deliveryMode,
        channels.webhook_id AS webhookId,
        channels.webhook_token AS webhookToken,
        subscriptions.topic
      FROM discord_channels AS channels
      LEFT JOIN channel_subscriptions AS subscriptions
        ON subscriptions.channel_id = channels.channel_id AND subscriptions.enabled = 1
      ORDER BY channels.channel_name, channels.channel_id, subscriptions.topic
    `).all() as Array<{ channelId: string; channelName: string; controlMessageId: string | null; deliveryMode: "bot" | "webhook"; webhookId: string | null; webhookToken: string | null; topic: string | null }>;
    const channels = new Map<string, ChannelSubscriptions>();
    for (const row of rows) {
      const channel = channels.get(row.channelId) ?? {
        channelId: row.channelId,
        channelName: row.channelName,
        controlMessageId: row.controlMessageId ?? undefined,
        deliveryMode: row.deliveryMode,
        webhookId: row.webhookId ?? undefined,
        webhookToken: row.webhookToken ?? undefined,
        topics: []
      };
      if (row.topic) channel.topics.push(row.topic);
      channels.set(row.channelId, channel);
    }
    return [...channels.values()];
  }

  getDiscordChannel(channelId: string): ChannelSubscriptions | undefined {
    return this.listChannelSubscriptions().find((channel) => channel.channelId === channelId);
  }

  upsertDiscordChannel(channelId: string, channelName: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO discord_channels (channel_id, channel_name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(channel_id) DO UPDATE SET channel_name = excluded.channel_name, updated_at = excluded.updated_at
    `).run(channelId, channelName, now, now);
  }

  configureDiscordChannel(
    channelId: string,
    channelName: string,
    deliveryMode: "bot" | "webhook",
    webhook?: { webhookId: string; webhookToken: string }
  ): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO discord_channels (
        channel_id, channel_name, delivery_mode, webhook_id, webhook_token, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(channel_id) DO UPDATE SET
        channel_name = excluded.channel_name,
        delivery_mode = excluded.delivery_mode,
        webhook_id = excluded.webhook_id,
        webhook_token = excluded.webhook_token,
        updated_at = excluded.updated_at
    `).run(
      channelId,
      channelName,
      deliveryMode,
      webhook?.webhookId ?? null,
      webhook?.webhookToken ?? null,
      now,
      now
    );
  }

  setChannelControlMessage(channelId: string, messageId: string): void {
    this.db.prepare("UPDATE discord_channels SET control_message_id = ?, updated_at = ? WHERE channel_id = ?")
      .run(messageId, new Date().toISOString(), channelId);
  }

  replaceChannelSubscriptions(channelId: string, channelTopics: readonly string[]): void {
    const replace = this.db.transaction(() => {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT OR IGNORE INTO discord_channels (channel_id, channel_name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(channelId, channelId, now, now);
      this.db.prepare("DELETE FROM channel_subscriptions WHERE channel_id = ?").run(channelId);
      const insert = this.db.prepare(`
        INSERT INTO channel_subscriptions (channel_id, topic, enabled, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?)
      `);
      for (const topic of [...new Set(channelTopics)]) insert.run(channelId, topic, now, now);
    });
    replace();
  }

  toggleChannelSubscription(channelId: string, topic: string): string[] {
    const toggle = this.db.transaction(() => {
      const existing = this.db.prepare(`
        SELECT 1 FROM channel_subscriptions WHERE channel_id = ? AND topic = ? AND enabled = 1
      `).get(channelId, topic);
      if (existing) {
        this.db.prepare("DELETE FROM channel_subscriptions WHERE channel_id = ? AND topic = ?").run(channelId, topic);
      } else {
        const now = new Date().toISOString();
        this.db.prepare(`
          INSERT INTO channel_subscriptions (channel_id, topic, enabled, created_at, updated_at)
          VALUES (?, ?, 1, ?, ?)
          ON CONFLICT(channel_id, topic) DO UPDATE SET enabled = 1, updated_at = excluded.updated_at
        `).run(channelId, topic, now, now);
      }
      return this.getDiscordChannel(channelId)?.topics ?? [];
    });
    return toggle();
  }

  createSession(discordUserId: string, ttlSeconds = 60 * 60 * 24 * 30): string {
    const token = randomBytes(32).toString("base64url");
    this.db.prepare("INSERT INTO sessions (token_hash, discord_user_id, expires_at) VALUES (?, ?, ?)")
      .run(hashToken(token), discordUserId, new Date(Date.now() + ttlSeconds * 1000).toISOString());
    return token;
  }

  getSessionUser(token: string): User | undefined {
    const row = this.db.prepare(`
      SELECT discord_user_id AS discordUserId FROM sessions WHERE token_hash = ? AND expires_at > ?
    `).get(hashToken(token), new Date().toISOString()) as { discordUserId: string } | undefined;
    return row ? this.getUser(row.discordUserId) : undefined;
  }

  deleteSession(token: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  }

  createOauthState(ttlSeconds = 600): string {
    const state = randomBytes(24).toString("base64url");
    this.db.prepare("INSERT INTO oauth_states (state_hash, expires_at) VALUES (?, ?)")
      .run(hashToken(state), new Date(Date.now() + ttlSeconds * 1000).toISOString());
    return state;
  }

  consumeOauthState(state: string): boolean {
    const result = this.db.prepare(`
      DELETE FROM oauth_states WHERE state_hash = ? AND expires_at > ?
    `).run(hashToken(state), new Date().toISOString());
    return result.changes === 1;
  }

  close(): void {
    this.db.close();
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseObservationPayload(payload: string): Record<string, unknown> {
  const parsed = JSON.parse(payload) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

function mapEventRow(row: EventRow): StoredEvent {
  return {
    eventId: row.event_id,
    topic: row.topic,
    source: row.source,
    title: row.title,
    message: row.message,
    priority: row.priority,
    startsAt: row.starts_at ? new Date(row.starts_at) : undefined,
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    url: row.url ?? undefined,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    status: row.status,
    createdAt: new Date(row.created_at)
  };
}

function messageState(row: EventLogRow): EventLog["discordMessageState"] {
  if (row.message_count === 0) return "none";
  if (row.active_message_count === row.message_count) return "active";
  if (row.marked_message_count === row.message_count) return "marked_expired";
  if (row.deleted_message_count === row.message_count) return "deleted";
  return "mixed";
}
