import {
  telegramAuthSchema,
  telegramWidgetAuthSchema,
  emailRegisterSchema,
  emailLoginSchema
} from '@bookquest/shared';

/** Request-shaped wrapper around the shared rule. */
export const telegramAuthBody = telegramAuthSchema;
export const telegramWidgetAuthBody = telegramWidgetAuthSchema;
export const emailRegisterBody = emailRegisterSchema;
export const emailLoginBody = emailLoginSchema;
