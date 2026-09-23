import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type {
  ChannelSubscriptions,
  EventLog,
  ProviderObservationRecord,
  Store,
  TrackedDiscordMessage,
  User
} from "../db/store.js";
import { topics, topicIds } from "../core/topics.js";

interface WebConfig {
  host: string;
  port: number;
  publicUrl: string;
  redirectUri: string;
  discordClientId?: string;
  discordClientSecret?: string;
  adminUserIds: Set<string>;
  secureCookies: boolean;
  triggerableTopics: readonly string[];
  triggerTopic(topic: string, ignoreSeen: boolean): Promise<{ found: number; sent: number; skipped: number }>;
  deleteDiscordMessages(messageIds: readonly string[]): Promise<{ selected: number; deleted: number; failed: number }>;
  listTrackedDiscordMessages(): TrackedDiscordMessage[];
  listExistingDiscordMessages(): Promise<TrackedDiscordMessage[]>;
  listDiscordChannels(): Promise<ChannelSubscriptions[]>;
  saveChannelSubscriptions(destination: string, channelTopics: readonly string[], createWebhook: boolean): Promise<string>;
}

interface DiscordProfile {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

const sessionCookie = "game_notifier_session";
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#172033"/><g transform="translate(4 4)" fill="none" stroke="#f5f7fa" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9.27 21a2 2 0 0 0 3.46 0"/><path d="M2.26 15.33A1 1 0 0 0 3 17h18a1 1 0 0 0 .74-1.67C20.41 13.96 19 12.5 19 8A7 7 0 0 0 5 8c0 4.5-1.41 5.96-2.74 7.33"/></g><circle cx="25" cy="7" r="4" fill="#23b5aa"/></svg>`;

export async function createWebServer(store: Store, config: WebConfig): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, trustProxy: true });
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => done(null, body));

  app.get("/favicon.svg", async (_request, reply) => reply
    .header("Cache-Control", "public, max-age=86400")
    .type("image/svg+xml")
    .send(faviconSvg));

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/", async (request, reply) => {
    const user = currentUser(request, store);
    if (!user) return reply.type("text/html").send(loginPage(Boolean(config.discordClientId)));
    return reply.redirect("/subscriptions");
  });

  app.get("/subscriptions", async (request, reply) => {
    const user = requireUser(request, reply, store);
    if (!user) return;
    return reply.type("text/html").send(subscriptionsPage(user, store));
  });

  app.get("/auth/discord", async (_request, reply) => {
    requireOauthConfig(config);
    const state = store.createOauthState();
    const authorizationUrl = new URL("https://discord.com/oauth2/authorize");
    authorizationUrl.searchParams.set("client_id", config.discordClientId!);
    authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", "identify");
    authorizationUrl.searchParams.set("state", state);
    return reply.redirect(authorizationUrl.toString());
  });

  app.get<{ Querystring: { code?: string; state?: string } }>("/auth/discord/callback", async (request, reply) => {
    requireOauthConfig(config);
    const { code, state } = request.query;
    if (!code || !state || !store.consumeOauthState(state)) return reply.code(400).send("Invalid OAuth callback");
    const profile = await exchangeDiscordCode(code, config);
    store.upsertUser({
      discordUserId: profile.id,
      username: profile.global_name || profile.username,
      avatarUrl: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : undefined,
      isAdmin: config.adminUserIds.has(profile.id)
    });
    const session = store.createSession(profile.id);
    setSessionCookie(reply, session, config.secureCookies);
    return reply.redirect("/subscriptions");
  });

  app.post("/subscriptions", async (request, reply) => {
    requireSameOrigin(request, config.publicUrl);
    const user = requireUser(request, reply, store);
    if (!user) return;
    const form = new URLSearchParams(String(request.body ?? ""));
    const subscriptions = form.getAll("dm")
      .filter((topic) => topicIds.has(topic))
      .map((topic) => ({ topic, deliveryMode: "dm" as const, enabled: true }));
    store.replaceSubscriptions(user.discordUserId, subscriptions);
    return reply.redirect("/subscriptions");
  });

  app.post("/logout", async (request, reply) => {
    requireSameOrigin(request, config.publicUrl);
    const token = readCookie(request, sessionCookie);
    if (token) store.deleteSession(token);
    clearSessionCookie(reply, config.secureCookies);
    return reply.redirect("/");
  });

  app.get("/admin", async (_request, reply) => reply.redirect("/admin/logs"));

  app.get<{ Querystring: { found?: string; sent?: string; skipped?: string; logsSelected?: string; logsHidden?: string } }>("/admin/logs", async (request, reply) => {
    const user = requireUser(request, reply, store);
    if (!user) return;
    if (!user.isAdmin) return reply.code(403).send("Forbidden");
    return reply.type("text/html").send(adminPage(user, store.listRecentEvents(), config.triggerableTopics, request.query));
  });

  app.post("/admin/logs/trigger", async (request, reply) => {
    requireSameOrigin(request, config.publicUrl);
    const user = requireUser(request, reply, store);
    if (!user) return;
    if (!user.isAdmin) return reply.code(403).send("Forbidden");

    const form = new URLSearchParams(String(request.body ?? ""));
    const topic = form.get("topic") ?? "";
    if (!config.triggerableTopics.includes(topic)) return reply.code(400).send("Unknown or disabled topic");
    const result = await config.triggerTopic(topic, form.get("ignoreSeen") === "1");
    return reply.redirect(`/admin/logs?found=${result.found}&sent=${result.sent}&skipped=${result.skipped}`);
  });

  app.post("/admin/logs/delete", async (request, reply) => {
    requireSameOrigin(request, config.publicUrl);
    const user = requireUser(request, reply, store);
    if (!user) return;
    if (!user.isAdmin) return reply.code(403).send("Forbidden");

    const form = new URLSearchParams(String(request.body ?? ""));
    const eventIds = [...new Set(form.getAll("eventId"))].slice(0, 200);
    const hidden = store.hideEvents(eventIds);
    return reply.redirect(`/admin/logs?logsSelected=${eventIds.length}&logsHidden=${hidden}`);
  });

  app.get<{ Querystring: { selected?: string; deleted?: string; failed?: string; check?: string } }>("/admin/messages", async (request, reply) => {
    const user = requireUser(request, reply, store);
    if (!user) return;
    if (!user.isAdmin) return reply.code(403).send("Forbidden");
    const messages = request.query.check === "1"
      ? await config.listExistingDiscordMessages()
      : config.listTrackedDiscordMessages();
    return reply.type("text/html").send(messagesPage(user, messages, request.query));
  });

  app.get("/history", async (request, reply) => {
    const user = requireUser(request, reply, store);
    if (!user) return;
    return reply.type("text/html").send(historyPage(user, store.listProviderObservations()));
  });

  app.get("/admin/history", async (_request, reply) => reply.redirect("/history"));

  app.post("/admin/messages/delete", async (request, reply) => {
    requireSameOrigin(request, config.publicUrl);
    const user = requireUser(request, reply, store);
    if (!user) return;
    if (!user.isAdmin) return reply.code(403).send("Forbidden");

    const form = new URLSearchParams(String(request.body ?? ""));
    const result = await config.deleteDiscordMessages(form.getAll("messageId"));
    return reply.redirect(`/admin/messages?selected=${result.selected}&deleted=${result.deleted}&failed=${result.failed}`);
  });

  app.get<{ Querystring: { channel?: string; topics?: string } }>("/admin/channels", async (request, reply) => {
    const user = requireUser(request, reply, store);
    if (!user) return;
    if (!user.isAdmin) return reply.code(403).send("Forbidden");
    return reply.type("text/html").send(channelsPage(user, await config.listDiscordChannels(), request.query));
  });

  app.post("/admin/channels", async (request, reply) => {
    requireSameOrigin(request, config.publicUrl);
    const user = requireUser(request, reply, store);
    if (!user) return;
    if (!user.isAdmin) return reply.code(403).send("Forbidden");

    const form = new URLSearchParams(String(request.body ?? ""));
    const destination = form.get("destination")?.trim() ?? "";
    const isChannelId = /^\d{17,20}$/.test(destination);
    const isWebhookUrl = /^https:\/\/(?:ptb\.|canary\.)?discord\.com\/api\/(?:v\d+\/)?webhooks\/\d{17,20}\/[A-Za-z0-9._-]+\/?$/.test(destination);
    if (!isChannelId && !isWebhookUrl) return reply.code(400).send("Invalid Discord channel ID or webhook URL");
    const channelTopics = form.getAll("topic").filter((topic) => topicIds.has(topic));
    const channelId = await config.saveChannelSubscriptions(destination, channelTopics, form.get("createWebhook") === "1");
    return reply.redirect(`/admin/channels?channel=${encodeURIComponent(channelId)}&topics=${channelTopics.length}`);
  });

  await app.listen({ host: config.host, port: config.port });
  return app;
}

function currentUser(request: FastifyRequest, store: Store): User | undefined {
  const token = readCookie(request, sessionCookie);
  return token ? store.getSessionUser(token) : undefined;
}

function requireUser(request: FastifyRequest, reply: FastifyReply, store: Store): User | undefined {
  const user = currentUser(request, store);
  if (!user) reply.code(401).send("Authentication required");
  return user;
}

function requireOauthConfig(config: WebConfig): void {
  if (!config.discordClientId || !config.discordClientSecret) throw new Error("Discord OAuth is not configured");
}

function requireSameOrigin(request: FastifyRequest, publicUrl: string): void {
  const origin = request.headers.origin;
  if (!origin || origin !== new URL(publicUrl).origin) {
    const error = new Error("Invalid request origin") as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}

async function exchangeDiscordCode(code: string, config: WebConfig): Promise<DiscordProfile> {
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.discordClientId!,
      client_secret: config.discordClientSecret!,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri
    })
  });
  if (!tokenResponse.ok) throw new Error(`Discord OAuth token exchange returned HTTP ${tokenResponse.status}`);
  const token = await tokenResponse.json() as { access_token: string };
  const profileResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { authorization: `Bearer ${token.access_token}` }
  });
  if (!profileResponse.ok) throw new Error(`Discord profile request returned HTTP ${profileResponse.status}`);
  return profileResponse.json() as Promise<DiscordProfile>;
}

function subscriptionsPage(user: User, store: Store): string {
  const enabled = new Set(store.listSubscriptions(user.discordUserId).filter((item) => item.enabled).map((item) => item.topic));
  const rows = topics.map((topic) => `
    <label class="topic">
      <input type="checkbox" name="dm" value="${escapeHtml(topic.id)}" ${enabled.has(topic.id) ? "checked" : ""}>
      <span><strong>${escapeHtml(topic.label)}</strong><small>${escapeHtml(topic.description)}</small></span>
    </label>`).join("");
  return layout("Abonnements", `
    ${pageHeader(user, "Abonnements", "/subscriptions")}
    <main>
      <form method="post" action="/subscriptions"><section>${rows}</section><button type="submit">Enregistrer</button></form>
    </main>`);
}

function loginPage(oauthConfigured: boolean): string {
  return layout("Connexion", `<main class="login"><h1>Notifications jeux</h1>${oauthConfigured
    ? '<a class="button" href="/auth/discord">Se connecter avec Discord</a>'
    : "<p>Discord OAuth n'est pas configuré.</p>"}</main>`);
}

function adminPage(
  user: User,
  events: EventLog[],
  triggerableTopics: readonly string[],
  result: { found?: string; sent?: string; skipped?: string; logsSelected?: string; logsHidden?: string }
): string {
  const rows = events.map((event) => `<tr><td><input type="checkbox" name="eventId" value="${escapeHtml(event.eventId)}" aria-label="Sélectionner ${escapeHtml(event.title)}"></td><td>${escapeHtml(event.topic)}</td><td>${escapeHtml(event.title)}</td><td>${eventStatusLabel(event)}</td><td>${escapeHtml(event.createdAt.toLocaleString("fr-FR"))}</td></tr>`).join("");
  const options = topics
    .filter((topic) => triggerableTopics.includes(topic.id))
    .map((topic) => `<option value="${escapeHtml(topic.id)}">${escapeHtml(topic.label)} (${escapeHtml(topic.id)})</option>`)
    .join("");
  const summary = result.sent === undefined
    ? ""
    : `<p class="result">Trouvés : ${safeCount(result.found)} · envoyés : ${safeCount(result.sent)} · ignorés : ${safeCount(result.skipped)}</p>`;
  const logsSummary = result.logsHidden === undefined
    ? ""
    : `<p class="result">Logs sélectionnés : ${safeCount(result.logsSelected)} · supprimés de l'affichage : ${safeCount(result.logsHidden)}</p>`;
  const eventsTable = events.length === 0
    ? "<p>Aucun évènement récent visible.</p>"
    : `<form method="post" action="/admin/logs/delete" data-confirm-message="Supprimer les logs sélectionnés de l’affichage ?">
        <div class="batch-actions"><label class="inline"><input id="select-all-events" type="checkbox"> Tout sélectionner</label><button class="danger" type="submit">Supprimer les logs</button></div>
        <table><thead><tr><th></th><th>Topic</th><th>Titre</th><th>Statut</th><th>Reçu</th></tr></thead><tbody>${rows}</tbody></table>
      </form>
      ${rangeSelectionScript("eventId", "select-all-events")}`;
  return layout("Logs", `
    ${pageHeader(user, "Logs", "/admin/logs")}
    <main>
      <form method="post" action="/admin/logs/trigger" class="trigger">
        <label for="topic"><strong>Déclencher un topic</strong></label>
        <select id="topic" name="topic" required>${options}</select>
        <label class="inline"><input type="checkbox" name="ignoreSeen" value="1" checked> Ignorer les évènements déjà vus</label>
        <button type="submit">Déclencher</button>
      </form>
      ${summary}
      ${logsSummary}
      ${eventsTable}
    </main>`);
}

function messagesPage(
  user: User,
  messages: TrackedDiscordMessage[],
  result: { selected?: string; deleted?: string; failed?: string; check?: string }
): string {
  const rows = messages.map((message) => `
    <tr>
      <td><input type="checkbox" name="messageId" value="${escapeHtml(message.messageId)}" aria-label="Sélectionner ${escapeHtml(message.title)}"></td>
      <td>${escapeHtml(message.topic)}</td>
      <td>${escapeHtml(message.title)}</td>
      <td>${message.state === "active" ? "Actif" : "Expiré"}</td>
      <td><code>${escapeHtml(message.channelId)}</code></td>
      <td>${escapeHtml(message.createdAt.toLocaleString("fr-FR"))}</td>
    </tr>`).join("");
  const summary = result.deleted === undefined
    ? result.check === "1" ? `<p class="result">Messages vérifiés auprès de Discord.</p>` : ""
    : `<p class="result">Sélectionnés : ${safeCount(result.selected)} · supprimés : ${safeCount(result.deleted)} · échecs : ${safeCount(result.failed)}</p>`;
  const reconcileLink = `<a class="button secondary compact-button" href="/admin/messages?check=1">Vérifier l'existence sur Discord</a>`;
  const content = messages.length === 0
    ? "<p>Aucun message Discord actif suivi.</p>"
    : `<form method="post" action="/admin/messages/delete" data-confirm-message="Supprimer définitivement les messages sélectionnés ?">
        <div class="batch-actions"><label class="inline"><input id="select-all" type="checkbox"> Tout sélectionner</label><span class="action-group">${reconcileLink}<button class="danger" type="submit">Supprimer la sélection</button></span></div>
        <table><thead><tr><th></th><th>Topic</th><th>Titre</th><th>Statut</th><th>Channel</th><th>Créé</th></tr></thead><tbody>${rows}</tbody></table>
      </form>
      ${rangeSelectionScript("messageId", "select-all")}`;
  return layout("Messages Discord", `
    ${pageHeader(user, "Messages Discord", "/admin/messages")}
    <main>${summary}${content}</main>`);
}

function historyPage(user: User, observations: ProviderObservationRecord[]): string {
  const valenceObservations = observations.filter((observation) => observation.provider === "warframe-coda-wiki");
  const valenceRotationDays = new Map<number, string>();
  const valenceByWeapon = new Map<string, Map<number, number>>();
  for (const observation of valenceObservations) {
    const rotation = valenceRotationKey(observation.observedAt);
    if (!valenceRotationDays.has(rotation)) {
      valenceRotationDays.set(rotation, observationDayKey(observation.observedAt));
    }
    const weapon = observationText(observation.payload, "weaponName") || "Arme inconnue";
    const bonus = observationNumber(observation.payload, "bonus");
    if (bonus === undefined) continue;
    const bonuses = valenceByWeapon.get(weapon) ?? new Map<number, number>();
    if (!bonuses.has(rotation)) bonuses.set(rotation, bonus);
    valenceByWeapon.set(weapon, bonuses);
  }
  const valenceRotations = [...valenceRotationDays.keys()].sort((left, right) => right - left);
  const valenceHeaders = valenceRotations.map((rotation) => {
    const day = valenceRotationDays.get(rotation)!;
    const date = escapeHtml(formatObservationDay(day));
    return `<th class="history-day" title="${date}" aria-label="${date}"></th>`;
  }).join("");
  const valenceRows = [...valenceByWeapon.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "fr", { sensitivity: "base" }))
    .map(([weapon, bonuses]) => `<tr><td>${escapeHtml(weapon)}</td>${valenceRotations.map((rotation) => {
      const day = valenceRotationDays.get(rotation)!;
      const bonus = bonuses.get(rotation);
      return `<td title="${escapeHtml(formatObservationDay(day))}">${bonus === undefined ? "-" : `${bonus}%`}</td>`;
    }).join("")}</tr>`)
    .join("");
  const darvoRows = observations
    .filter((observation) => observation.provider === "warframe" && observation.category === "darvo")
    .map((observation) => {
      const item = formatArchivedItem(observationText(observation.payload, "StoreItem"));
      const discount = observationNumber(observation.payload, "Discount");
      const salePrice = observationNumber(observation.payload, "SalePrice");
      const originalPrice = observationNumber(observation.payload, "OriginalPrice");
      const total = observationNumber(observation.payload, "AmountTotal");
      const sold = observationNumber(observation.payload, "AmountSold");
      const stock = total === undefined ? "-" : `${Math.max(0, total - (sold ?? 0))}/${total}`;
      return `<tr><td>${formatObservationDate(observation.observedAt)}</td><td>${escapeHtml(item || "Article inconnu")}</td><td>${discount === undefined ? "-" : `-${discount}%`}</td><td>${salePrice === undefined ? "-" : `${salePrice}p`}${originalPrice === undefined ? "" : ` / ${originalPrice}p`}</td><td>${stock}</td></tr>`;
    }).join("");
  return layout("Historique", `
    ${pageHeader(user, "Historique", "/history")}
    <main>
      <h2>Rotations Coda et Tenet</h2>
      ${valenceRows ? `<div class="table-scroll"><table class="valence-history"><thead><tr><th>Arme</th>${valenceHeaders}</tr></thead><tbody>${valenceRows}</tbody></table></div>` : "<p>Aucun relevé Coda ou Tenet.</p>"}
      <h2 class="history-heading">Ventes Darvo</h2>
      ${darvoRows ? `<table><thead><tr><th>Relevé</th><th>Article</th><th>Remise</th><th>Prix</th><th>Stock</th></tr></thead><tbody>${darvoRows}</tbody></table>` : "<p>Aucune vente Darvo archivée.</p>"}
    </main>`);
}

function channelsPage(
  user: User,
  channels: ChannelSubscriptions[],
  result: { channel?: string; topics?: string }
): string {
  const summary = result.channel === undefined
    ? ""
    : `<p class="result">Channel ${escapeHtml(result.channel)} : ${safeCount(result.topics)} topic(s) actif(s).</p>`;
  const channelForms = channels.map((channel) => `
    <form method="post" action="/admin/channels" class="channel-form">
      <input type="hidden" name="destination" value="${escapeHtml(channel.channelId)}">
      <div class="channel-heading"><h2>${escapeHtml(channel.channelName)} <code>${escapeHtml(channel.channelId)}</code></h2><label class="inline"><input type="checkbox" name="createWebhook" value="1" ${channel.deliveryMode === "webhook" ? "checked" : ""}> Envoyer avec un webhook</label></div>
      <div class="topic-grid">${channelTopicInputs(new Set(channel.topics), `channel-${channel.channelId}`)}</div>
      <button type="submit">Enregistrer</button>
    </form>`).join("");
  return layout("Channels Discord", `
    ${pageHeader(user, "Channels Discord", "/admin/channels")}
    <main>
      ${summary}
      <form method="post" action="/admin/channels" class="channel-form new-channel">
        <label for="new-channel-destination"><strong>Ajouter un channel</strong></label>
        <div class="destination-row">
          <input id="new-channel-destination" name="destination" placeholder="ID du channel ou URL du webhook Discord" required>
          <label class="inline"><input type="checkbox" name="createWebhook" value="1"> Créer un webhook pour cet ID</label>
        </div>
        <div class="topic-grid">${channelTopicInputs(new Set(), "new-channel")}</div>
        <button type="submit">Ajouter</button>
      </form>
      ${channelForms || "<p>Aucun channel abonné.</p>"}
    </main>`);
}

function channelTopicInputs(selectedTopics: Set<string>, prefix: string): string {
  return topics.map((topic) => {
    const inputId = `${prefix}-${topic.id.replaceAll(".", "-")}`;
    return `<label for="${escapeHtml(inputId)}"><input id="${escapeHtml(inputId)}" type="checkbox" name="topic" value="${escapeHtml(topic.id)}" ${selectedTopics.has(topic.id) ? "checked" : ""}> ${escapeHtml(topic.label)}</label>`;
  }).join("");
}

function pageHeader(user: User, title: string, activePath: string): string {
  const links = [
    navLink("/subscriptions", "Abonnements", activePath),
    navLink("/history", "Historique", activePath),
    ...(user.isAdmin ? [
      '<span class="nav-separator" aria-hidden="true"></span>',
      navLink("/admin/logs", "Logs", activePath),
      navLink("/admin/messages", "Messages", activePath),
      navLink("/admin/channels", "Channels", activePath)
    ] : [])
  ].join("");
  return `<header class="app-header">
    <h1>${escapeHtml(title)}</h1>
    <div class="header-content">
      <nav aria-label="Navigation principale">${links}</nav>
      <div class="header-user"><span>${escapeHtml(user.username)}</span><form method="post" action="/logout"><button class="secondary" type="submit">Se déconnecter</button></form></div>
    </div>
  </header>`;
}

function navLink(path: string, label: string, activePath: string): string {
  const active = path === activePath;
  return `<a href="${path}"${active ? ' class="active" aria-current="page"' : ""}>${label}</a>`;
}

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><title>${escapeHtml(title)}</title><style>
    :root{font-family:system-ui,sans-serif;color:#172033;background:#f5f7fa}body{margin:0}header,main{max-width:900px;margin:auto;padding:24px}.app-header{display:grid;gap:14px;border-bottom:1px solid #d8dee9}.header-content{display:flex;align-items:center;justify-content:space-between;gap:20px}.header-content nav,.header-user{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.header-content nav a{text-decoration:none}.header-content nav a.active{color:#172033;font-weight:700}.nav-separator{width:1px;height:18px;background:#b8c0ce}.header-user{flex-wrap:nowrap}.header-user form{margin:0}.header-user button{margin:0;white-space:nowrap}h1{font-size:24px;margin:0}h2{font-size:16px;margin:0 0 12px}.history-heading{margin-top:32px}p{margin:0;color:#5b6578}section{border-top:1px solid #d8dee9}.topic{display:flex;gap:14px;padding:16px 4px;border-bottom:1px solid #d8dee9;cursor:pointer}.topic input{width:20px;height:20px}.topic span{display:grid;gap:3px}.topic small{color:#5b6578}button,.button{display:inline-block;margin-top:20px;padding:10px 16px;border:0;border-radius:6px;background:#5865f2;color:white;font-weight:600;text-decoration:none;cursor:pointer}.secondary{background:#5b6578}.danger{margin:0;background:#b42318}.login{text-align:center;padding-top:20vh}.trigger{display:grid;gap:10px;margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #d8dee9}.trigger select,.destination-row>input{max-width:480px;padding:9px;border:1px solid #b8c0ce;border-radius:4px;background:white}.trigger button{width:max-content;margin-top:0}.inline,.destination-row{display:flex;align-items:center;gap:8px}.destination-row{flex-wrap:wrap}.destination-row>input{flex:1;min-width:280px}.batch-actions{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.action-group,.channel-heading{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.compact-button{margin-top:0}.result{margin:0 0 18px;padding:10px;background:#e8eefc;color:#25376d}.channel-form{display:grid;gap:14px;padding:20px 0;border-bottom:1px solid #d8dee9}.channel-heading h2{margin:0}.channel-form button{width:max-content;margin:0}.topic-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.table-scroll{overflow-x:auto}.table-scroll th,.table-scroll td{white-space:nowrap}.valence-history{width:max-content;min-width:100%}.valence-history .history-day{width:0;padding:0}.valence-history td:not(:first-child){min-width:44px;padding-left:6px;padding-right:6px}table{width:100%;border-collapse:collapse;background:white}th,td{text-align:left;padding:10px;border-bottom:1px solid #d8dee9}tbody tr.selectable-row{cursor:pointer}tbody tr.selectable-row:hover{background:#f0f3f8}tbody tr.selectable-row.selected{background:#e8eefc}code{font-size:12px}a{color:#3346c8}.confirm-dialog{width:min(420px,calc(100% - 40px));padding:24px;border:0;border-radius:8px;box-shadow:0 20px 50px #17203340}.confirm-dialog::backdrop{background:#17203399}.confirm-dialog p{margin-top:10px}.dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:24px}.dialog-actions button{margin:0}@media(max-width:700px){header,main{padding:18px}.header-content{align-items:flex-start;flex-direction:column}.header-content nav{gap:10px 14px}.header-user{width:100%;justify-content:space-between}.topic-grid{grid-template-columns:1fr}.destination-row{align-items:flex-start;flex-direction:column}.destination-row>input{box-sizing:border-box;min-width:0;width:100%}table{font-size:13px}th,td{padding:7px}}
  </style></head><body>${body}
    <dialog id="confirmation-dialog" class="confirm-dialog" aria-labelledby="confirmation-title">
      <h2 id="confirmation-title">Confirmer la suppression</h2>
      <p id="confirmation-message"></p>
      <div class="dialog-actions"><button id="confirmation-cancel" class="secondary" type="button">Annuler</button><button id="confirmation-submit" class="danger" type="button">Supprimer</button></div>
    </dialog>
    <script>(function(){
      var dialog=document.getElementById('confirmation-dialog');
      var message=document.getElementById('confirmation-message');
      var cancel=document.getElementById('confirmation-cancel');
      var confirm=document.getElementById('confirmation-submit');
      var pendingForm=null;
      document.querySelectorAll('form[data-confirm-message]').forEach(function(form){
        form.addEventListener('submit',function(event){
          event.preventDefault();
          pendingForm=form;
          message.textContent=form.dataset.confirmMessage||'Confirmer cette action ?';
          dialog.showModal();
        });
      });
      cancel.addEventListener('click',function(){dialog.close()});
      confirm.addEventListener('click',function(){
        var form=pendingForm;
        pendingForm=null;
        dialog.close();
        if(form)HTMLFormElement.prototype.submit.call(form);
      });
      dialog.addEventListener('close',function(){pendingForm=null});
    })();</script>
  </body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function observationText(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function observationNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = Number(payload[key]);
  return Number.isFinite(value) ? value : undefined;
}

function formatArchivedItem(value: string): string {
  return (value.split("/").at(-1) ?? value).replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function formatObservationDate(value: Date): string {
  return escapeHtml(value.toLocaleString("fr-FR"));
}

function observationDayKey(value: Date): string {
  return value.toLocaleDateString("fr-CA");
}


function valenceRotationKey(value: Date): number {
  const intervalMs = 96 * 60 * 60 * 1000;
  const referenceMs = Date.UTC(2025, 2, 23);
  return Math.floor((value.getTime() - referenceMs) / intervalMs);
}

function formatObservationDay(value: string): string {
  return value.split("-").reverse().join("/");
}

function safeCount(value: string | undefined): string {
  return /^\d+$/.test(value ?? "") ? value! : "0";
}

function eventStatusLabel(event: EventLog): string {
  if (event.discordMessageState === "deleted") return "Supprimé";
  if (event.discordMessageState === "marked_expired") return "Expiré";
  if (event.discordMessageState === "mixed") return "Mixte";
  if (event.status === "expired" && event.discordMessageState === "active") return "Expiration échouée";
  if (event.status === "expired") return "Expiré";
  if (event.discordMessageState === "none") return "Non envoyé";
  return "Actif";
}

function rangeSelectionScript(inputName: string, selectAllId: string): string {
  return `<script>(function(){
    var boxes=Array.from(document.querySelectorAll('input[name="${inputName}"]'));
    var lastIndex=null;
    var selectAll=document.getElementById('${selectAllId}');
    function selectRange(box,index,event){
      if(event.shiftKey&&lastIndex!==null){var start=Math.min(lastIndex,index);var end=Math.max(lastIndex,index);for(var i=start;i<=end;i++){boxes[i].checked=box.checked}}
      lastIndex=index;
    }
    function sync(){
      boxes.forEach(function(box){var row=box.closest('tr');if(row){row.classList.toggle('selected',box.checked)}});
      if(selectAll){var checked=boxes.filter(function(box){return box.checked}).length;selectAll.checked=boxes.length>0&&checked===boxes.length;selectAll.indeterminate=checked>0&&checked<boxes.length}
    }
    boxes.forEach(function(box,index){
      var row=box.closest('tr');
      if(row){
        row.classList.add('selectable-row');
        row.addEventListener('click',function(event){
          if(event.target.closest&&event.target.closest('input,button,a,label,select,textarea'))return;
          box.checked=!box.checked;
          selectRange(box,index,event);
          sync();
        });
      }
      box.addEventListener('click',function(event){selectRange(box,index,event);sync()});
    });
    if(selectAll){selectAll.addEventListener('change',function(){boxes.forEach(function(box){box.checked=selectAll.checked});sync()})}
    sync();
  })();</script>`;
}

function readCookie(request: FastifyRequest, name: string): string | undefined {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function setSessionCookie(reply: FastifyReply, token: string, secure: boolean): void {
  reply.header("set-cookie", `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure ? "; Secure" : ""}`);
}

function clearSessionCookie(reply: FastifyReply, secure: boolean): void {
  reply.header("set-cookie", `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`);
}
