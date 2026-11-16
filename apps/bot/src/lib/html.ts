import type { User } from 'telegraf/types';

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Clickable name; Telegram shows plain text when the person's privacy blocks the link. */
export const mention = (user: Pick<User, 'id' | 'first_name' | 'last_name'>): string => {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return `<a href="tg://user?id=${user.id}">${escapeHtml(name)}</a>`;
};
