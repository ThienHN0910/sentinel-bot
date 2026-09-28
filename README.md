# Sentinel Bot

**Bot Discord cho cộng đồng: thống kê hoạt động, mini-game và dashboard dữ liệu trực tiếp.**

[Thêm vào server](https://discord.com/oauth2/authorize?client_id=1553723429423808572&scope=bot%20applications.commands&permissions=3230720) · [Dashboard](https://sentinel-dashboard.thienhn.io.vn/dashboard) · [Xếp hạng đầy đủ](https://sentinel-dashboard.thienhn.io.vn/dashboard/rankings) · [Quản trị server](https://sentinel-dashboard.thienhn.io.vn/dashboard/manage) · [Hướng dẫn lệnh](https://sentinel-dashboard.thienhn.io.vn/commands) · [Trạng thái API](https://sentinel-bot.thienhn.io.vn/api/health)

Sentinel ghi nhận hoạt động mà bot quan sát được trong từng server Discord và hiển thị qua website. Repo chứa bot, API và frontend trong một pnpm workspace. Phiên bản hiện tại: **1.0.0**.

## Tính năng

- **Thống kê chat:** số tin nhắn theo thành viên, bảng xếp hạng, từ xuất hiện thường xuyên và biểu đồ theo giờ.
- **Thống kê voice:** thời gian phiên đã kết thúc, thời gian phiên đang tham gia dưới dạng ước tính, lượt vào voice và bảng xếp hạng.
- **Mini-game:** vòng quay chia sẻ giữa Discord và web, nối từ tiếng Việt, bầu cua bằng DNE Coins.
- **Dashboard:** lấy dữ liệu từ Discord và MongoDB qua API, tự làm mới mỗi 30 giây và hỗ trợ chọn server.
- **Xếp hạng đầy đủ:** phân trang theo tin nhắn, thời gian voice đã lưu và XP/cấp độ; dữ liệu được truy vấn trực tiếp theo server.
- **Quản trị server:** đăng nhập Discord để chỉnh lời chào voice và kênh nhận báo cáo; chủ server hoặc người có quyền Manage Server được kiểm tra lại khi đọc và lưu.
- **Báo cáo tuần:** gửi top chat/voice cộng dồn vào kênh đã chọn, thứ Hai lúc 09:00–18:00 giờ Việt Nam; mỗi tuần có bản ghi chống gửi trùng.
- **Vận hành:** health endpoint, telemetry CPU/bộ nhớ, lưu phiên voice và khôi phục trạng thái sau khi bot khởi động lại.

> Số liệu bắt đầu từ lúc bot quan sát được hoạt động; bot không đọc ngược lịch sử tin nhắn hoặc voice của Discord. Website công khai số liệu tổng hợp và bảng xếp hạng của server mà bot đã tham gia. Xem [Chính sách quyền riêng tư](https://sentinel-dashboard.thienhn.io.vn/privacy) để biết dữ liệu được xử lý và thời gian lưu.

## Lệnh Discord

| Lệnh | Chức năng |
| --- | --- |
| `/random items:<các mục>` | Tạo vòng quay; quay trong Discord hoặc mở phiên trên web. |
| `/game wordchain word:<từ>` | Chơi nối từ theo kênh (`/game noitu` là tên thay thế). |
| `/game baucua item:<mặt> bet:<xu>` | Chơi bầu cua với DNE Coins trong server. |
| `/stats` | Xem thống kê chat, voice, XP và xu của chính mình. |
| `/leaderboard type:<chat\|voice>` | Xem top thành viên theo tin nhắn hoặc thời gian voice. |
| `/help` | Xem danh sách lệnh bot đã đăng ký. |

Ví dụ tham số và hướng dẫn cài bot có tại [trang lệnh](https://sentinel-dashboard.thienhn.io.vn/commands). Để điền hồ sơ ứng dụng Discord, xem [hướng dẫn Developer Portal](docs/discord-developer-portal.md).

## Cấu trúc dự án

```text
apps/bot/          Discord Gateway, slash commands, Fastify API, MongoDB models
apps/web/          Vue 3 + Vite dashboard, landing page, vòng quay, trang pháp lý
packages/shared/   Kiểu dữ liệu và hằng số dùng chung
docs/              Hướng dẫn ứng dụng và tài liệu thiết kế
scripts/           Script chuẩn bị VPS
```

Luồng dữ liệu chính: **Discord → bot → MongoDB → Fastify API → dashboard**. Vòng quay dùng thêm WebSocket để đồng bộ kết quả. Bot chạy trên Oracle Cloud bằng PM2; website được phục vụ qua Vercel.

## Chạy local

### Yêu cầu

- Node.js **20 trở lên** và **pnpm 9.7.0** (phiên bản khai báo trong `package.json`).
- Một MongoDB instance hoặc MongoDB Atlas cluster.
- Một ứng dụng Discord có bot token và Application ID. Bật **Message Content Intent** và **Server Members Intent** trong Developer Portal; bot cũng dùng Guild Voice States.

### Cài đặt

```bash
corepack enable
corepack prepare pnpm@9.7.0 --activate
pnpm install --frozen-lockfile
pnpm --filter @sentinel/shared build
```

Sao chép [`.env.example`](.env.example) thành `apps/bot/.env` và điền tối thiểu `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `MONGODB_URI`. Để bật đăng nhập quản trị, điền thêm `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` và `SESSION_SECRET`, đồng thời đăng ký chính xác redirect URL trong Discord Developer Portal theo [hướng dẫn](docs/discord-developer-portal.md). Đặt `FRONTEND_URL=http://localhost:5173` khi chạy local. Với frontend, tạo `apps/web/.env`:

```dotenv
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

Chạy trong hai terminal tại thư mục gốc repo:

```bash
pnpm --filter @sentinel/bot dev
```

```bash
pnpm --filter @sentinel/web dev
```

Mở `http://localhost:5173`; API health ở `http://localhost:3000/api/health`. `apps/bot/.env` được đọc khi chạy script của bot trong workspace. Khi chạy bản build bằng PM2 tại thư mục gốc, đặt các biến tương ứng trong `.env` ở thư mục gốc hoặc qua môi trường tiến trình. Không commit file `.env` hay token.

### Biến môi trường

| Biến | Nơi dùng | Mục đích |
| --- | --- | --- |
| `DISCORD_TOKEN` | Bot, bắt buộc | Đăng nhập Discord Gateway. |
| `DISCORD_CLIENT_ID` | Bot, cần cho slash commands | Đăng ký lệnh toàn cục. |
| `MONGODB_URI` | Bot, bắt buộc | Kết nối MongoDB. |
| `PORT` | Bot, tùy chọn | Cổng Fastify; mặc định `3000`. |
| `FRONTEND_URL` | Bot; bắt buộc cho đăng nhập | URL web chính xác để cấu hình CORS và chuyển về sau OAuth; cũng dùng trong `/random`. |
| `DISCORD_CLIENT_SECRET` | Bot; bắt buộc cho đăng nhập | Bí mật OAuth của ứng dụng Discord; chỉ lưu ở môi trường máy chủ. |
| `DISCORD_REDIRECT_URI` | Bot; bắt buộc cho đăng nhập | URL callback đã đăng ký trong Discord Developer Portal. |
| `SESSION_SECRET` | Bot; bắt buộc cho đăng nhập | Chuỗi ngẫu nhiên tối thiểu 32 byte để băm định danh phiên lưu trong MongoDB. |
| `VITE_API_URL` | Web, tùy chọn | URL API; mặc định trỏ đến API production. |
| `VITE_WS_URL` | Web, tùy chọn | URL WebSocket vòng quay; mặc định suy ra từ URL API. |

## Kiểm tra và build

```bash
pnpm -r test
pnpm -r typecheck
pnpm -r build
pnpm --filter @sentinel/web verify:seo
```

Lệnh SEO chạy sau khi build web; nó kiểm tra các trang HTML đã tạo, canonical URL, robots directive và kích thước icon Discord. Cấu hình chạy bot production nằm ở [`ecosystem.config.js`](ecosystem.config.js). Script chuẩn bị Oracle VPS nằm ở [`scripts/setup-vps.sh`](scripts/setup-vps.sh).

## API công khai

| Endpoint | Nội dung |
| --- | --- |
| `GET /api/health` | Trạng thái tiến trình và telemetry. |
| `GET /api/guilds` | Server mà bot đang kết nối. |
| `GET /api/guilds/:guildId/dashboard` | Số liệu dashboard của server. |
| `GET /api/guilds/:guildId/leaderboard` | Bảng xếp hạng đã lưu. |
| `GET /api/guilds/:guildId/rankings` | Bảng xếp hạng phân trang theo tin nhắn, voice hoặc XP. |
| `GET /api/guilds/:guildId/wordcloud` | Tần suất từ đã ghi nhận. |

Các đường dẫn `/api/auth/*` và `/api/admin/*` phục vụ đăng nhập Discord và cấu hình riêng của server. Ghi cấu hình cần cookie phiên, Origin hợp lệ và CSRF token. Danh sách server quản trị được lấy từ các server trả về lúc đăng nhập; nếu quyền hoặc thành viên mới thay đổi, hãy đăng xuất rồi đăng nhập lại để làm mới danh sách.

API production: `https://sentinel-bot.thienhn.io.vn`. Dữ liệu có thể bằng `0` khi server chưa phát sinh hoạt động được ghi nhận. Thời gian voice đang tham gia là **ước tính** cho tới khi phiên kết thúc và được lưu.

## Đóng góp và hỗ trợ

Mở [GitHub Issue](https://github.com/ThienHN0910/sentinel-bot/issues) để báo lỗi hoặc đề xuất tính năng; kèm bước tái hiện, kết quả mong đợi và phiên bản liên quan. Đừng đăng token, URI MongoDB hoặc dữ liệu cá nhân trong issue công khai. Với pull request, xem [hướng dẫn đóng góp](CONTRIBUTING.md); GitHub Actions sẽ chạy test, typecheck, build và kiểm tra SEO.

[Điều khoản dịch vụ](https://sentinel-dashboard.thienhn.io.vn/terms) · [Chính sách quyền riêng tư](https://sentinel-dashboard.thienhn.io.vn/privacy) · [Giấy phép MIT](LICENSE)
