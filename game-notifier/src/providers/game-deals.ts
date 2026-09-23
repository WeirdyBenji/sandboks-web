import { createHash } from "node:crypto";
import type { NotificationEvent } from "../core/events.js";
import { dailyScheduleKey, type EventProvider, type ProviderPollResult } from "../core/providers.js";

interface GameWatch {
  title: string;
  minSavings: number;
  pageSize?: number;
}

interface Deal {
  dealID: string;
  title: string;
  storeID: string;
  salePrice: string;
  normalPrice: string;
  savings: string;
}

interface Store {
  storeID: string;
  storeName: string;
  isActive: number;
}

export class GameDealsProvider implements EventProvider {
  readonly name = "cheapshark";
  readonly topics = ["games.deals"] as const;

  constructor(private readonly watchlist: GameWatch[]) {}

  scheduleKey(now: Date): string | undefined {
    return dailyScheduleKey(now, 9, 50);
  }

  async poll(): Promise<ProviderPollResult> {
    const stores = await fetchJson<Store[]>("https://www.cheapshark.com/api/1.0/stores");
    const storeNames = new Map(stores.filter((store) => store.isActive).map((store) => [store.storeID, store.storeName]));
    const batches = await Promise.all(this.watchlist.map(async (watch) => {
      const url = new URL("https://www.cheapshark.com/api/1.0/deals");
      url.searchParams.set("title", watch.title);
      url.searchParams.set("onSale", "1");
      url.searchParams.set("sortBy", "Price");
      url.searchParams.set("pageSize", String(watch.pageSize ?? 10));
      const deals = await fetchJson<Deal[]>(url.toString());
      const matchingDeals = deals.filter((deal) => deal.title.toLocaleLowerCase() === watch.title.toLocaleLowerCase());
      return matchingDeals
        .filter((deal) => Number(deal.savings) >= watch.minSavings)
        .map((deal) => mapDeal(deal, storeNames));
    }));
    return { events: batches.flat(), observations: [] };
  }
}

function mapDeal(deal: Deal, stores: Map<string, string>): NotificationEvent {
  const savings = Math.floor(Number(deal.savings));
  const identity = `${deal.dealID}:${deal.salePrice}:${savings}`;
  return {
    eventId: `cheapshark:${createHash("sha256").update(identity).digest("hex")}`,
    topic: "games.deals",
    source: "cheapshark",
    title: `Promo ${deal.title}`,
    message: `${deal.title} - ${deal.salePrice} $ au lieu de ${deal.normalPrice} $ (-${savings} %) chez ${stores.get(deal.storeID) ?? `store ${deal.storeID}`}`,
    priority: "default",
    url: `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(deal.dealID)}`,
    metadata: { dealId: deal.dealID, savings, storeId: deal.storeID }
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "user-agent": "game-notifier/0.1" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}
