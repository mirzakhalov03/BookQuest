/** Recomputes `signal` after a rule change in interaction-classify. Idempotent; streams, so memory stays flat. */
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { BotInteractionModel } from '../models/bot-interaction.model.js';
import { isSignal } from '../services/interaction-classify.services.js';
import { logger } from '../config/logger.js';

async function run(): Promise<void> {
  await connectToDatabase();
  let changed = 0;
  const cursor = BotInteractionModel.find(
    {},
    { kind: 1, command: 1, commandArgs: 1, inReplyTo: 1, signal: 1 }
  )
    .lean()
    .cursor();

  for await (const row of cursor) {
    const signal = isSignal({
      kind: row.kind,
      command: row.command ?? undefined,
      commandArgs: row.commandArgs ?? undefined,
      inReplyTo: row.inReplyTo ? { messageId: row.inReplyTo.messageId ?? 0 } : undefined
    });
    if (signal === row.signal) continue;
    await BotInteractionModel.updateOne({ _id: row._id }, { $set: { signal } });
    changed += 1;
  }

  logger.info({ changed }, 'Reclassified interactions');
  await disconnectFromDatabase();
}

run().catch((error: unknown) => {
  logger.error({ err: error }, 'Reclassify failed');
  process.exit(1);
});
