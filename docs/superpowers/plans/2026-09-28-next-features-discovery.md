# Sentinel: kế hoạch làm rõ tính năng tiếp theo

Ngày lập: 2026-09-28 · Cập nhật: 2026-09-29  
Trạng thái: **đợt lệnh tiện ích và game UI đã phát hành; đợt chào thành viên/thông báo vẫn cần làm rõ và duyệt đặc tả**. Đây là tài liệu khám phá cho đợt tiếp theo, không phải implementation plan đã được duyệt.

## Mốc hiện tại

- Đợt dashboard và quản trị đã phát hành qua PR #3 và #4: xếp hạng phân trang, đăng nhập Discord, cấu hình voice TTS và kênh báo cáo tuần. Báo cáo đã gửi thực tế cho ba server lúc 13:00 giờ Việt Nam ngày 2026-09-28.
- Bot hiện đăng ký **7 slash command cấp cao nhất**: `/random`, `/game`, `/stats`, `/serverstats`, `/remind`, `/leaderboard`, `/help`. `/game` có `wordchain`, `noitu`, `baucua`, `tictactoe`, `rps` và `open`.
- UI đã phát hành: vòng quay 3D `/wheel`, cờ 3×3 và oẳn tù tì dùng chung phiên giữa Discord và web. Nối từ và bầu cua vẫn chỉ chơi qua Discord. Hai game mới không thưởng XP hoặc DNE Coins.
- Đợt này có đặc tả và hai kế hoạch đã duyệt: [thiết kế](../specs/2026-09-29-cross-platform-games-and-utility-commands-design.md), [lệnh tiện ích](2026-09-29-utility-commands.md), [game UI](2026-09-29-shared-ui-games.md). PR #8 và #9 đã merge; xác nhận bằng hai tài khoản Discord thật vẫn được theo dõi tại Issues #6 và #7.

## Đợt tiếp theo: lời chào thành viên và thông báo theo server

Mục tiêu dự kiến: chủ server hoặc người có quyền Manage Server cấu hình thông điệp trong `/dashboard/manage`; bot gửi theo sự kiện hoặc lịch với chi phí ổn định khi nhiều server cùng hoạt động.

Những quyết định cần hỏi và chốt trước khi viết đặc tả:

1. **Sự kiện chào:** “người mới” là lần đầu bot thấy thành viên vào server hay mỗi lần Discord phát `guildMemberAdd`? “Người cũ” là người từng rời rồi vào lại, hay thành viên lâu ngày quay lại chat/voice? Có cần lưu lịch sử rời/vào để phân biệt không?
2. **Nơi gửi và nội dung:** kênh văn bản nào, có cần DM, mẫu `{user}`/`{server}` và biến nào khác, lời chào có embed/ảnh hay chỉ văn bản? Tắt riêng từng loại như thế nào?
3. **Thông báo định kỳ:** loại thông báo đầu tiên là gì, theo lịch và múi giờ nào, ai được xem trước/gửi thử, có giới hạn số lần gửi hoặc giờ yên lặng không?
4. **Quyền và dữ liệu:** giữ kiểm tra owner/Manage Server ở API mỗi lần lưu; xác định thời gian lưu tối thiểu cho dấu mốc thành viên, chính sách xóa và nội dung cần cập nhật trong Privacy Policy.
5. **Tài nguyên và lỗi:** giới hạn số lịch/server, hàng đợi gửi có rate limit, chống gửi trùng sau restart, xử lý kênh bị xóa hoặc bot mất quyền, không giữ toàn bộ thành viên trong bộ nhớ.

Sau khi trả lời, viết và duyệt đặc tả riêng, rồi mới viết implementation plan với kiểm thử sự kiện, quyền truy cập, gửi trùng và tải nhiều server. Command `/settings` hoặc `/config` chỉ nên thêm nếu có thao tác hữu ích hơn đường dẫn quản trị web; hiện chưa đăng ký command này.

## Những ý tưởng còn mở sau đợt này

### Command cần đánh giá

| Ứng viên | Điều kiện trước khi quyết định |
| --- | --- |
| Thống kê riêng 7 ngày | `/serverstats` hiện hiển thị tổng cộng dồn. Muốn số liệu riêng 7 ngày phải lưu bucket theo người/ngày và kiểm thử tổng hợp; không gắn nhãn “tuần” cho tổng cộng dồn. |
| `/settings` hoặc `/config` | Chỉ thêm nếu người quản trị cần xem nhanh trạng thái hoặc mở liên kết web từ Discord; tránh nhân đôi biểu mẫu và kiểm tra quyền. |
| `/game quiz` | Chỉ đăng ký sau khi luật quiz, nguồn câu hỏi, chống spam và cách tính thưởng được duyệt. |

`/settings`, `/config` và `/game quiz` chưa được triển khai. `/help`, trang `/commands` và README cần tiếp tục chỉ liệt kê command thực sự đăng ký.

### Game UI cần đánh giá

Vòng quay, cờ 3×3 và oẳn tù tì đã có UI. Chỉ chọn game tiếp theo sau khi làm rõ: quiz bằng nút Discord, puzzle ngắn trên web, hoặc UI cho nối từ/bầu cua. Những câu hỏi bắt buộc: chơi ở Discord hay web, một người hay nhiều người, cần đăng nhập không, phiên kéo dài bao lâu, dữ liệu nào được lưu, có thưởng DNE Coins/XP không, cách chống chơi lặp và giới hạn số phiên/server.

Tiêu chí thiết kế: không có vòng lặp server liên tục; trạng thái phiên có hạn dùng; số truy vấn và ghi MongoDB được giới hạn; tương tác được rate-limit; giao diện điện thoại dùng được; khi bot hoặc web khởi động lại, phiên không tạo thưởng trùng. Chỉ sau khi đo/ước tính chi phí mới chọn game và viết đặc tả cùng implementation plan riêng.

## Trình tự làm việc lần sau

1. Hoàn tất xác nhận thực tế trong Issues #6 và #7. Tạo hoặc cập nhật GitHub Issue cho đợt thông báo/chào thành viên và game tiếp theo, gắn nhãn triage phù hợp.
2. Dùng `superpowers:brainstorming` để hỏi và chốt các quyết định mở ở trên; trình bày các phương án cùng chi phí vận hành.
3. Viết đặc tả vào `docs/superpowers/specs/`, để người dùng duyệt; sau đó viết implementation plan chi tiết và duyệt cách thực hiện.
4. Triển khai theo từng đợt với kiểm thử, đo tải cơ bản, cập nhật Privacy Policy/README/trang lệnh, rồi mới phát hành và kiểm tra thực tế.
