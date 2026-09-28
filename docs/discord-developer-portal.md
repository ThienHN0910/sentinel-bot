# Điền Discord Developer Portal cho Sentinel Bot

Cập nhật: 27/09/2026. Mở ứng dụng có Application ID `1553723429423808572` tại [Discord Developer Portal](https://discord.com/developers/applications), rồi điền các mục sau.

| Mục | Giá trị nên điền |
| --- | --- |
| **App Icon** | Tải file [`apps/web/public/sentinel-icon.png`](../apps/web/public/sentinel-icon.png) lên. File PNG 1024 × 1024, khoảng 2.2 MB, đúng giới hạn trong giao diện bạn gửi. |
| **Name** | `Sentinel Bot` |
| **Description** | `Sentinel giúp cộng đồng Discord theo dõi hoạt động, chào thành viên trong voice và chơi mini-game. Xem dashboard trực tiếp, tạo vòng quay bằng /random, chơi nối từ hoặc bầu cua bằng /game. Cài nhanh, dễ dùng và luôn hiển thị dữ liệu thật của server.` |
| **Tags** | `Utility`, `Community`, `Games`, `Analytics`, `Voice`. Nếu giao diện chỉ cho chọn từ danh sách có sẵn, chọn các nhãn gần nhất với 5 chủ đề này. |
| **Terms of Service URL** | `https://sentinel-dashboard.thienhn.io.vn/terms` |
| **Privacy Policy URL** | `https://sentinel-dashboard.thienhn.io.vn/privacy` |

Mô tả trên dưới 400 ký tự và chỉ nhắc các lệnh bot hiện đăng ký. Hai URL pháp lý là trang HTML công khai, có thể mở khi chưa đăng nhập.

## Các ô khác trong ảnh

- **Application ID:** giữ nguyên `1553723429423808572`; website dùng ID này để tạo liên kết cài bot. Đây không phải bí mật.
- **Public Key:** giữ nguyên giá trị Discord cấp. Bot hiện nhận interaction qua Discord Gateway, vì vậy không cần điền key vào website hay đưa vào form khác.
- **Install Count / Authorization Count:** Discord tự cập nhật. Không nhập thủ công.
- **Interactions Endpoint URL:** để trống. Chỉ điền nếu sau này chuyển sang nhận interaction bằng HTTP POST và triển khai endpoint xác minh chữ ký Discord.
- **Linked Roles Verification URL:** để trống. Ứng dụng hiện không triển khai Linked Roles.

## Installation và Bot

1. Trong tab **Installation**, bật **Guild Install**. Đặt scope `bot` và `applications.commands`, cùng quyền tối thiểu tương ứng: View Channels, Send Messages, Embed Links, Read Message History, Connect và Speak. Không cần quyền Administrator.
2. Nếu muốn người khác tự cài bot, kiểm tra tùy chọn **Public Bot** trong tab **Bot** đang bật. Nếu chỉ thử nghiệm nội bộ, giữ theo lựa chọn của bạn.
3. Bật **Message Content Intent** và **Server Members Intent** trong tab **Bot** vì tiến trình hiện yêu cầu hai gateway intent này. Discord có thể áp dụng yêu cầu phê duyệt riêng khi ứng dụng đạt ngưỡng xác minh.
4. Kiểm tra liên kết cài đặt đang dùng trên website: `https://discord.com/oauth2/authorize?client_id=1553723429423808572&scope=bot%20applications.commands&permissions=3230720`.
5. Sau khi Save Changes, mở các trang [Terms](https://sentinel-dashboard.thienhn.io.vn/terms), [Privacy](https://sentinel-dashboard.thienhn.io.vn/privacy) và [Hướng dẫn lệnh](https://sentinel-dashboard.thienhn.io.vn/commands) bằng cửa sổ ẩn danh để xác nhận truy cập công khai.

## Đăng nhập Discord cho trang quản trị

Trong **OAuth2 → Redirects**, thêm chính xác `https://sentinel-bot.thienhn.io.vn/api/auth/discord/callback`. Luồng đăng nhập dùng scope `identify` và `guilds`; đây là luồng riêng với liên kết cài bot. Không điền callback này vào ô Interactions Endpoint URL.

Trên VPS, cấu hình `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI=https://sentinel-bot.thienhn.io.vn/api/auth/discord/callback`, `FRONTEND_URL=https://sentinel-dashboard.thienhn.io.vn` và `SESSION_SECRET` là chuỗi ngẫu nhiên dài ít nhất 32 byte. Giữ các giá trị bí mật ở môi trường chạy, không đưa vào git hoặc biến `VITE_*`. Sau khi deploy, kiểm tra đăng nhập rồi đăng xuất trên `/dashboard/manage`; cookie phiên thuộc miền API và có thời hạn tối đa 7 ngày.

**Lưu ý về hỗ trợ:** Trang chính sách dùng [GitHub Issues](https://github.com/ThienHN0910/sentinel-bot/issues) theo lựa chọn của chủ dự án. Issue là công khai; người dùng được nhắc không đăng token hoặc dữ liệu cá nhân trong issue.

Tham khảo tài liệu Discord: [App profile pages](https://support-dev.discord.com/hc/en-us/articles/6378525413143-App-Directory-App-profile-pages), [OAuth2 và bot authorization](https://discord.com/developers/docs/topics/oauth2), [Developer Terms](https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service).
