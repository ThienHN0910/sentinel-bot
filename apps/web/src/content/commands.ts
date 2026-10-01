export interface CommandDoc {
  name: string;
  syntax: string;
  summary: string;
  example: string;
  note: string;
}

export const commands: CommandDoc[] = [
  {
    name: 'Cờ 3×3',
    syntax: '/game tictactoe',
    summary: 'Tạo ván hai người trong server. Người khác bấm Tham gia rồi hai bên đánh ô bằng nút Discord hoặc trên web.',
    example: '/game tictactoe',
    note: 'Người tạo là X và đánh trước. Chơi cùng một ván tại /games/<mã>; không thưởng XP hay xu.'
  },
  {
    name: 'Oẳn tù tì',
    syntax: '/game rps',
    summary: 'Tạo ván hai người. Mỗi người bấm Chọn kín và chọn búa, bao hoặc kéo; chỉ hiện lựa chọn sau khi cả hai đã chọn.',
    example: '/game rps',
    note: 'Ván dùng chung với web, không cược hoặc thưởng xu.'
  },
  {
    name: 'Mở ván web trong Discord',
    syntax: '/game open id:<mã ván>',
    summary: 'Gắn ván bạn đã tạo trên web vào một kênh Discord để chơi tiếp bằng nút.',
    example: '/game open id:abcdefghijklmnopqrstu',
    note: 'Chỉ người chơi trong đúng server được mở. Ván chờ 15 phút, ván đang chơi hết hạn sau 30 phút không có lượt.'
  },
  {
    name: 'Vòng quay',
    syntax: '/random items:<mục 1, mục 2, ...>',
    summary: 'Tạo vòng quay từ ít nhất hai mục. Bot gửi nút quay nhanh trong Discord và liên kết tới vòng quay trên web.',
    example: '/random items:An, Bình, Chi',
    note: 'Phiên vòng quay tự hết hạn sau khoảng 24 giờ.'
  },
  {
    name: 'Nối từ',
    syntax: '/game wordchain word:<từ>',
    summary: 'Chơi nối từ theo kênh. Bot kiểm tra từ bạn nhập và trả lời ngay trong Discord.',
    example: '/game wordchain word:hoa',
    note: 'Lệnh /game noitu word:<từ> là tên gọi thay thế.'
  },
  {
    name: 'Bầu cua',
    syntax: '/game baucua item:<bầu|cua|tôm|cá|gà|nai> bet:<số xu>',
    summary: 'Đặt DNE Coins vào một mặt xúc xắc và xem kết quả ngay sau khi quay.',
    example: '/game baucua item:cua bet:10',
    note: 'Cần đủ DNE Coins trong server. Xu là điểm trong bot, không đổi thành tiền thật.'
  },
  {
    name: 'Thống kê cá nhân',
    syntax: '/stats',
    summary: 'Xem số tin nhắn, thời gian voice đã lưu, phiên voice hiện tại (ước tính), XP và DNE Coins của bạn.',
    example: '/stats',
    note: 'Bot trả lời riêng cho bạn. Số liệu bắt đầu từ khi bot quan sát hoạt động, không lấy lại lịch sử cũ.'
  },
  {
    name: 'Thống kê server',
    syntax: '/serverstats',
    summary: 'Xem số thành viên hiện tại, tin nhắn cộng dồn và voice đã lưu hoặc đang tham gia (ước tính).',
    example: '/serverstats',
    note: 'Có link mở dashboard đúng server. Số liệu hoạt động bắt đầu khi bot quan sát được, không phải riêng 7 ngày.'
  },
  {
    name: 'Nhắc việc riêng',
    syntax: '/remind set in:<10m|2h|1d> text:<nội dung>',
    summary: 'Đặt lời nhắc cá nhân từ 1 phút đến 7 ngày. Bot gửi DM khi đến giờ, không đăng vào kênh.',
    example: '/remind set in:2h text:Họp nhóm',
    note: 'Tối đa 10 lời nhắc đang chờ/người. Hãy mở DM từ thành viên server để nhận tin.'
  },
  {
    name: 'Xem và hủy lời nhắc',
    syntax: '/remind list · /remind cancel id:<mã>',
    summary: 'Xem lời nhắc đang chờ, DM đã gửi thất bại và hủy lời nhắc của chính mình.',
    example: '/remind cancel id:abc123def456',
    note: 'Các phản hồi là riêng tư. Bản ghi đã hoàn thành, hủy hoặc gửi thất bại được xóa sau 7 ngày.'
  },
  {
    name: 'Bảng xếp hạng',
    syntax: '/leaderboard type:<chat|voice>',
    summary: 'Xem tối đa 10 thành viên có nhiều tin nhắn hoặc thời gian voice nhất trong server.',
    example: '/leaderboard type:voice',
    note: 'Thời gian voice đang tham gia được tính ước lượng cho đến khi phiên kết thúc.'
  },
  {
    name: 'Điểm danh hằng ngày',
    syntax: '/daily',
    summary: 'Điểm danh nhận DNE Coins hằng ngày và duy trì chuỗi streak thưởng.',
    example: '/daily',
    note: 'Mỗi ngày điểm danh 1 lần. Chuỗi streak tối đa 7 ngày với phần thưởng xu tăng dần.'
  },
  {
    name: 'Tặng điểm uy tín (+rep)',
    syntax: '/rep user:<thành viên> [reason:<lý do>]',
    summary: 'Tặng điểm tín nhiệm / yêu mến cho thành viên khác trong server (tối đa 3 lần mỗi ngày).',
    example: '/rep user:@Thien reason:Hỗ trợ nhiệt tình',
    note: 'Không thể tự +rep cho bản thân hoặc bot. Lượt tặng làm mới lúc 00:00 UTC+7.'
  },
  {
    name: 'Vòng quay Gacha may mắn',
    syntax: '/gacha spin',
    summary: 'Quay gacha may mắn nhận DNE Coins, XP và danh hiệu/vật phẩm độc đáo.',
    example: '/gacha spin',
    note: 'Nhận 1 lượt quay miễn phí mỗi ngày, các lượt tiếp theo tốn 200 DNE Coins. Có cơ chế bảo hiểm (pity) trúng vật phẩm hiếm.'
  },
  {
    name: 'Trợ giúp',
    syntax: '/help',
    summary: 'Xem danh sách slash command bot đang đăng ký.',
    example: '/help',
    note: 'Danh sách trong Discord được lấy từ chính cấu hình đăng ký lệnh của bot.'
  }
];
