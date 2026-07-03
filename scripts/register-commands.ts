/**
 * Register slash commands with Discord.
 * Run: npx tsx scripts/register-commands.ts
 * 
 * This registers /report and /status as global application commands.
 */

import 'dotenv/config';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const APP_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN) {
  console.error('Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN in env');
  process.exit(1);
}

const commands = [
  {
    name: 'report',
    description: 'Submit a report for AI-powered triage and tracking',
    type: 1, // CHAT_INPUT
    options: [
      {
        name: 'text',
        description: 'The report content (leave empty to open a form)',
        type: 3, // STRING
        required: false,
      },
    ],
  },
  {
    name: 'status',
    description: 'View bot status and recent command activity',
    type: 1,
  },
];

async function registerCommands() {
  const url = `${DISCORD_API_BASE}/applications/${APP_ID}/commands`;

  console.log(`Registering ${commands.length} commands...`);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to register commands (${res.status}):`, text);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`✅ Successfully registered ${data.length} commands:`);
  for (const cmd of data) {
    console.log(`   /${cmd.name} (id: ${cmd.id})`);
  }
}

registerCommands().catch(console.error);
