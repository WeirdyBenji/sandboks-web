import type { NotificationEvent } from "./events.js";

export interface ProviderObservation {
  observationId: string;
  provider: string;
  category: string;
  observedAt: Date;
  payload: unknown;
}

export interface ProviderPollResult {
  events: NotificationEvent[];
  observations: ProviderObservation[];
}

export interface EventProvider {
  readonly name: string;
  readonly topics: readonly string[];
  readonly authoritativeTopics?: readonly string[];
  readonly pollIntervalSeconds?: number;
  readonly maxNewEventsPerPoll?: number;
  scheduleKey?(now: Date): string | undefined;
  poll(): Promise<ProviderPollResult>;
}

export function dailyScheduleKey(now: Date, hour: number, minute: number): string | undefined {
  if (now.getHours() !== hour || now.getMinutes() !== minute) return undefined;
  return `${localDateKey(now)}:${hour}:${minute}`;
}

export function hourlyScheduleKey(now: Date, minutes: readonly number[]): string | undefined {
  if (!minutes.includes(now.getMinutes())) return undefined;
  return `${localDateKey(now)}:${now.getHours()}:${now.getMinutes()}`;
}

export function rollingScheduleKey(
  now: Date,
  referenceMs: number,
  intervalMs: number,
  offsetsMinutes: readonly number[]
): string | undefined {
  const elapsedMs = now.getTime() - referenceMs;
  if (elapsedMs < 0) return undefined;
  const cycle = Math.floor(elapsedMs / intervalMs);
  const cycleElapsedMs = elapsedMs % intervalMs;
  const offset = offsetsMinutes.find((minutes) => {
    const offsetMs = minutes * 60_000;
    return cycleElapsedMs >= offsetMs && cycleElapsedMs < offsetMs + 60_000;
  });
  return offset === undefined ? undefined : `${cycle}:${offset}`;
}

function localDateKey(now: Date): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}
