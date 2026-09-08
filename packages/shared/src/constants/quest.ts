/**
 * The lifecycle a quest moves through. The Home screen reads this to decide
 * which countdown to show and which action to offer, so the names are chosen
 * to describe the participant's situation, not a database status.
 */
export const QUEST_PHASES = ['upcoming', 'reading', 'quiz', 'finished'] as const;
export type QuestPhase = (typeof QUEST_PHASES)[number];

/** Every participant number is four digits beginning with 3. */
export const PARTICIPANT_NUMBER_MIN = 3000;
export const PARTICIPANT_NUMBER_MAX = 3999;

/** 3000–3999 is exactly this many people. See TBD-5 in BACKEND-SPEC.md. */
export const PARTICIPANT_CAPACITY = PARTICIPANT_NUMBER_MAX - PARTICIPANT_NUMBER_MIN + 1;

export const CONTACT_METHODS = ['telegram', 'phone'] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

/** What a reading resource is, so the UI can pick an icon without parsing URLs. */
export const BOOK_RESOURCE_KINDS = ['pdf', 'epub', 'audio', 'link'] as const;
export type BookResourceKind = (typeof BOOK_RESOURCE_KINDS)[number];

/**
 * Roles are a closed set resolved from an environment allowlist at login and
 * re-read from the database on every admin request. There is deliberately no
 * endpoint that grants one.
 */
export const ROLES = ['participant', 'admin'] as const;
export type Role = (typeof ROLES)[number];
