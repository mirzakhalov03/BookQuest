import { z } from 'zod';
import { CONTACT_METHODS } from '../constants/quest.js';
import { parseFullName } from './full-name.js';
import { parsePhoneNumber, parseTelegramUsername } from './contact.js';

export const contactSchema = z.object({
  method: z.enum(CONTACT_METHODS),
  value: z.string().min(1)
});

/**
 * What the registration form sends. Parsing also normalises: the caller gets
 * back "Sofia Karimova" and "+998 90 123 45 67", never the raw keystrokes.
 */
export const registerParticipantSchema = z
  .object({
    fullName: z.string(),
    contactMethod: z.enum(CONTACT_METHODS),
    contactValue: z.string()
  })
  .transform((input, ctx) => {
    const name = parseFullName(input.fullName);
    if (!name.ok) {
      ctx.addIssue({ code: 'custom', message: name.message, path: ['fullName'] });
      return z.NEVER;
    }

    const contact =
      input.contactMethod === 'telegram'
        ? parseTelegramUsername(input.contactValue)
        : parsePhoneNumber(input.contactValue);

    if (!contact.ok) {
      ctx.addIssue({ code: 'custom', message: contact.message, path: ['contactValue'] });
      return z.NEVER;
    }

    return {
      fullName: name.value,
      contact: { method: input.contactMethod, value: contact.value }
    };
  });

export type RegisterParticipantInput = z.input<typeof registerParticipantSchema>;
export type RegisterParticipantPayload = z.output<typeof registerParticipantSchema>;

/** What the API returns for a participant. */
export const participantSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  fullName: z.string(),
  contact: contactSchema,
  questId: z.string(),
  registeredAt: z.string()
});

export type Participant = z.infer<typeof participantSchema>;

/**
 * Everyone else's view of a participant. No contact, ever — numbers are
 * sequential, so anything returned here is effectively enumerable by anyone
 * with a session.
 */
export const participantPublicSchema = z.object({
  number: z.number().int(),
  fullName: z.string()
});

export type ParticipantPublic = z.infer<typeof participantPublicSchema>;
