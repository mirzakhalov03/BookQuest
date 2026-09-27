import { z } from 'zod';

/**
 * Parsed once, at boot, the same discipline `apps/api` uses — nothing
 * downstream reads `process.env` directly.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** The same BotFather token apps/api uses to verify initData — this
      process uses it to receive updates and send messages instead. */
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),

  /** Shared secret proving this process, not a browser, is calling the API. */
  BOT_SERVICE_TOKEN: z.string().min(32, 'BOT_SERVICE_TOKEN is required'),

  /** Where apps/api lives. No trailing slash. */
  API_BASE_URL: z.string().url().default('http://localhost:4000/api/v1'),

  /** The Mini App's URL — what the "Open BookQuest" button opens. Telegram
      refuses a web_app button that isn't HTTPS, so in local dev this must be
      the tunnel URL, not localhost. */
  WEB_APP_URL: z.string().url('WEB_APP_URL is required and must be a URL')
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
