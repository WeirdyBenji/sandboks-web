import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  type Webhook,
  type ButtonInteraction,
  type TextBasedChannel
} from "discord.js";
import type { NotificationEvent } from "../core/events.js";

interface SendableChannel {
  send(options: {
    content: string;
    components?: ActionRowBuilder<ButtonBuilder>[];
    allowedMentions: { parse: [] };
    flags?: MessageFlags.SuppressEmbeds;
  }): Promise<{ channelId: string; id: string }>;
}

import { topics } from "../core/topics.js";

export interface DiscordMessageReference {
  channelId: string;
  messageId: string;
  webhookId?: string;
  webhookToken?: string;
}

export interface DiscordWebhookTarget {
  channelId: string;
  webhookId: string;
  webhookToken: string;
}

export class DiscordIntegration {
  private readonly client = new Client({ intents: [GatewayIntentBits.Guilds] });
  private topicDefinitions: Array<{ id: string; label: string }> = [];
  private channelTopicHandler?: (channelId: string, topic: string) => Promise<readonly string[]>;

  constructor(private readonly token: string | undefined, private readonly publicUrl: string) {
    this.client.on("interactionCreate", (interaction) => {
      if (interaction.isButton() && interaction.customId.startsWith("channel-topic:")) {
        void this.handleChannelTopicButton(interaction);
      }
    });
  }

  get enabled(): boolean {
    return Boolean(this.token);
  }

  async start(): Promise<void> {
    if (!this.token) return;
    await this.client.login(this.token);
  }

  async stop(): Promise<void> {
    this.client.destroy();
  }

  async sendToChannel(channelId: string, event: NotificationEvent): Promise<DiscordMessageReference> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isTextBased() || channel.type === ChannelType.DM) {
      throw new Error(`Discord channel ${channelId} is not a guild text channel`);
    }
    return send(channel as SendableChannel, event);
  }

  async sendToWebhook(target: DiscordWebhookTarget, event: NotificationEvent): Promise<DiscordMessageReference> {
    const webhook = await this.client.fetchWebhook(target.webhookId, target.webhookToken);
    const identity = topics.find((topic) => topic.id === event.topic)?.discordIdentity;
    const message = await webhook.send({
      content: discordContent(event),
      username: identity?.username,
      avatarURL: identity?.avatarUrl ?? `${this.publicUrl.replace(/\/$/, "")}/favicon.svg`,
      allowedMentions: { parse: [] },
      flags: MessageFlags.SuppressEmbeds
    });
    return {
      channelId: target.channelId,
      messageId: message.id,
      webhookId: target.webhookId,
      webhookToken: target.webhookToken
    };
  }

  async resolveWebhookUrl(url: string): Promise<DiscordWebhookTarget> {
    const { webhookId, webhookToken } = parseWebhookUrl(url);
    const webhook = await this.client.fetchWebhook(webhookId, webhookToken);
    if (!webhook.channelId || !webhook.isIncoming()) throw new Error("Discord webhook is not an incoming channel webhook");
    return { channelId: webhook.channelId, webhookId, webhookToken };
  }

  async createChannelWebhook(channelId: string): Promise<DiscordWebhookTarget> {
    const webhook = await this.findOrCreateChannelWebhook(channelId);
    if (!webhook.token) throw new Error(`Discord webhook ${webhook.id} has no usable token`);
    return { channelId, webhookId: webhook.id, webhookToken: webhook.token };
  }

  async sendDm(userId: string, event: NotificationEvent): Promise<DiscordMessageReference> {
    const user = await this.client.users.fetch(userId);
    const channel = await user.createDM();
    return send(channel as SendableChannel, event);
  }

  configureChannelTopicButtons(
    topicDefinitions: Array<{ id: string; label: string }>,
    handler: (channelId: string, topic: string) => Promise<readonly string[]>
  ): void {
    this.topicDefinitions = topicDefinitions;
    this.channelTopicHandler = handler;
  }

  async getChannelName(channelId: string): Promise<string> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isTextBased() || channel.type === ChannelType.DM || !("name" in channel)) {
      throw new Error(`Discord channel ${channelId} is not a guild text channel`);
    }
    return channel.name ?? channelId;
  }

  async sendChannelSubscriptionPanel(channelId: string, selectedTopics: readonly string[]): Promise<DiscordMessageReference> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isTextBased() || channel.type === ChannelType.DM) {
      throw new Error(`Discord channel ${channelId} is not a guild text channel`);
    }
    const message = await (channel as SendableChannel).send({
      content: "Abonnements de ce channel",
      components: this.channelTopicRows(selectedTopics),
      allowedMentions: { parse: [] }
    });
    return { channelId: message.channelId, messageId: message.id };
  }

  async updateChannelSubscriptionPanel(reference: DiscordMessageReference, selectedTopics: readonly string[]): Promise<boolean> {
    try {
      const message = await this.fetchMessage(reference);
      await message.edit({ components: this.channelTopicRows(selectedTopics) });
      return true;
    } catch (error) {
      if (isUnknownMessage(error)) return false;
      throw error;
    }
  }

  async updateMessage(reference: DiscordMessageReference, event: NotificationEvent): Promise<boolean> {
    const payload = {
      content: discordContent(event),
      embeds: [],
      components: [],
      allowedMentions: { parse: [] },
      flags: MessageFlags.SuppressEmbeds as const
    };
    try {
      if (reference.webhookId) {
        const webhook = await this.client.fetchWebhook(reference.webhookId, reference.webhookToken);
        await webhook.editMessage(reference.messageId, payload);
        return true;
      }
      const message = await this.fetchMessage(reference);
      await message.edit(payload);
      return true;
    } catch (error) {
      if (isUnknownMessage(error)) return false;
      throw error;
    }
  }

  async markExpired(reference: DiscordMessageReference): Promise<void> {
    try {
      if (reference.webhookId) {
        const webhook = await this.client.fetchWebhook(reference.webhookId, reference.webhookToken);
        const message = await webhook.fetchMessage(reference.messageId);
        const content = message.content.startsWith("Expiré\n") ? message.content : `Expiré\n${message.content}`;
        await webhook.editMessage(reference.messageId, { content, embeds: [], components: [], flags: MessageFlags.SuppressEmbeds });
        return;
      }
      const message = await this.fetchMessage(reference);
      const content = message.content.startsWith("Expiré\n") ? message.content : `Expiré\n${message.content}`;
      await message.edit({ content, embeds: [], components: [], flags: MessageFlags.SuppressEmbeds });
    } catch (error) {
      if (!isUnknownMessage(error)) throw error;
    }
  }

  async deleteMessage(reference: DiscordMessageReference): Promise<void> {
    try {
      if (reference.webhookId) {
        const webhook = await this.client.fetchWebhook(reference.webhookId, reference.webhookToken);
        await webhook.deleteMessage(reference.messageId);
        return;
      }
      const message = await this.fetchMessage(reference);
      await message.delete();
    } catch (error) {
      if (!isUnknownMessage(error)) throw error;
    }
  }

  async messageExists(reference: DiscordMessageReference): Promise<boolean> {
    try {
      if (reference.webhookId) {
        const webhook = await this.client.fetchWebhook(reference.webhookId, reference.webhookToken);
        await webhook.fetchMessage(reference.messageId);
        return true;
      }
      await this.fetchMessage(reference);
      return true;
    } catch (error) {
      if (isMissingResource(error)) return false;
      throw error;
    }
  }

  private async fetchMessage(reference: DiscordMessageReference) {
    const channel = await this.client.channels.fetch(reference.channelId);
    if (!channel?.isTextBased()) throw new Error(`Discord channel ${reference.channelId} is unavailable`);
    return channel.messages.fetch(reference.messageId);
  }

  private async findOrCreateChannelWebhook(channelId: string): Promise<Webhook> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isTextBased() || channel.type === ChannelType.DM || !("fetchWebhooks" in channel) || !("createWebhook" in channel)) {
      throw new Error(`Discord channel ${channelId} does not support webhooks`);
    }
    const webhooks = await channel.fetchWebhooks();
    const existing = webhooks.find((webhook) => webhook.owner?.id === this.client.user?.id && webhook.name === "Game Notifier" && webhook.token);
    return existing ?? channel.createWebhook({ name: "Game Notifier", reason: "Topic-specific notification identities" });
  }

  private channelTopicRows(selectedTopics: readonly string[]): ActionRowBuilder<ButtonBuilder>[] {
    const selected = new Set(selectedTopics);
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let index = 0; index < this.topicDefinitions.length; index += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      row.addComponents(...this.topicDefinitions.slice(index, index + 5).map((topic) => new ButtonBuilder()
        .setCustomId(`channel-topic:${topic.id}`)
        .setLabel(topic.label)
        .setStyle(selected.has(topic.id) ? ButtonStyle.Success : ButtonStyle.Secondary)));
      rows.push(row);
    }
    return rows;
  }

  private async handleChannelTopicButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: "Permission Manage Channels requise.", ephemeral: true });
      return;
    }
    const topic = interaction.customId.slice("channel-topic:".length);
    if (!interaction.channelId || !this.topicDefinitions.some((definition) => definition.id === topic) || !this.channelTopicHandler) {
      await interaction.reply({ content: "Topic indisponible.", ephemeral: true });
      return;
    }
    try {
      await interaction.deferUpdate();
      const selectedTopics = await this.channelTopicHandler(interaction.channelId, topic);
      await interaction.editReply({ components: this.channelTopicRows(selectedTopics) });
    } catch (error) {
      console.error("Discord channel topic toggle failed", { channelId: interaction.channelId, topic, error });
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "La mise à jour a échoué.", ephemeral: true });
      } else {
        await interaction.reply({ content: "La mise à jour a échoué.", ephemeral: true });
      }
    }
  }
}

function parseWebhookUrl(value: string): { webhookId: string; webhookToken: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid Discord webhook URL");
  }
  const allowedHosts = new Set(["discord.com", "ptb.discord.com", "canary.discord.com"]);
  const match = url.pathname.match(/^\/api(?:\/v\d+)?\/webhooks\/(\d{17,20})\/([A-Za-z0-9._-]+)\/?$/);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname) || !match?.[1] || !match[2]) {
    throw new Error("Invalid Discord webhook URL");
  }
  return { webhookId: match[1], webhookToken: match[2] };
}

async function send(channel: SendableChannel, event: NotificationEvent): Promise<DiscordMessageReference> {
  const message = await channel.send({
    content: discordContent(event),
    allowedMentions: { parse: [] },
    flags: MessageFlags.SuppressEmbeds
  });
  return { channelId: message.channelId, messageId: message.id };
}

function discordContent(event: NotificationEvent): string {
  if (!event.url) return event.message;
  const linkUrl = event.url.replaceAll("\\", "%5C").replaceAll(" ", "%20").replaceAll(")", "%29");
  if (event.topic === "warframe.coda") {
    const linkText = topics.find((topic) => topic.id === event.topic)?.linkLabel ?? "Voir la rotation";
    return `${event.message} · [${linkText}](${linkUrl})`;
  }
  const linkText = event.message.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");
  return `[${linkText}](${linkUrl})`;
}

function isUnknownMessage(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error.code === 10008 || error.code === 10015);
}

function isMissingResource(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error.code === 10008 || error.code === 10003 || error.code === 10015);
}
