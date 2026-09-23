import type { NotificationEvent } from "../core/events.js";
import { dailyScheduleKey, type EventProvider, type ProviderPollResult } from "../core/providers.js";

interface Giveaway {
  id: number;
  title: string;
  type: string;
  worth?: string;
  platforms?: string;
  end_date?: string;
  open_giveaway_url?: string;
  gamerpower_url?: string;
}

const freeGameTopics = {
  steam: "games.free.steam",
  epic: "games.free.epic",
  itchio: "games.free.itchio",
  other: "games.free.other"
} as const;

type FreeGamePlatform = keyof typeof freeGameTopics;

export class FreeGamesProvider implements EventProvider {
  readonly name = "gamerpower";
  readonly topics = Object.values(freeGameTopics);
  readonly maxNewEventsPerPoll = 20;

  scheduleKey(now: Date): string | undefined {
    return dailyScheduleKey(now, 9, 30);
  }

  async poll(): Promise<ProviderPollResult> {
    const url = new URL("https://www.gamerpower.com/api/giveaways");
    url.searchParams.set("platform", "pc");
    url.searchParams.set("type", "game");
    url.searchParams.set("sort-by", "date");
    const response = await fetch(url, { headers: { "user-agent": "game-notifier/0.1" } });
    if (!response.ok) throw new Error(`GamerPower returned HTTP ${response.status}`);
    const giveaways = await response.json() as Giveaway[];
    const events: NotificationEvent[] = giveaways
      .filter((giveaway) => /^game$/i.test(giveaway.type))
      .sort((left, right) => {
        const platformOrder = Number(!/steam/i.test(left.platforms ?? "")) - Number(!/steam/i.test(right.platforms ?? ""));
        return platformOrder || left.title.localeCompare(right.title);
      })
      .map((giveaway) => {
        const platform = classifyPlatform(giveaway.platforms);
        return {
          eventId: `gamerpower:${giveaway.id}`,
          topic: freeGameTopics[platform],
          source: "gamerpower",
          title: "Jeu gratuit",
          message: `${giveaway.title} (${giveaway.worth || "prix inconnu"}, ${giveaway.platforms || "PC"})`,
          priority: "default",
          expiresAt: parseDate(giveaway.end_date),
          url: giveaway.open_giveaway_url || giveaway.gamerpower_url,
          metadata: { giveawayId: giveaway.id, platform, platforms: giveaway.platforms }
        };
      });
    return {
      events,
      observations: []
    };
  }
}

function classifyPlatform(platforms?: string): FreeGamePlatform {
  if (/steam/i.test(platforms ?? "")) return "steam";
  if (/epic games store/i.test(platforms ?? "")) return "epic";
  if (/itch\.io/i.test(platforms ?? "")) return "itchio";
  return "other";
}

function parseDate(value?: string): Date | undefined {
  if (!value || value === "N/A") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
