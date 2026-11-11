import { z } from 'zod';
import { toCanonicalPhone } from '@bookquest/shared';

/**
 * Environment is parsed once, at boot, and the process refuses to start if it
 * is wrong. Nothing downstream reads process.env directly, so there is exactly
 * one place to look when a deployment misbehaves.
 */
function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /* ── Auth ────────────────────────────────────────────────────────────────
     The bot token is the root of the whole security model: every session is
     derived from an HMAC keyed by it. A service without one cannot
     authenticate anybody, so it refuses to start rather than pretending. */
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required (BotFather token)'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** Shared secret only `apps/bot` holds. It authenticates the bot process
      itself, not a person — there is no Telegram initData to verify for a
      service call. Generate with: openssl rand -hex 32 */
  BOT_SERVICE_TOKEN: z.string().min(32, 'BOT_SERVICE_TOKEN must be at least 32 characters'),
  /** HMAC key for login codes — the DB only ever holds the hash. Generate with: openssl rand -hex 32 */
  LOGIN_CODE_SECRET: z.string().min(32, 'LOGIN_CODE_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN_DAYS: z.coerce.number().int().positive().max(90).default(7),
  /** How long a signed initData string stays usable — the replay window. */
  AUTH_INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(3600),

  /** The entire admin model: a comma-separated allowlist of Telegram user ids. */
  ADMIN_TELEGRAM_IDS: z.string().default(''),
  /** Phone numbers that sign in as organisers — only with ADMIN_PASSWORD. */
  ADMIN_PHONE_NUMBERS: z.string().default(''),
  /** The organisers' shared password for the numbers above. */
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters').optional(),

  RATE_LIMIT_REGISTER_PER_HOUR: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_GLOBAL_PER_MINUTE: z.coerce.number().int().positive().default(300),
  /** Mini App initData exchange. Each call needs a valid signature, so it can be looser. */
  RATE_LIMIT_TELEGRAM_AUTH_PER_MINUTE: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_LOGIN_CODE_PER_HOUR: z.coerce.number().int().positive().default(10),
  /** Proxies between the client and the API in production (the host's load balancer). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),

  /** The organisers' zone (IANA name): where "today" starts on the dashboard. */
  ORGANISER_TIME_ZONE: z
    .string()
    .default('Asia/Tashkent')
    .refine(isTimeZone, 'ORGANISER_TIME_ZONE must be an IANA zone, e.g. Asia/Tashkent'),

  /** How long bot interactions are kept. A TTL index enforces it; boot re-syncs the index if this changes. */
  INTERACTION_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(365),

  /** Absolute URL of the web app, for certificate links and bot messages. */
  WEB_APP_URL: z.string().url().optional(),
  /** Absolute base of this API as browsers reach it — cover URLs are built from it per response. */
  PUBLIC_API_URL: z.string().url().optional(),

  /** Dev drill only: exit right after finalise's first write, so crash repair can be exercised. */
  QUIZ_DRILL_CRASH_AFTER_FINALIZE: z
    .string()
    .optional()
    .transform((value) => value === 'true' || value === '1')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${detail}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
/** Never honoured in production: a crash switch has no business there. */
export const quizDrillCrashAfterFinalize = env.QUIZ_DRILL_CRASH_AFTER_FINALIZE && !isProduction;

/** Comma-separated list, so preview deployments can be added without a code change. */
export const corsOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

/** Prefixed onto cover paths in responses, so it must be the address browsers use, not an internal one. */
export const publicApiUrl = (env.PUBLIC_API_URL ?? `http://localhost:${env.PORT}`).replace(/\/+$/, '');

/** Where certificate QR codes and bot buttons point. Dev falls back to Vite's port; sending certificates refuses without the real one. */
export const webAppUrl = (env.WEB_APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');

const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Telegram ids stay strings everywhere. Some accounts have ids beyond 2^53, so
 * a number would round-trip incorrectly and silently match the wrong person.
 */
export const adminTelegramIds: ReadonlySet<string> = new Set(splitList(env.ADMIN_TELEGRAM_IDS));
export const adminPhoneNumbers: ReadonlySet<string> = new Set(
  splitList(env.ADMIN_PHONE_NUMBERS).map(toCanonicalPhone)
);

/**
 * Configuration that is legal but probably wrong. Collected here and logged by
 * the server once the logger exists — env.ts cannot import the logger, because
 * the logger is configured from env.
 */
export const configWarnings: string[] = [];

if (adminTelegramIds.size === 0) {
  const message =
    'ADMIN_TELEGRAM_IDS is empty — no account can reach /admin. Set it to a comma-separated list of Telegram user ids.';
  if (isProduction) throw new Error(`Invalid environment configuration:\n  ${message}`);
  configWarnings.push(message);
}

if (adminPhoneNumbers.size > 0 && !env.ADMIN_PASSWORD) {
  const message = 'ADMIN_PHONE_NUMBERS is set but ADMIN_PASSWORD is not — phone admins cannot sign in.';
  if (isProduction) throw new Error(`Invalid environment configuration:\n  ${message}`);
  configWarnings.push(message);
}

if (isProduction && !env.PUBLIC_API_URL) {
  configWarnings.push(
    "PUBLIC_API_URL is not set — cover URLs will point at localhost. Set it to the API's public origin."
  );
}

if (isProduction && !env.WEB_APP_URL) {
  configWarnings.push(
    'WEB_APP_URL is not set — certificate QR codes and links will be wrong, and sending certificates is disabled.'
  );
}

if (isProduction && env.QUIZ_DRILL_CRASH_AFTER_FINALIZE) {
  configWarnings.push('QUIZ_DRILL_CRASH_AFTER_FINALIZE is set in production — ignored. Remove it.');
}
