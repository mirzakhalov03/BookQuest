import type { ContactIssue, FullNameIssue } from '@bookquest/shared';

export const validation = {
  fullName: {
    missing: 'Your name goes on the certificate — add it here.',
    digits: 'Names don’t have numbers in them.',
    characters: 'Letters, hyphens and apostrophes only.',
    one_word: 'Please enter your first and last name.',
    too_many_words: 'First and last name is enough — two words.',
    too_short: 'Both names need at least two letters.',
    not_a_name: 'That doesn’t look like a name yet. Try your real one.'
  } satisfies Record<FullNameIssue, string>,
  contact: {
    telegram_missing: 'Add the username people find you by on Telegram.',
    telegram_short: 'Telegram usernames are at least 5 characters.',
    telegram_long: 'That’s longer than a Telegram username can be.',
    telegram_format: 'Usernames use letters, numbers and underscores, starting with a letter.',
    phone_missing: 'Add a number we can reach you on.',
    phone_short: 'That number looks a few digits short.',
    phone_long: 'That number has a few digits too many.'
  } satisfies Record<ContactIssue, string>
};
