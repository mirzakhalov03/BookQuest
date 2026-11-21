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

/** What a reading resource is, so the UI can pick an icon without parsing URLs. `store` = anywhere to buy or borrow it; `video` = a film or adaptation. */
export const BOOK_RESOURCE_KINDS = ['pdf', 'epub', 'audio', 'link', 'store', 'video'] as const;
export type BookResourceKind = (typeof BOOK_RESOURCE_KINDS)[number];

/** The four "where to get it" cards on the Book page, each fed by its own resource kinds. */
export const SOURCE_CARDS = ['ebook', 'movie', 'audio', 'offline'] as const;
export type SourceCard = (typeof SOURCE_CARDS)[number];

export const SOURCE_CARD_KINDS: Record<SourceCard, readonly BookResourceKind[]> = {
  ebook: ['pdf', 'epub', 'link'],
  movie: ['video'],
  audio: ['audio'],
  offline: ['store']
};

/** Admin-written steps per card; each line is one step. */
export const BOOK_GUIDE_MAX = 600;

/**
 * Roles are a closed set resolved from an environment allowlist at login and
 * re-read from the database on every admin request. There is deliberately no
 * endpoint that grants one.
 */
export const ROLES = ['participant', 'admin'] as const;
export type Role = (typeof ROLES)[number];
