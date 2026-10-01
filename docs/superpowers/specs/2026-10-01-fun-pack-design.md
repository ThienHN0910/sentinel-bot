# Sentinel Bot: Gói tính năng giải trí cộng đồng (Fun Pack)

Ngày: 2026-10-01

Trạng thái: Bản đặc tả thiết kế chờ chủ dự án duyệt trước khi lập kế hoạch triển khai (Implementation Plan).

---

## 1. Mục tiêu và phạm vi

Mục tiêu của Fun Pack là gia tăng tính gắn kết, tạo bầu không khí vui vẻ và thúc đẩy tương tác hằng ngày cho server Discord quy mô nhỏ hỗn hợp (gồm nhóm bạn thân kết hợp thành viên mới).

Phạm vi gói tính năng bao gồm 8 tính năng được chia thành 3 cụm kiến trúc chặt chẽ:
1. **Cụm 1 — Nền tảng kinh tế & Đánh giá (Low-Hanging Fruit):**
   - Lệnh `/daily`: Điểm danh nhận thưởng chuỗi ngày (Streak).
   - Lệnh `/rep @user`: Tặng điểm tín nhiệm / yêu mến giữa các thành viên.
   - Lệnh `/gacha`: Vòng quay may mắn nhận xu, XP, vật phẩm với cơ chế bảo hiểm (Pity).
2. **Cụm 2 — Tương tác xã hội & Gắn kết (Social & Engagement):**
   - Lệnh `/confess` & DM Listener: Hệ thống tin nhắn ẩn danh hoàn toàn (Zero-Trace Anonymity).
   - Lệnh `/bet`: Hệ thống cá cược xu DNE Coins (hỗ trợ cả Thách đấu 1v1 P2P và Kèo nhóm Pool).
   - Lệnh `/qotd`: Đăng câu hỏi tương tác tự động hằng ngày (Would You Rather, This or That, Trivia trắc nghiệm có thưởng).
3. **Cụm 3 — Định danh & Tiến trình (Progression & Identity):**
   - Lệnh `/pet`: Nuôi thú cưng ảo đơn giản, đáng yêu (Zero-Death Policy, cho ăn, chơi đùa).
   - Lệnh `/badge`: Hệ thống danh hiệu tự động mở khóa theo cột mốc thành tích và trang bị lên hồ sơ.
   - Lệnh `/profile`: Thẻ danh thiếp cá nhân tổng hòa toàn bộ dữ liệu người dùng.

---

## 2. Kiến trúc tổng thể và ranh giới hệ thống

- **Mô hình Service-Oriented (Thin Controllers):**
  - Mọi Slash Command handler (`apps/bot/src/commands/`) và Event Listener (`apps/bot/src/events/`) chỉ thực hiện parse input, kiểm tra rate limit sơ bộ và gọi đến Service tương ứng.
  - Các Service phụ trách toàn bộ luật nghiệp vụ và tương tác dữ liệu: `DailyService` (hoặc mở rộng `EconomyService`), `RepService`, `GachaService`, `ConfessionService`, `BetService`, `QotdService`, `PetService`, `BadgeService`.
- **Ranh giới dữ liệu và Quản lý giao dịch:**
  - Mọi thao tác cộng/trừ DNE Coins hoặc Escrow tiền cược phải sử dụng MongoDB Session/Transaction của Mongoose thông qua `EconomyService`, ngăn chặn triệt để race condition và duplicate spending.
  - Các cấu hình kênh (`confessionChannelId`, `qotdChannelId`) được lưu tập trung trong `GuildConfigModel`.

---

## 3. Đặc tả chi tiết từng cụm tính năng

### Cụm 1: Nền tảng kinh tế & Đánh giá

#### 3.1 Lệnh `/daily` (Điểm danh & Streak)
- **Tận dụng logic backend sẵn có:** Gọi hàm `EconomyService.claimDaily(guildId, userId)`.
- **Luật:** Cooldown 20 giờ. Streak tối đa 7 ngày. Quá 48 giờ kể từ lần điểm danh trước sẽ reset về ngày 1. Thưởng cơ bản: 100 DNE Coins + `10 * dailyStreak` bonus.
- **Giao diện phản hồi:**
  - Embed với thanh tiến trình trực quan: `🔥 Chuỗi ngày: 5/7 [█████░░]`.
  - Hiển thị số xu nhận được, số dư mới và thời gian cooldown nếu chưa đến hạn.
  - Đạt mốc ngày thứ 7: Thưởng bonus đặc biệt (500 DNE Coins) và tự động kích hoạt kiểm tra Badge "Giữ Lửa".

#### 3.2 Lệnh `/rep @user [reason]` (Hệ thống đánh giá)
- **Luật:**
  - Mỗi thành viên có tối đa **3 lượt +rep mỗi ngày**, reset lúc 00:00 UTC+7.
  - Không được phép tự +rep cho chính mình.
  - Cho phép đính kèm lời khen/lý do ngắn (tối đa 100 ký tự).
- **Lưu trữ dữ liệu trong `UserStat`:**
  - `repCount`: number (tổng số điểm rep nhận được từ trước đến nay, mặc định 0).
  - `repGivenToday`: number (số lượt đã tặng trong ngày, mặc định 0).
  - `lastRepResetAt`: Date (mốc thời gian để reset `repGivenToday` sang ngày mới).
- **Phản hồi:** Embed chúc mừng người nhận, hiển thị tổng điểm rep mới. Nếu chạm mốc 20 rep, tự động mở khóa Badge "Idol Giới Trẻ".

#### 3.3 Lệnh `/gacha spin` (Sổ xổ may mắn)
- **Luật:**
  - 1 lượt quay miễn phí mỗi ngày (cooldown 24h).
  - Các lượt tiếp theo: Tiêu tốn **200 DNE Coins/lượt**.
- **Bảng tỷ lệ rơi (Weighted Drop Table) & Bảo hiểm (Pity):**
  - Common (50%): 20 - 50 DNE Coins.
  - Uncommon (25%): 80 - 150 DNE Coins.
  - Rare (15%): 200 - 300 DNE Coins + 50 XP.
  - Epic (8%): 500 DNE Coins + Huy hiệu Epic.
  - Legendary (2%): 1.000 DNE Coins + Huy hiệu Legendary "Bàn Tay Vàng".
  - *Cơ chế Pity:* Tích lũy số lượt quay liên tiếp không ra Epic/Legendary. Đạt 50 lượt chắc chắn nhận Epic trở lên.
- **Lưu trữ dữ liệu trong `UserStat`:**
  - `lastGachaAt`: Date.
  - `gachaPity`: number.

---

### Cụm 2: Tương tác xã hội & Gắn kết

#### 3.4 Lệnh `/confess` & DM Confession (Tin nhắn ẩn danh)
- **Nguyên tắc bảo mật:** **Zero-Trace Anonymity (Ẩn danh tuyệt đối)**.
  - Schema MongoDB tuyệt đối không chứa `userId`, `authorId`, hay bất kỳ dấu vết nào của người gửi.
- **Hai hình thức gửi:**
  1. *Slash Command `/confess`:* Mở Discord Modal có trường nhập nội dung (10 - 1.000 ký tự). Sau khi Submit, gửi phản hồi ephemeral xác nhận.
  2. *DM trực tiếp cho Bot:* Khi người dùng nhắn tin cho bot qua DM, bot gửi tin nhắn có nút chọn Server và nút `[🚀 Gửi Confession]` / `[❌ Hủy]`.
- **Đăng bài lên kênh:**
  - Đăng bài vào kênh cấu hình `confessionChannelId` qua Webhook (hoặc Bot Embed) với tiêu đề `📬 Confession #<Số_Thứ_Tự>`.
  - Tự động gắn các nút biểu cảm (Reaction Buttons: ❤️ Yêu thích, 😂 Haha, 💬 Thảo luận).
- **Quản trị:** Lệnh `/confess delete number:<id>` dành cho người có quyền Manage Server để xóa bài vi phạm nội quy.
- **Model `ConfessionModel`:**
  ```ts
  {
    guildId: string,
    confessionNumber: number, // Số thứ tự tự tăng theo guild
    content: string,
    messageId: string,
    createdAt: Date
  }
  ```

#### 3.5 Lệnh `/bet` (Hệ thống cá cược DNE)
- **1v1 P2P Bet:**
  - `/bet challenge target:@user amount:<xu> title:<nội_dung> your_pick:<lựa_chọn>`
  - Đối thủ nhấn nút `[Chấp nhận]` hoặc `[Từ chối]`.
  - Khi chấp nhận: Trừ tiền cả 2 bên chuyển vào Escrow của trận đấu.
  - Phân xử: `/bet resolve p2p_id:<id> winner:@user` (bởi người thách đấu hoặc Admin).
- **Group Pool Bet (Kèo cộng đồng):**
  - Admin tạo kèo: `/bet pool create title:<tiêu_đề> options:<danh_sách_ngăn_cách_dấu_phẩy> duration:<thời_gian>`
  - Thành viên đặt cược: `/bet join pool_id:<id> option:<tên_lựa_chọn> amount:<xu>`.
  - Hết thời gian: Kèo tự khóa, không cho cược tiếp.
  - Admin phân định: `/bet pool resolve id:<id> winner:<lựa_chọn>` → Tự động tính toán chia thưởng theo tỷ lệ đóng góp (Pari-mutuel).
- **Model `BetModel`:**
  ```ts
  {
    betId: string,           // nanoid
    guildId: string,
    kind: 'p2p' | 'pool',
    creatorId: string,
    opponentId?: string,
    title: string,
    options: string[],
    wagers: Array<{ userId: string, option: string, amount: number, createdAt: Date }>,
    status: 'open' | 'active' | 'locked' | 'resolved' | 'cancelled',
    winnerOption?: string,
    winnerUserId?: string,
    totalPool: number,
    expiresAt: Date,
    resolvedAt?: Date
  }
  ```

#### 3.6 Lệnh `/qotd` (Câu hỏi tương tác hằng ngày)
- **Cơ chế vận hành:**
  - Cron Job định kỳ mỗi ngày lúc 10:00 sáng (Asia/Ho_Chi_Minh) tự động chọn 1 câu hỏi ngẫu nhiên và đăng vào `qotdChannelId`.
  - Xoay vòng giữa 3 dạng:
    1. *Would You Rather (WYR):* 2 lựa chọn tương phản. Nút bấm A / B.
    2. *This or That:* Thăm dò ý kiến cộng đồng.
    3. *Trivia Quiz:* Câu hỏi kiến thức 4 đáp án (A, B, C, D). Người trả lời đúng được cộng ngay 50 DNE Coins + 20 XP.
- **Ngân hàng câu hỏi:** File JSON lưu trữ danh sách câu hỏi tiếng Việt phong phú (`packages/shared/src/constants/questions.json`). Admin có thể thêm câu hỏi riêng bằng `/qotd add`.
- **Model `DailyQuestionModel`:**
  ```ts
  {
    guildId: string,
    date: string,            // YYYY-MM-DD
    type: 'wyr' | 'this_that' | 'trivia',
    question: string,
    options: Array<{ key: string, label: string, votes: string[] }>,
    correctAnswerKey?: string,
    rewardedUserIds: string[],
    messageId: string,
    channelId: string
  }
  ```

---

### Cụm 3: Định danh & Tiến trình

#### 3.7 Lệnh `/pet` (Thú cưng ảo)
- **Triết lý:** Nhẹ nhàng, không áp lực cày cuốc, **Zero-Death** (thú cưng không bao giờ chết đói hay biến mất).
- **Các loài pet ban đầu:** Mèo 🐱, Cún 🐶, Cáo 🦊, Chim cánh cụt 🐧, Gấu trúc 🐼, Rồng con 🐲.
- **Hành động:**
  - `/pet adopt type:<loài> name:<tên>`: Nhận nuôi (miễn phí con đầu tiên, đổi con khác tốn 500 DNE Coins).
  - `/pet feed`: Cho ăn tốn 20 DNE Coins (1 lần/ngày). Tăng độ No và Vui lên 100%.
  - `/pet play`: Vuốt ve, dắt đi dạo (1 lần/ngày). Có cơ hội nhận 5 - 10 DNE Coins hoặc XP ngẫu nhiên.
  - `/pet status`: Xem thông tin trạng thái thú cưng.
- **Tâm trạng (Mood Engine):**
  - Ăn trong 24h: `Hạnh phúc ✨`.
  - Sau 24h - 48h chưa ăn: `Đói bụng 🥪`.
  - Quá 48h chưa ăn: `Buồn bã 😿`. Cho ăn lại sẽ ngay lập tức chuyển về Hạnh phúc.
- **Model `PetModel`:**
  ```ts
  {
    guildId: string,
    userId: string,
    petType: string,
    name: string,
    hunger: number,          // 0 - 100
    happiness: number,       // 0 - 100
    lastFedAt: Date,
    lastPlayedAt: Date,
    adoptedAt: Date
  }
  ```

#### 3.8 Lệnh `/badge` (Hệ thống danh hiệu)
- **Nguyên tắc:** Tự động mở khóa (auto-unlock) khi thỏa mãn các mốc hoạt động.
- **Danh sách huy hiệu ban đầu:**
  - `chatter_100`: "Người Hướng Ngoại" 🥉 (Gửi 100 tin nhắn).
  - `chatter_1000`: "Bàn Phím Vàng" 🥈 (Gửi 1.000 tin nhắn).
  - `chatter_5000`: "Chiến Thần Tám Chuyện" 🥇 (Gửi 5.000 tin nhắn).
  - `voice_10h`: "Treo Tai Nghe" 🎧 (Đạt 10 giờ trong voice).
  - `voice_night`: "Cú Đêm Voice" 🦉 (Voice qua khung 00:00 - 03:00 sáng).
  - `voice_50h`: "Đỉnh Cao Đàm Đạo" 🎙️ (Đạt 50 giờ voice).
  - `streak_7`: "Giữ Lửa" 🔥 (Đạt chuỗi 7 ngày `/daily`).
  - `coins_10k`: "Đại Gia Server" 💰 (Sở hữu từ 10.000 DNE Coins).
  - `rep_20`: "Idol Giới Trẻ" ⭐ (Đạt 20 lượt +rep).
  - `gacha_legendary`: "Bàn Tay Vàng" 🍀 (Trúng Legendary trong Gacha).
- **Lệnh thao tác:**
  - `/badge list`: Xem danh sách tất cả huy hiệu đã đạt được / chưa đạt được.
  - `/badge equip id:<id>`: Chọn 1 huy hiệu để gắn bên cạnh tên người dùng trên `/profile`.
- **Lưu trữ dữ liệu trong `UserStat`:**
  - `unlockedBadges`: string[] (danh sách ID các badge đã mở khóa).
  - `equippedBadge`: string (ID badge đang trang bị, tùy chọn).

#### 3.9 Lệnh `/profile` (Tấm danh thiếp tổng hợp)
- Tổng hợp đầy đủ thông tin:
  - Header: Avatar + Nickname + Huy hiệu trang bị (`[🔥 Giữ Lửa] NguyenVanA`).
  - Cấp độ & Tiến trình: Level + Thanh hiển thị Exp.
  - Tài chính & Đánh giá: DNE Coins + Điểm Rep.
  - Hoạt động: Tổng tin nhắn + Giờ voice + Chuỗi Streak hằng ngày.
  - Thú cưng: Tên pet, loài và icon tâm trạng hiện tại.
  - Tương tác: Button `[Xem Bộ Sưu Tập Huy Hiệu]`.

---

## 4. Quản lý lỗi và Phòng chống rủi ro

1. **Zero-Trace Confession & Chống quấy rối:**
   - Không lưu `userId` đồng nghĩa bot không thể cung cấp danh tính người gửi cho Admin.
   - Để ngăn chặn spam hoặc phá hoại: Giới hạn in-memory rate limit 5 phút/lần/user. Cho phép Admin xóa bài qua ID công khai bằng lệnh `/confess delete`.
2. **Concurrency & Race Condition trong Cá cược:**
   - Trừ tiền ngay lập tức khi tạo hoặc tham gia cược qua Transaction MongoDB.
   - Đảm bảo hoàn trả đầy đủ tiền cược nếu trận đấu bị hủy hoặc hòa.
3. **Quản lý bộ nhớ và tải:**
   - Các Job Cron chạy lệch giờ: Weekly Report (sáng thứ Hai), Daily QOTD (10:00 hàng ngày), Daily Reset Rep (00:00).
   - TTL index trên MongoDB tự động dọn dẹp các kèo cược đã hủy/kết thúc sau 30 ngày để tối ưu dung lượng trên VPS.

---

## 5. Chiến lược kiểm thử & Xác minh

- **Unit Tests:** Kiểm thử độc lập logic tính toán thưởng gacha (xác suất, pity), tính toán tỷ lệ chia cược pool betting, logic mood của pet, logic streak reset khi quá 48h.
- **Integration Tests:**
  - Mô phỏng tương tác `/daily`, `/rep` ghi nhận chính xác vào `UserStat`.
  - Mô phỏng quy trình tạo kèo, join kèo và resolve kèo cược trong môi trường MongoDB Memory Server.
  - Mô phỏng gửi confession qua modal và webhook giả lập, kiểm tra DB không tồn tại bất kỳ trường định danh người dùng nào.
- **Typecheck & Linting:** `pnpm -r run typecheck` và `pnpm -r run test` bảo đảm 100% xanh trước khi merge.
