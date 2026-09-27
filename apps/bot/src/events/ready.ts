import { Client, REST, Routes, SlashCommandBuilder } from 'discord.js';

/**
 * Slash command definitions.
 * These are registered with Discord's REST API when the bot becomes ready.
 */
const slashCommands = [
  new SlashCommandBuilder()
    .setName('random')
    .setDescription('Tạo vòng quay may mắn 3D')
    .addStringOption((option) =>
      option
        .setName('items')
        .setDescription('Danh sách mục, cách nhau bởi dấu phẩy (VD: Alice, Bob, Charlie)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('game')
    .setDescription('Các mini-game giải trí')
    .addSubcommand((sub) =>
      sub
        .setName('wordchain')
        .setDescription('Nối từ tiếng Việt')
        .addStringOption((opt) =>
          opt.setName('word').setDescription('Từ bạn muốn nối').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('noitu')
        .setDescription('Nối từ tiếng Việt (bí danh)')
        .addStringOption((opt) =>
          opt.setName('word').setDescription('Từ bạn muốn nối').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('baucua')
        .setDescription('Bầu Cua Tôm Cá')
        .addStringOption((opt) =>
          opt
            .setName('item')
            .setDescription('Cửa bạn đặt (bầu/cua/tôm/cá/gà/nai)')
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName('bet').setDescription('Số DNE Coins cược').setRequired(true).setMinValue(1)
        )
    )
].map((cmd) => cmd.toJSON());

/**
 * ready event handler.
 * Logs the bot's tag and registers all slash commands via REST.
 */
export async function onReady(client: Client<true>): Promise<void> {
  console.log(`[Bot] Logged in as ${client.user.tag}`);

  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    console.error('[Bot] Missing DISCORD_TOKEN or DISCORD_CLIENT_ID — skipping slash command registration.');
    return;
  }

  try {
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(Routes.applicationCommands(clientId), { body: slashCommands });
    console.log(`[Bot] Successfully registered ${slashCommands.length} global slash command(s).`);
  } catch (err) {
    console.error('[Bot] Failed to register slash commands:', err);
  }
}
