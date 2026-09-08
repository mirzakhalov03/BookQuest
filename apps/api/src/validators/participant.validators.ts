import { registerParticipantSchema } from '@bookquest/shared';
import { z } from 'zod';

/** Request-shaped wrappers around the shared rules. */
export const registerParticipantBody = registerParticipantSchema;

export const participantNumberParams = z.object({
  number: z.coerce.number().int()
});
