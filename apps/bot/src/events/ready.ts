import { Client, REST, Routes, SlashCommandBuilder } from 'discord.js';

/**
 * Slash command definitions.
 * These are registered with Discord's REST API when the bot becomes ready.
 */
export const slashCommands = [
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
    ),
  new SlashCommandBuilder().setName('stats').setDescription('Xem thống kê hoạt động của bạn trong server'),
  new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Tạo và quản lý lời nhắc cá nhân qua DM')
    .addSubcommand((sub) => sub.setName('set').setDescription('Tạo lời nhắc qua DM')
      .addStringOption((option) => option.setName('in').setDescription('Sau bao lâu: 10m, 2h hoặc 1d').setRequired(true))
      .addStringOption((option) => option.setName('text').setDescription('Nội dung nhắc nhở').setRequired(true).setMaxLength(200)))
    .addSubcommand((sub) => sub.setName('list').setDescription('Xem lời nhắc đang chờ và gửi thất bại'))
    .addSubcommand((sub) => sub.setName('cancel').setDescription('Hủy lời nhắc đang chờ')
      .addStringOption((option) => option.setName('id').setDescription('Mã lời nhắc').setRequired(true))),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Xem bảng xếp hạng chat hoặc voice trong server')
    .addStringOption((option) => option
      .setName('type')
      .setDescription('Loại bảng xếp hạng')
      .setRequired(true)
      .addChoices({ name: 'Chat', value: 'chat' }, { name: 'Voice', value: 'voice' })),
  new SlashCommandBuilder().setName('help').setDescription('Xem các lệnh Sentinel đang hỗ trợ')
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
