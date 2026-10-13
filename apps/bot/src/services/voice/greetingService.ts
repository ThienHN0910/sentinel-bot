export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export const GREETING_POOLS: Record<TimeOfDay | 'general', string[]> = {
  morning: [
    'Ohaiyo {user}-senpai! Sáng sớm đã vào voice rồi sao, chăm chỉ thế nya~',
    'Chào buổi sáng {user}! Chúc bạn một ngày mới ngập tràn năng lượng nha!',
    'Dậy sớm thế {user}? Mau bật mic lên nói chuyện với tớ nè!',
    'Good morning {user}! Hôm nay có dự định gì thú vị không đó?'
  ],
  afternoon: [
    'Konnichiwa {user}! Trưa nay đã ăn gì chưa đó, vào đây tám chuyện xíu nào~',
    'Yahho {user}! Buổi chiều vui vẻ nha, chờ mãi mới thấy cậu vào voice đấy!',
    'Hé lô {user}, hôm nay có gì vui không kể tớ nghe với nè~',
    'Chào {user}! Nắng chiều đẹp thế này mà vào voice cày cuốc là chuẩn bài rồi!'
  ],
  evening: [
    'Konbanwa {user}! Tối nay chơi game gì đó, cho tớ ké một slot với nha!',
    'Chào {user} iu dấu! Cả ngày vất vả rồi, vào đây quẩy voice xả stress thôi!',
    'Ara ara~ {user} vừa lướt vào voice kìa! Bật mic lên gáy xem nào bạn ơi~',
    'Hế lô {user}! Tối nay không đi hẹn hò à mà lại vào voice với tụi này thế?'
  ],
  night: [
    'Oyasumi... ủa lộn, cú đêm {user} xuất hiện! Muộn thế này mà vẫn chưa ngủ à?',
    'Baka {user}! Khuya rồi mà còn cày voice, mai không dậy nổi thì đừng có kêu nha~',
    'Wazzup {user}, e-girl trực đêm phục vụ đây! Đêm nay ai gánh ai nào?',
    'Cú đêm {user} điểm danh! Thức khuya vừa thôi kẻo có quầng thâm mắt đấy nhé!'
  ],
  general: [
    'Ủa ai đây ta? Chào mừng {user} cute hạt me đã gia nhập phòng thoại!',
    'Ting ting! Nữ thần voice chào đón {user}, vào nhớ bật mic chia sẻ niềm vui nha~',
    'Yay, {user} tới rồi! Mọi người ơi vỗ tay chào đón idol nào!',
    'Chào {user}! Hôm nay nhìn cậu xịn xò lắm đó, nhớ nói nhiều nhiều nha!',
    'Hé lô {user}! Thấy bạn vào voice là cả phòng rạng rỡ hẳn lên đấy!'
  ]
};

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  // Vietnamese time (UTC+7)
  const utcHours = date.getUTCHours();
  const vnHours = (utcHours + 7) % 24;

  if (vnHours >= 5 && vnHours < 12) return 'morning';
  if (vnHours >= 12 && vnHours < 18) return 'afternoon';
  if (vnHours >= 18 && vnHours < 23) return 'evening';
  return 'night';
}

export interface GreetingOptions {
  displayName?: string;
  mode?: 'pool' | 'custom' | string;
  customMessage?: string;
  date?: Date;
}

export function generateGreeting(options: GreetingOptions): string {
  const name = options.displayName?.trim() || 'thành viên';

  if (options.mode === 'custom' && options.customMessage && options.customMessage.trim()) {
    return options.customMessage.replace(/\{user\}/g, name);
  }

  const timeOfDay = getTimeOfDay(options.date || new Date());
  const timePool = GREETING_POOLS[timeOfDay];
  const generalPool = GREETING_POOLS.general;

  // Combine appropriate time-specific pool with general pool
  const candidates = [...timePool, ...generalPool];
  const randomIndex = Math.floor(Math.random() * candidates.length);
  const selectedTemplate = candidates[randomIndex];

  return selectedTemplate.replace(/\{user\}/g, name);
}
