import {
  telegramAuthSchema,
  telegramWidgetAuthSchema,
  phoneRegisterSchema,
  phoneLoginSchema
} from '@bookquest/shared';

/** Request-shaped wrapper around the shared rule. */
export const telegramAuthBody = telegramAuthSchema;
export const telegramWidgetAuthBody = telegramWidgetAuthSchema;
export const phoneRegisterBody = phoneRegisterSchema;
export const phoneLoginBody = phoneLoginSchema;
