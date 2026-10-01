import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';

/**
 * Builds the rich categorized help embed.
 */
export function createHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🛡️ Hướng Dẫn Sử Dụng Sentinel Bot')
    .setDescription(
      'Dưới đây là danh sách toàn bộ các lệnh Slash Command của Sentinel Bot được phân loại theo từng nhóm tính năng:'
    )
    .setColor(0x5865f2)
    .addFields(
      {
        name: '🎮 Giải Trí & Mini-Games',
        value:
          '• `/random items:<mục 1, mục 2,...>` — Tạo vòng quay may mắn 3D\n' +
          '• `/game tictactoe` — Chơi cờ ca-rô 3×3 đối kháng 2 người\n' +
          '• `/game rps` — Oẳn tù tì chọn kín đối kháng\n' +
          '• `/game wordchain word:<từ>` — Nối từ tiếng Việt (hoặc `/game noitu`)\n' +
          '• `/game baucua item:<cửa> bet:<xu>` — Đặt cược Bầu Cua Tôm Cá\n' +
          '• `/game open id:<mã ván>` — Mở ván cờ/oẳn tù tì từ web vào Discord'
      },
      {
        name: '💰 Kinh Tế & Tiến Trình',
        value:
          '• `/daily` — Điểm danh nhận DNE Coins hằng ngày và duy trì chuỗi streak\n' +
          '• `/rep user:<thành viên> [reason:<lý do>]` — Tặng điểm tín nhiệm / yêu mến (tối đa 3 lần/ngày)\n' +
          '• `/gacha spin` — Vòng quay may mắn nhận DNE Coins, XP và vật phẩm (1 lượt miễn phí/ngày)'
      },
      {
        name: '💬 Cộng Đồng & Xã Hội',
        value:
          '• `/confess send` — Gửi tâm sự ẩn danh 100% (hoặc nhắn tin DM trực tiếp với bot)\n' +
          '• `/confess config channel:<#kênh>` — Cấu hình kênh nhận confession (Admin)\n' +
          '• `/confess delete id:<mã>` — Xóa bài confession theo mã số (Admin)\n' +
          '• `/bet challenge user:<đối thủ> amount:<xu> title:<kèo> pick:<chọn>` — Thách đấu 1v1\n' +
          '• `/bet pool-create title:<kèo> options:<các lựa chọn> [duration:<thời gian>]` — Tạo kèo cộng đồng\n' +
          '• `/bet pool-join id:<mã kèo> option:<lựa chọn> amount:<xu>` — Đặt cược kèo cộng đồng\n' +
          '• `/qotd today` — Xem câu hỏi hôm nay, bình chọn và trả lời câu đố nhận thưởng\n' +
          '• `/qotd config channel:<#kênh>` — Cấu hình kênh đăng QOTD tự động (Admin)'
      },
      {
        name: '🐾 Thú Cưng & Danh Hiệu',
        value:
          '• `/pet adopt type:<mèo/chó/rồng/cáo> name:<tên>` — Nhận nuôi thú cưng ảo (Zero-Death)\n' +
          '• `/pet status [user:<thành viên>]` — Xem tình trạng, độ no và tâm trạng thú cưng\n' +
          '• `/pet feed [user:<thành viên>]` — Cho thú cưng ăn (+độ no, 10 DNE Coins)\n' +
          '• `/pet play` — Chơi đùa cùng thú cưng (+vui vẻ, nhận quà ngẫu nhiên)\n' +
          '• `/badge list` — Xem bộ sưu tập 10 huy hiệu thành tựu và tiến độ mở khóa\n' +
          '• `/badge equip id:<mã>` · `/badge unequip` — Trang bị hoặc tháo huy hiệu cá nhân\n' +
          '• `/profile [user:<thành viên>]` — Xem hồ sơ cá nhân tổng hợp & mở ngăn tủ huy hiệu'
      },
      {
        name: '📊 Thống Kê & Tiện Ích',
        value:
          '• `/stats` — Xem thống kê hoạt động của bạn trong server (chat, voice, XP, cấp độ, xu)\n' +
          '• `/serverstats` — Xem thống kê cộng dồn toàn server và link dashboard\n' +
          '• `/leaderboard type:<chat|voice>` — Xem top 10 thành viên chat hoặc voice nhiều nhất\n' +
          '• `/remind set in:<10m|2h|1d> text:<nội dung>` — Tạo lời nhắc cá nhân gửi qua DM riêng\n' +
          '• `/remind list` · `/remind cancel id:<mã>` — Xem và hủy lời nhắc đang chờ\n' +
          '• `/help` — Xem bảng danh sách hướng dẫn này'
      }
    )
    .setFooter({ text: 'Sentinel Bot • Đồng hành cùng server Discord của bạn' })
    .setTimestamp();
}

export async function handleHelpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = createHelpEmbed();
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

