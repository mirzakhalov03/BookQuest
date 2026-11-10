/**
 * Every reply-keyboard label the bot shows. A tapped reply-keyboard button
 * arrives as plain text, so this registry is the only way the log can tell a
 * tap from typing. Add each new label here, and use it from here.
 */
export const REPLY_KEYBOARD_LABELS: ReadonlySet<string> = new Set<string>([]);
