import { botInteractionsBatchSchema, botUserUpsertSchema } from '@bookquest/shared';

/** Request-shaped wrapper around the shared rule. */
export const botUserUpsertBody = botUserUpsertSchema;

/** apps/bot's batched log. Strict on every level: an unknown key means the two sides drifted. */
export const botInteractionsBody = botInteractionsBatchSchema;
