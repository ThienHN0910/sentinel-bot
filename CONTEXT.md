# Domain Context: Sentinel Bot

Hệ thống tài liệu domain context dùng chung cho toàn bộ dự án Sentinel Bot (`apps/bot`, `apps/web`, `packages/shared`).

---

## 1. Thuật ngữ cốt lõi (Core Domain Terms)

### A. Kinh tế & Tiến trình (Economy & Progression)
- **DNE Coins**: Đơn vị tiền tệ ảo nội bộ của server. Được tích lũy thông qua chat, voice, điểm danh, gacha, mini-game hoặc quà từ thú cưng.
- **Daily Streak**: Chuỗi ngày điểm danh liên tục. Mỗi lượt điểm danh cách nhau tối thiểu 20 giờ. Chuỗi tối đa là 7 ngày với phần thưởng tăng dần. Nếu không điểm danh sau 48 giờ, chuỗi tự động quay về ngày 1.
- **Reputation (`Rep`)**: Điểm tín nhiệm / yêu mến do các thành viên khác trao tặng qua lệnh `/rep`. Mỗi người có tối đa 3 lượt tặng rep mỗi ngày (reset lúc 00:00 UTC+7) và không thể tự rep chính mình.
- **Gacha**: Vòng quay may mắn nhận thưởng ngẫu nhiên theo tỷ lệ trọng số (Common, Uncommon, Rare, Epic, Legendary). Mỗi người có 1 lượt quay miễn phí mỗi ngày; các lượt tiếp theo tiêu tốn DNE Coins. Có cơ chế bảo hiểm Pity.
- **Exp & Level**: Điểm kinh nghiệm nhận qua chat và voice session. Level được tính lũy tiến theo công thức `floor(100 * Level^1.5)`.

### B. Tương tác xã hội & Gắn kết (Social & Engagement)
- **Confession**: Tin nhắn ẩn danh đăng lên kênh được chỉ định (`confessionChannelId`). Tuân thủ nghiêm ngặt nguyên tắc **Zero-Trace Anonymity**: Hệ thống hoàn toàn không lưu `userId`, IP hash hay audit log người gửi. Hỗ trợ gửi qua Slash command (Modal) và DM trực tiếp với Bot.
- **Bet (Cá cược DNE)**:
  - **P2P Bet (1v1)**: Hai người chơi thách đấu trực tiếp với mức cược tương ứng. Tiền được tạm giữ (Escrow) bằng giao dịch an toàn và chuyển toàn bộ cho người chiến thắng.
  - **Pool Bet (Cược nhóm)**: Kèo do Admin khởi tạo với nhiều lựa chọn. Tiền cược gom vào Pool chung và chia thưởng theo tỷ lệ đóng góp (Pari-mutuel).
- **QOTD (Question of the Day)**: Câu hỏi tương tác hàng ngày được đăng tự động vào khung giờ cố định. Bao gồm 3 thể loại: *Would You Rather (WYR)*, *This or That*, và *Trivia / Quiz* (trắc nghiệm kiến thức có thưởng DNE Coins/XP).

### C. Định danh & Thành tích (Identity & Achievement)
- **Pet (Thú cưng ảo)**: Thú nuôi ảo gắn liền với từng thành viên. Tuân thủ nguyên tắc **Zero-Death**: Thú cưng không bao giờ chết, chỉ thay đổi tâm trạng (Vui vẻ, Đói, Buồn) dựa trên việc cho ăn (`/pet feed`) hàng ngày. Cho phép tương tác chơi đùa (`/pet play`) để nhận quà ngẫu nhiên.
- **Badge (Huy hiệu)**: Danh hiệu tự động mở khóa khi người dùng đạt các cột mốc hoạt động (Milestones) về tin nhắn, voice, streak, rep, gacha. Người dùng có thể chọn trang bị 1 huy hiệu đại diện trên hồ sơ cá nhân.
- **Profile**: Thẻ căn cước tổng hợp của thành viên, kết hợp toàn bộ thông tin về Level, DNE Coins, Rep, Pet, Badge và các chỉ số hoạt động.
