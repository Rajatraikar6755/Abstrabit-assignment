import 'dotenv/config';
import { connectDB } from '../src/lib/db/connect';
import { Interaction } from '../src/models/Interaction';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

async function main() {
  await connectDB();
  console.log('Connected to MongoDB.');

  const latestButtons = await Interaction.find({ command: /^button:/ })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  if (latestButtons.length === 0) {
    console.log('No button click interactions found in the DB.');
    process.exit(0);
  }

  for (const btn of latestButtons) {
    console.log('\n========================================');
    console.log(`Interaction ID: ${btn.discordInteractionId}`);
    console.log(`Command: ${btn.command}`);
    console.log(`Username: ${btn.username}`);
    console.log(`CreatedAt: ${btn.createdAt}`);
    console.log('rawPayload message object:', JSON.stringify(btn.rawPayload?.message, null, 2));
  }

  process.exit(0);
}

main().catch(console.error);
