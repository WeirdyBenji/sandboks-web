import "dotenv/config";
import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");
const optionalUrl = z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional());
const optionalPositiveInteger = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.coerce.number().int().min(1).optional()
);
const optionalPercentage = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.coerce.number().min(0).max(100).optional()
);
const jsonRecord = z.string().transform((value, context) => {
  try {
    return z.record(z.string(), z.string()).parse(JSON.parse(value));
  } catch {
    context.addIssue({ code: "custom", message: "must be a JSON object of strings" });
    return z.NEVER;
  }
});
const watchlist = z.string().transform((value, context) => {
  try {
    return z.array(z.object({
      title: z.string().min(1),
      minSavings: z.number().min(0).max(100).default(1),
      pageSize: z.number().int().min(1).max(60).optional()
    })).parse(JSON.parse(value));
  } catch {
    context.addIssue({ code: "custom", message: "must be a JSON array of game watches" });
    return z.NEVER;
  }
});

const schema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_PATH: z.string().default("./data/game-notifier.db"),
  POLL_INTERVAL_SECONDS: z.coerce.number().int().min(15).default(30),
  DEBUG_INTERVAL_MINUTES: optionalPositiveInteger,
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  ADMIN_DISCORD_USER_IDS: z.string().default(""),
  DISCORD_EXPIRED_MESSAGE_ACTION: z.enum(["delete", "mark"]).default("delete"),
  NTFY_BASE_URL: optionalUrl,
  NTFY_TOKEN: z.string().optional(),
  NTFY_TOPIC_MAP: jsonRecord.default({}),
  WARFRAME_ENABLED: booleanString.default(true),
  LICH_MIN_BONUS: optionalPercentage,
  DARVO_REFERENCE_MS: z.coerce.number().int().positive().default(1777863600000),
  FREE_GAMES_ENABLED: booleanString.default(true),
  GAME_DEALS_ENABLED: booleanString.default(false),
  GAME_DEALS_WATCHLIST: watchlist.default([])
});

const parsed = schema.parse(process.env);

export const config = {
  ...parsed,
  discordRedirectUri: `${parsed.PUBLIC_URL.replace(/\/$/, "")}/auth/discord/callback`,
  discordAdminUserIds: new Set(parsed.ADMIN_DISCORD_USER_IDS.split(",").map((id) => id.trim()).filter(Boolean)),
  isProduction: parsed.NODE_ENV === "production"
};
