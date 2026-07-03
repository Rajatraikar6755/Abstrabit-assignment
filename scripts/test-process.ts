import 'dotenv/config';
import { connectDB } from '../src/lib/db/connect';
import { Interaction } from '../src/models/Interaction';
import { processInteraction } from '../src/services/interactionService';
import dns from 'dns';

// Force DNS override for local environment
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function main() {
  await connectDB();
  console.log('Connected to MongoDB.');

  // Find the last interaction
  const lastInteraction = await Interaction.findOne({ command: 'report' }).sort({ createdAt: -1 });

  if (!lastInteraction) {
    console.log('No report interactions found to test.');
    process.exit(0);
  }

  // Reset status to deferred
  lastInteraction.status = 'deferred';
  await lastInteraction.save();

  console.log(`Found and reset interaction: ID ${lastInteraction.discordInteractionId}`);
  console.log(`Command: /${lastInteraction.command}`);
  console.log(`Options:`, lastInteraction.commandOptions);

  console.log('\nRunning processInteraction...');
  try {
    await processInteraction(lastInteraction.discordInteractionId);
    console.log('✅ processInteraction completed successfully!');
  } catch (err) {
    console.error('❌ processInteraction failed:', err);
  }

  process.exit(0);
}

main().catch(console.error);
