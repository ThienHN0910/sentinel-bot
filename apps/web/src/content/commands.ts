export interface CommandDoc {
  name: string;
  syntax: string;
  summary: string;
  example: string;
  note: string;
}

export const commands: CommandDoc[] = [
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
  }
];
