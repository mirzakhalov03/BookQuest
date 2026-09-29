import {
  telegramAuthSchema,
  telegramWidgetAuthSchema,
  phoneRegisterSchema,
  phoneLoginSchema,
  telegramCodeRequestSchema,
  telegramCodeVerifySchema,
  updateProfileSchema
} from '@bookquest/shared';

/** Request-shaped wrapper around the shared rule. */
export const telegramAuthBody = telegramAuthSchema;
export const telegramWidgetAuthBody = telegramWidgetAuthSchema;
export const phoneRegisterBody = phoneRegisterSchema;
export const phoneLoginBody = phoneLoginSchema;
export const telegramCodeRequestBody = telegramCodeRequestSchema;
export const telegramCodeVerifyBody = telegramCodeVerifySchema;
export const updateProfileBody = updateProfileSchema;
