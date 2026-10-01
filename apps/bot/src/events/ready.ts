import { Client, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { petSlashCommand } from '../commands/pet.js';
import { badgeSlashCommand } from '../commands/badge.js';
import { profileSlashCommand } from '../commands/profile.js';


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
    )
    .addSubcommand((sub) => sub.setName('tictactoe').setDescription('Chơi cờ 3×3 cùng một người khác'))
    .addSubcommand((sub) => sub.setName('rps').setDescription('Chơi oẳn tù tì chọn kín'))
    .addSubcommand((sub) => sub.setName('open').setDescription('Mở ván tạo trên web trong Discord')
      .addStringOption((opt) => opt.setName('id').setDescription('Mã ván 21 ký tự').setRequired(true))),
  new SlashCommandBuilder().setName('stats').setDescription('Xem thống kê hoạt động của bạn trong server'),
  new SlashCommandBuilder().setName('serverstats').setDescription('Xem thống kê cộng dồn của server'),
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
  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Điểm danh nhận DNE Coins hằng ngày và duy trì chuỗi streak'),
  new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Tặng điểm tín nhiệm / yêu mến cho thành viên khác (tối đa 3 lần/ngày)')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Thành viên bạn muốn +rep').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Lời khen hoặc lý do (tùy chọn)').setMaxLength(500)
    ),
  new SlashCommandBuilder()
    .setName('gacha')
    .setDescription('Vòng quay may mắn nhận DNE Coins, XP và vật phẩm')
    .addSubcommand((sub) =>
      sub.setName('spin').setDescription('Quay gacha (1 lượt miễn phí mỗi ngày, sau đó 200 DNE Coins)')
    ),
  new SlashCommandBuilder()
    .setName('confess')
    .setDescription('Gửi tin nhắn ẩn danh vào kênh confession của server')
    .addSubcommand((sub) =>
      sub
        .setName('send')
        .setDescription('Gửi confession ẩn danh qua form nhập liệu')
    )
    .addSubcommand((sub) =>
      sub
        .setName('config')
        .setDescription('Cấu hình kênh nhận confession (Admin)')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Kênh text nhận confession')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Xóa bài confession theo ID (Admin)')
        .addIntegerOption((opt) =>
          opt
            .setName('id')
            .setDescription('Mã số confession (#ID)')
            .setRequired(true)
        )
    ),
  new SlashCommandBuilder()
    .setName('bet')
    .setDescription('Hệ thống cá cược: thách đấu 1v1 hoặc tạo kèo cộng đồng')
    .addSubcommand((sub) =>
      sub
        .setName('challenge')
        .setDescription('Thách đấu 1v1 với thành viên khác')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Đối thủ muốn thách đấu').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('Số DNE Coins đặt cược (tối thiểu 10)')
            .setRequired(true)
            .setMinValue(10)
        )
        .addStringOption((opt) =>
          opt
            .setName('title')
            .setDescription('Tiêu đề kèo thách đấu')
            .setRequired(true)
            .setMaxLength(200)
        )
        .addStringOption((opt) =>
          opt
            .setName('pick')
            .setDescription('Lựa chọn của bạn')
            .setRequired(true)
            .setMaxLength(50)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('accept')
        .setDescription('Chấp nhận lời thách đấu 1v1')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('Mã kèo thách đấu (Bet ID)').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Hủy hoặc từ chối kèo thách đấu 1v1')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('Mã kèo thách đấu (Bet ID)').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('pool-create')
        .setDescription('Tạo kèo cá cược cộng đồng')
        .addStringOption((opt) =>
          opt
            .setName('title')
            .setDescription('Tiêu đề sự kiện cá cược')
            .setRequired(true)
            .setMaxLength(200)
        )
        .addStringOption((opt) =>
          opt
            .setName('options')
            .setDescription('Các lựa chọn phân cách bằng dấu phẩy (tối thiểu 2)')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('duration')
            .setDescription('Thời gian mở cược (vd: 30m, 2h, 1d)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('pool-join')
        .setDescription('Đặt cược vào kèo cộng đồng')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('Mã kèo cộng đồng (Bet ID)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('option').setDescription('Tên lựa chọn bạn đặt').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('Số DNE Coins đặt cược (tối thiểu 10)')
            .setRequired(true)
            .setMinValue(10)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('pool-resolve')
        .setDescription('Kết toán và trả thưởng kèo cộng đồng (Admin/Host)')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('Mã kèo cộng đồng (Bet ID)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('winner').setDescription('Lựa chọn chiến thắng').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('p2p-resolve')
        .setDescription('Kết toán kèo thách đấu 1v1 (Admin hoặc người tham gia)')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('Mã kèo 1v1 (Bet ID)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('winner')
            .setDescription('Người chiến thắng (creator hoặc opponent)')
            .setRequired(true)
        )
    ),
  new SlashCommandBuilder()
    .setName('qotd')
    .setDescription(
      'Câu hỏi hằng ngày (Would You Rather, This/That, Trivia thưởng coin + XP)'
    )
    .addSubcommand((sub) =>
      sub
        .setName('today')
        .setDescription('Xem câu hỏi hôm nay và tỷ lệ bình chọn')
    )
    .addSubcommand((sub) =>
      sub
        .setName('config')
        .setDescription('Cấu hình kênh nhận câu hỏi hằng ngày (Admin)')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Kênh text nhận QOTD')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('post')
        .setDescription('Đăng câu hỏi hôm nay thủ công (Admin)')
    ),
  petSlashCommand,
  badgeSlashCommand,
  profileSlashCommand,
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
