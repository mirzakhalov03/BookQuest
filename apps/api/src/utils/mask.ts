/** "@mirzakhalov03" → "@mir…": enough to recognise, too little to enumerate. */
export function maskUsername(username: string | null | undefined): string {
  return username ? `@${username.replace(/^@/, '').slice(0, 3)}…` : 'your Telegram';
}
