import { createHash } from "node:crypto";
import type { NotificationEvent } from "../core/events.js";
import { dailyScheduleKey, type EventProvider, type ProviderPollResult } from "../core/providers.js";

type WeaponFamily = "Coda" | "Tenet";

interface RotationSource {
  family: WeaponFamily;
  url: string;
  sectionHeading: string;
}

interface CodaProviderOptions {
  minimumBonus: number;
}

interface RotationOffer {
  family: WeaponFamily;
  weaponName: string;
  bonus: number;
  url: string;
  rotationIdentity: string;
}

const rotationSources: readonly RotationSource[] = [
  { family: "Coda", url: "https://wiki.warframe.com/w/Coda_Weapons", sectionHeading: "Current" },
  { family: "Tenet", url: "https://wiki.warframe.com/w/Tenet_Weapons", sectionHeading: "Current Valence Bonuses" }
];
const rotationIntervalMs = 96 * 60 * 60 * 1000;
const rotationReferenceMs = Date.UTC(2025, 2, 23);

export class CodaProvider implements EventProvider {
  readonly name = "warframe-coda-wiki";
  readonly topics = ["warframe.coda"] as const;

  constructor(private readonly options: CodaProviderOptions) {}

  scheduleKey(now: Date): string | undefined {
    return dailyScheduleKey(now, 6, 17);
  }

  async poll(): Promise<ProviderPollResult> {
    const observedAt = new Date();
    const expiresAt = rotationExpiry(observedAt);
    const offers: RotationOffer[] = [];
    let successfulSources = 0;

    for (const source of rotationSources) {
      try {
        const sourceOffers = await fetchRotation(source);
        successfulSources++;
        offers.push(...sourceOffers);
      } catch (error) {
        console.error("Valence rotation source failed", { family: source.family, error });
      }
    }

    if (successfulSources === 0) throw new Error("All Valence rotation sources failed");

    const observations = offers.map((offer) => ({
      observationId: `warframe:coda:${createHash("sha256").update(`${offer.family}|${offer.weaponName}|${observedAt.toISOString().slice(0, 10)}`).digest("hex")}`,
      provider: this.name,
      category: "rotations",
      observedAt,
      payload: { family: offer.family, weaponName: offer.weaponName, bonus: offer.bonus, url: offer.url }
    }));
    const events = offers
      .filter((offer) => offer.bonus >= this.options.minimumBonus)
      .map((offer): NotificationEvent => ({
        eventId: `warframe:coda:${createHash("sha256").update(`${offer.family}|${offer.rotationIdentity}|${offer.weaponName}|${offer.bonus}`).digest("hex")}`,
        topic: "warframe.coda",
        source: this.name,
        title: `${offer.weaponName} ${offer.bonus}%`,
        message: `${offer.weaponName} est à ${offer.bonus}% chez ${offer.family === "Coda" ? "Eleanor" : "Ergo Glast"} (${formatRemaining(expiresAt, observedAt)}).`,
        priority: "high",
        startsAt: observedAt,
        expiresAt,
        url: offer.url,
        metadata: { family: offer.family, weaponName: offer.weaponName, bonus: offer.bonus, minimumBonus: this.options.minimumBonus }
      }));
    return { events, observations };
  }
}

function rotationExpiry(now: Date): Date {
  const elapsedMs = now.getTime() - rotationReferenceMs;
  const cycle = Math.floor(elapsedMs / rotationIntervalMs);
  return new Date(rotationReferenceMs + (cycle + 1) * rotationIntervalMs);
}

function formatRemaining(expiry: Date, now: Date): string {
  const remainingSeconds = Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 1000));
  const days = Math.floor(remainingSeconds / 86_400);
  const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}

async function fetchRotation(source: RotationSource): Promise<RotationOffer[]> {
  const response = await fetch(source.url, {
    headers: { "user-agent": "game-notifier/0.1 valence-rotation-watcher" }
  });
  if (!response.ok) throw new Error(`${source.family} rotation page returned HTTP ${response.status}`);
  const html = await response.text();
  if (/Enable JavaScript and cookies|cf-chl|Cloudflare/i.test(html)) {
    throw new Error(`${source.family} rotation page is protected by a challenge page`);
  }

  const currentOffers = findRotationOffers(html, source);
  if (currentOffers.length === 0) throw new Error(`No current ${source.family} offers found`);
  const rotationIdentity = createHash("sha256")
    .update(currentOffers.map((offer) => `${offer.weaponName}|${offer.bonus}`).sort().join(";"))
    .digest("hex");
  return currentOffers.map((offer) => ({ ...offer, url: source.url, rotationIdentity }));
}

function findRotationOffers(
  html: string,
  source: RotationSource
): Array<Omit<RotationOffer, "url" | "rotationIdentity">> {
  const lines = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#37;/gi, "%")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sectionIndex = lines.findIndex((line) => line.toLocaleLowerCase() === source.sectionHeading.toLocaleLowerCase());
  if (sectionIndex < 0) return [];

  const offers: Array<Omit<RotationOffer, "url" | "rotationIdentity">> = [];
  const sectionLines = lines.slice(sectionIndex + 1, sectionIndex + 80);
  for (let index = 0; index < sectionLines.length; index++) {
    const weaponName = sectionLines[index];
    if (!weaponName || !isWeaponName(weaponName, source.family)) continue;

    let match: RegExpMatchArray | null = null;
    for (let offset = 1; offset <= 8 && index + offset < sectionLines.length; offset++) {
      const candidate = sectionLines[index + offset];
      if (!candidate || isWeaponName(candidate, source.family)) break;
      match = candidate.match(/^(\d+(?:\.\d+)?)\s*%$/);
      if (match) break;
    }
    if (!match) {
      if (offers.length > 0) break;
      continue;
    }

    const bonus = Number(match[1] ?? Number.NaN);
    if (Number.isFinite(bonus)) offers.push({ family: source.family, weaponName, bonus });
  }
  return [...new Map(offers.map((offer) => [offer.weaponName, offer])).values()];
}

function isWeaponName(value: string, family: WeaponFamily): boolean {
  return family === "Coda" ? /^(?:Dual )?Coda\s+/i.test(value) : /^Tenet\s+/i.test(value);
}
