# Đóng góp cho Sentinel Bot

Cảm ơn bạn đã dành thời gian cải thiện dự án. Trước khi bắt đầu, hãy xem [README](README.md) để cài pnpm, MongoDB và biến môi trường cho bot/web.

## Báo lỗi hoặc đề xuất

Mở [GitHub Issue](https://github.com/ThienHN0910/sentinel-bot/issues) với mô tả ngắn, bước tái hiện, kết quả thực tế và kết quả mong đợi. Nếu lỗi liên quan giao diện, thêm ảnh chụp màn hình. Không đưa bot token, URI MongoDB, nội dung tin nhắn riêng tư hoặc dữ liệu cá nhân vào issue công khai.

## Gửi pull request

1. Tạo branch từ `main` và giữ mỗi pull request tập trung vào một thay đổi.
2. Cập nhật tài liệu khi thay đổi cách cài đặt, API, lệnh hoặc dữ liệu được thu thập.
3. Chạy các lệnh sau tại thư mục gốc trước khi gửi PR:

   ```bash
   pnpm --filter @sentinel/shared build
   pnpm -r typecheck
   pnpm -r test
   pnpm -r build
   pnpm --filter @sentinel/web verify:seo
   ```

4. Trong PR, nêu vấn đề, cách giải quyết, cách đã kiểm tra và ảnh chụp nếu có thay đổi giao diện.

GitHub Actions chạy cùng các bước kiểm tra trên cho mỗi PR. Thông tin hỗ trợ và điều khoản sử dụng nằm ở cuối [README](README.md).
