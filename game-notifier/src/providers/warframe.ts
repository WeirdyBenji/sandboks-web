import { createHash } from "node:crypto";
import type { NotificationEvent } from "../core/events.js";
import {
  dailyScheduleKey,
  hourlyScheduleKey,
  rollingScheduleKey,
  type EventProvider,
  type ProviderObservation,
  type ProviderPollResult
} from "../core/providers.js";

const WORLD_STATE_URL = "https://api.warframe.com/cdn/worldState.php";
const NODES_URL = "https://unpkg.com/warframe-worldstate-data@3.2.0/dist/data/solNodes.json";
const MISSIONS_URL = "https://unpkg.com/warframe-worldstate-data@3.2.0/dist/data/missionTypes.json";
const interestingItem = /(Forma|Orokin ?Catalyst|Orokin ?Reactor|UtilityUnlocker|Exilus Adapter|Arcane Adapter|Nitain|Orokin ?Cell|Archon ?Crystal)/i;
const unwantedItem = /(Mutalist ?Alad ?V ?Nav ?Coordinate|Infested ?Alad ?Coordinate|Fieldron|Detonite ?Injector|Mutagen ?Mass|Mutagen ?Sample|Energy ?Component|Chem ?Component|Bio ?Component|Grineer ?Combat ?Knife|Ascension ?Event ?Resource ?Item|Wraith|Vandal|Sheev)/i;
const darvoItem = /(^|\/)(Forma|AuraForma|StanceForma|UmbraForma|OrokinCatalyst|OrokinReactor|ExilusWarframeAdapter|ExilusWeaponAdapter)$/i;

type RawObject = Record<string, unknown>;
type WarframeFeed = "missions" | "sortie" | "darvo";

export class WarframeProvider implements EventProvider {
  readonly name: string;
  readonly topics: readonly string[];
  readonly authoritativeTopics: readonly string[];

  constructor(private readonly feed: WarframeFeed, private readonly darvoReferenceMs?: number) {
    this.name = `warframe-${feed}`;
    this.topics = feed === "missions"
      ? ["warframe.alerts", "warframe.invasions", "warframe.goals"]
      : [`warframe.${feed}`];
    this.authoritativeTopics = feed === "missions" ? ["warframe.invasions"] : [];
  }

  scheduleKey(now: Date): string | undefined {
    if (this.feed === "missions") return hourlyScheduleKey(now, [1, 31]);
    if (this.feed === "sortie") return dailyScheduleKey(now, 18, 10);
    return rollingScheduleKey(now, this.darvoReferenceMs!, 26 * 60 * 60 * 1000, [1, 12]);
  }

  async poll(): Promise<ProviderPollResult> {
    const [worldState, nodes, missions] = await Promise.all([
      fetchJson<RawObject>(WORLD_STATE_URL),
      fetchJson<Record<string, { value?: string }>>(NODES_URL).catch(() => ({})),
      fetchJson<Record<string, { value?: string }>>(MISSIONS_URL).catch(() => ({}))
    ]);
    if (this.feed === "missions" && !Array.isArray(worldState.Invasions)) {
      throw new Error("Warframe world state has no invasions array");
    }

    const sources = {
      alerts: arrayOf(worldState.Alerts),
      invasions: arrayOf(worldState.Invasions),
      goals: arrayOf(worldState.Goals),
      events: arrayOf(worldState.Events),
      sorties: arrayOf(worldState.Sorties),
      darvo: arrayOf(worldState.DailyDeals)
    };
    const events = (this.feed === "missions"
      ? [
          ...parseAlerts(sources.alerts, nodes, missions),
          ...parseInvasions(sources.invasions, nodes),
          ...parseGoals(sources.goals, nodes),
          ...parseWorldEvents(sources.events)
        ]
      : this.feed === "sortie"
        ? parseSorties(sources.sorties, nodes, missions)
        : parseDarvo(sources.darvo)
    ).filter((event) => !event.expiresAt || event.expiresAt.getTime() > Date.now());
    const observations = this.feed === "darvo" ? archiveRows("darvo", sources.darvo) : [];
    return { events, observations };
  }
}

function archiveRows(category: string, rows: RawObject[]): ProviderObservation[] {
  const observedAt = new Date();
  return rows.map((row) => {
    const identity = mongoId(row._id) || createHash("sha256").update(JSON.stringify(row)).digest("hex");
    return {
      observationId: `warframe:${category}:${identity}`,
      provider: "warframe",
      category,
      observedAt,
      payload: row
    };
  });
}

function parseAlerts(
  rows: RawObject[],
  nodes: Record<string, { value?: string }>,
  missions: Record<string, { value?: string }>
): NotificationEvent[] {
  return rows.flatMap((row) => {
    const mission = objectOf(row.MissionInfo);
    const rewards = rewardNames(mission.missionReward);
    const wanted = rewards.filter(isWantedReward);
    if (wanted.length === 0) return [];
    const important = wanted.filter(isInterestingReward);
    const node = nodeName(stringOf(mission.location), nodes);
    const missionType = missions[stringOf(mission.missionType)]?.value ?? stringOf(mission.missionType);
    const remaining = formatRemaining(dateOf(row.Expiry));
    return [event(row, "warframe.alerts", "Alerte Warframe", `Alerte : ${wanted.join(", ")} (${remaining}) ${node}`, {
      rewards: wanted,
      node,
      missionType,
      importantRewards: important
    }, "", important.length > 0 ? "high" : "default")];
  });
}

function parseInvasions(rows: RawObject[], nodes: Record<string, { value?: string }>): NotificationEvent[] {
  return rows.flatMap((row) => {
    if (Boolean(row.Completed)) return [];
    const rewards = [...rewardNames(row.AttackerReward, false), ...rewardNames(row.DefenderReward, false)].filter(isWantedReward);
    if (rewards.length === 0) return [];
    const important = rewards.filter(isInterestingReward);
    const node = nodeName(stringOf(row.Node), nodes);
    const expiry = dateOf(row.Expiry);
    const remaining = expiry ? formatRemaining(expiry) : invasionProgress(numberOf(row.Count), numberOf(row.Goal));
    return [event(row, "warframe.invasions", "Invasion Warframe", `Invasion : ${rewards.join(" / ")} (${remaining}) ${node}`, {
      rewards,
      node,
      remaining,
      importantRewards: important
    }, stringOf(row.Node), important.length > 0 ? "high" : "default")];
  });
}

function parseGoals(rows: RawObject[], nodes: Record<string, { value?: string }>): NotificationEvent[] {
  return rows.flatMap((row) => {
    const labelSource = `${stringOf(row.Tag)} ${stringOf(row.Desc)} ${stringOf(row.ToolTip)} ${stringOf(row.MissionKeyName)}`;
    if (/(Thermia|Fissure|Ghoul)/i.test(labelSource)) return [];
    const specialLabel = /razorback/i.test(labelSource)
      ? "Razorback"
      : /fomorian/i.test(labelSource)
        ? "Fomorian Threat"
        : undefined;
    const rewards = [
      ...rewardNames(row.Reward),
      ...arrayOf(row.InterimRewards).flatMap((reward) => rewardNames(reward))
    ].filter(isWantedReward);
    if (rewards.length === 0) return [];
    const important = rewards.filter(isInterestingReward);
    const node = specialLabel ?? nodeName(stringOf(row.Node), nodes);
    const remaining = formatRemaining(dateOf(row.Expiry));
    return [event(row, "warframe.goals", "Objectif Warframe", `Objectif : ${rewards.join(", ")} (${remaining}) ${node}`, {
      rewards,
      node,
      specialLabel,
      importantRewards: important
    }, stringOf(row.Node), important.length > 0 ? "high" : "default")];
  });
}

function parseWorldEvents(rows: RawObject[]): NotificationEvent[] {
  return rows.flatMap((row) => {
    const messages = arrayOf(row.Messages).map((message) => stringOf(message.Message));
    if (!messages.some((message) => /Plague Star/i.test(message))) return [];
    const startsAt = dateOf(row.EventStartDate) ?? dateOf(row.Date);
    if (startsAt && startsAt.getTime() > Date.now()) return [];
    const expiresAt = dateOf(row.EventEndDate)
      ?? dateOf(row.Expiry)
      ?? dateOf(row.Expiration)
      ?? dateOf(row.EndDate)
      ?? dateOf(row.EndTime)
      ?? plagueStarExpiry(messages, stringOf(row.Prop));
    const remaining = formatRemaining(expiresAt);
    const notification = event({
      ...row,
      Activation: startsAt,
      Expiry: expiresAt
    }, "warframe.goals", "Évènement Warframe", `Évènement : Plague Star (${remaining})`, {
      specialLabel: "Plague Star"
    }, "plague-star", "high");
    return [{
      ...notification,
      url: stringOf(row.Prop) || undefined
    }];
  });
}

function plagueStarExpiry(messages: readonly string[], prop: string): Date | undefined {
  const source = `${messages.join(" ")} ${prop}`;
  if (!/Plague Star|Fléau Céleste/i.test(source)) return undefined;
  if (/2026|2026-PlagueStar/i.test(source)) {
    return new Date(Date.UTC(2026, 8, 23, 14, 0));
  }
  return undefined;
}

function parseSorties(
  rows: RawObject[],
  nodes: Record<string, { value?: string }>,
  missions: Record<string, { value?: string }>
): NotificationEvent[] {
  return rows.flatMap((row) => arrayOf(row.Variants).flatMap((variant) => {
    if (!/(EXIMUS|STRONGHOLD|STRONGHOLDER|STRONG_HOLD)/i.test(stringOf(variant.modifierType))) return [];
    const node = nodeName(stringOf(variant.node), nodes);
    const mission = missions[stringOf(variant.missionType)]?.value ?? stringOf(variant.missionType);
    const expiresAt = dateOf(row.Expiry);
    const remaining = formatRemaining(expiresAt);
    return [event(row, "warframe.sortie", "Sortie Warframe", `Sortie : Eximus Stronghold (${mission}, ${remaining}) ${node}`, {
      node,
      mission,
      modifier: "Eximus Stronghold"
    }, "eximus-stronghold", "high")];
  }));
}

function parseDarvo(rows: RawObject[]): NotificationEvent[] {
  const row = rows.find((candidate) => darvoItem.test(stringOf(candidate.StoreItem)));
  if (!row) return [];
    const item = stringOf(row.StoreItem);
    const name = formatItem(item);
    const discount = numberOf(row.Discount);
    const salePrice = numberOf(row.SalePrice);
    const originalPrice = numberOf(row.OriginalPrice);
    const stock = numberOf(row.AmountTotal) - numberOf(row.AmountSold);
    const remaining = formatRemaining(dateOf(row.Expiry));
    const message = `Darvo vend ${name}.\nReduction : -${discount}%\nPrix : ${salePrice}p au lieu de ${originalPrice}p\nStock restant : ${stock}/${numberOf(row.AmountTotal)}\nExpire : ${remaining}`;
    const dealIdentity = `${item}|${dateOf(row.Activation)?.toISOString() ?? ""}|${discount}|${salePrice}`;
    return [event(row, "warframe.darvo", "Darvo", message, { item: name, discount, salePrice, stock }, dealIdentity, "high")];
}

function event(
  row: RawObject,
  topic: string,
  title: string,
  message: string,
  metadata: Record<string, unknown>,
  suffix = "",
  priority: NotificationEvent["priority"] = topic === "warframe.darvo" ? "high" : "default"
): NotificationEvent {
  const rawId = mongoId(row._id) || `${topic}:${message}:${dateOf(row.Activation)?.toISOString() ?? ""}`;
  const eventId = createHash("sha256").update(`${rawId}:${suffix}`).digest("hex");
  return {
    eventId,
    topic,
    source: "warframe-world-state",
    title,
    message,
    priority,
    startsAt: dateOf(row.Activation),
    expiresAt: dateOf(row.Expiry),
    metadata
  };
}

function rewardNames(reward: unknown, includeCount = true): string[] {
  if (Array.isArray(reward)) {
    return [...new Set(reward.flatMap((entry) => rewardNames(entry, includeCount)))];
  }
  if (typeof reward === "string") return [formatItem(reward)];
  const object = objectOf(reward);
  const items = Array.isArray(object.items)
    ? object.items.map((item) => formatItem(stringOf(item)))
    : [];
  const countedItems = arrayOf(object.countedItems).map((item) => {
    const name = formatItem(stringOf(item.ItemType));
    return includeCount ? `${name} x${numberOf(item.ItemCount) || 1}` : name;
  });
  const directItem = stringOf(object.ItemType);
  return [...new Set([...items, ...countedItems, ...(directItem ? [formatItem(directItem)] : [])].filter(Boolean))];
}

function isInterestingReward(name: string): boolean {
  return interestingItem.test(name) && !unwantedItem.test(name);
}

function isWantedReward(name: string): boolean {
  return !unwantedItem.test(name);
}

function formatItem(value: string): string {
  const raw = value.split("/").at(-1) ?? value;
  const knownNames: Record<string, string> = {
    Forma: "Forma",
    FormaBlueprint: "Forma Blueprint",
    AuraForma: "Aura Forma",
    AuraFormaBlueprint: "Aura Forma Blueprint",
    StanceForma: "Stance Forma",
    StanceFormaBlueprint: "Stance Forma Blueprint",
    UmbraForma: "Umbra Forma",
    UmbraFormaBlueprint: "Umbra Forma Blueprint",
    OrokinCatalyst: "Orokin Catalyst",
    OrokinCatalystBlueprint: "Orokin Catalyst Blueprint",
    OrokinReactor: "Orokin Reactor",
    OrokinReactorBlueprint: "Orokin Reactor Blueprint",
    UtilityUnlocker: "Exilus Adapter",
    UtilityUnlockerBlueprint: "Exilus Adapter Blueprint",
    WeaponUtilityUnlocker: "Weapon Exilus Adapter",
    WeaponUtilityUnlockerBlueprint: "Weapon Exilus Adapter Blueprint",
    WeaponSecondaryArcaneUnlocker: "Secondary Arcane Adapter",
    WeaponSecondaryArcaneUnlockerBlueprint: "Secondary Arcane Adapter Blueprint",
    WeaponMeleeArcaneUnlocker: "Melee Arcane Adapter",
    WeaponMeleeArcaneUnlockerBlueprint: "Melee Arcane Adapter Blueprint",
    ExilusWarframeAdapter: "Exilus Adapter",
    ExilusWeaponAdapter: "Weapon Exilus Adapter",
    Nitain: "Nitain Extract",
    OrokinCell: "Orokin Cell"
  };
  if (knownNames[raw]) return knownNames[raw];
  if (raw.startsWith("ArchonCrystal")) return raw.replace(/^ArchonCrystal/, "Archon Crystal ").trim();
  return raw
    .replace(/Blueprint$/, " Blueprint")
    .replace(/^WeaponUtilityUnlocker/, "Weapon Exilus Adapter")
    .replace(/^UtilityUnlocker/, "Exilus Adapter")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
}

function nodeName(value: string, nodes: Record<string, { value?: string }>): string {
  return nodes[value]?.value ?? value ?? "Node inconnu";
}

function invasionProgress(count: number, goal: number): string {
  if (!goal) return "progression inconnue";
  return `${((Math.abs(count) / goal) * 100).toFixed(1)}%`;
}

function formatRemaining(expiry?: Date): string {
  if (!expiry) return "temps restant inconnu";
  const minutes = Math.max(0, Math.floor((expiry.getTime() - Date.now()) / 60_000));
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return minutes > 0 ? `${minutes}m` : "<1m";
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "user-agent": "game-notifier/0.1" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function arrayOf(value: unknown): RawObject[] {
  return Array.isArray(value) ? value.filter((item): item is RawObject => Boolean(item) && typeof item === "object") : [];
}

function objectOf(value: unknown): RawObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RawObject : {};
}

function stringOf(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberOf(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function mongoId(value: unknown): string {
  const object = objectOf(value);
  return stringOf(object.$oid) || stringOf(value);
}

function dateOf(value: unknown): Date | undefined {
  const outer = objectOf(value);
  const raw = outer.$date ?? value;
  const nested = objectOf(raw);
  const timestamp = numberOf(nested.$numberLong ?? raw);
  return timestamp > 0 ? new Date(timestamp) : undefined;
}
