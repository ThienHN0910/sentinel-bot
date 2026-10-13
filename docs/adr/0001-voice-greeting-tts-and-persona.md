# 1. Multi-Provider TTS Architecture and Dynamic Anime/E-girl Greetings

Date: 2026-10-13
Status: Accepted

## Context
Tính năng phát âm thanh chào mừng (`welcomeVoiceTts`) khi thành viên tham gia phòng thoại (Voice Channel) trước đây sử dụng endpoint không chính thức của Google Translate TTS (`vi` mono female). Lời thoại chỉ sử dụng một mẫu cố định (`DEFAULT_GREETING`), dẫn tới trải nghiệm đơn điệu, thô cứng và thiếu sức hút.

Người dùng yêu cầu:
1. Đổi sang giọng đọc nữ trẻ trung, phong cách Anime / E-girl.
2. Lời thoại chào mừng phong phú, linh hoạt theo nhiều kiểu khác nhau thay vì một câu lặp đi lặp lại.
3. Cơ chế hoạt động ngay lập tức (không bắt buộc có API key trả phí từ đầu) nhưng sẵn sàng cắm API key (ElevenLabs / OpenAI / LLM) khi cần nâng cấp giọng đọc đỉnh cao.

## Decision
1. **Kiến trúc Multi-Provider TTS Adapter**:
   - `TtsProvider`: Interface chuẩn hóa xuất ra `Readable` audio stream.
   - `EdgeTtsProvider` (Default): Sử dụng Microsoft Edge Neural TTS (`vi-VN-HoaiMyNeural` tinh chỉnh pitch và rate cho chất giọng nữ trẻ trung anime/e-girl), chạy miễn phí và không cần API key.
   - `ElevenLabsProvider`: Hỗ trợ cắm `ELEVENLABS_API_KEY` (và voice ID anime/e-girl) qua biến môi trường để kích hoạt chất giọng AI cao cấp nhất.
   - `GoogleTtsProvider`: Giữ lại làm tầng fallback cuối cùng nếu các dịch vụ trên gặp sự cố mạng.
   - `TtsManager`: Tự động điều phối theo cấu hình `TTS_PROVIDER` (`edge` | `elevenlabs` | `google`) và tự động fallback an toàn để đảm bảo bot không bao giờ crash khi phát âm thanh.

2. **Hệ thống Lời thoại Động & Nhân cách Anime / E-girl (Dynamic Greeting Engine)**:
   - Xây dựng `GreetingService` quản lý kho lời thoại phong phú phân loại theo khung giờ (buổi sáng, trưa/chiều, tối, đêm khuya) và phong cách e-girl/anime (dễ thương, tinh nghịch, tsundere).
   - Tự động thay thế placeholder `{user}` bằng Display Name của thành viên.
   - Hỗ trợ chế độ tùy biến: Nếu server cấu hình lời thoại riêng trong `GuildConfig` (`welcomeMessage` khác default), bot ưu tiên tôn trọng cài đặt đó hoặc chế độ `greetingMode` ('pool' | 'custom').

3. **Cấu hình & Tích hợp**:
   - Biến môi trường: `TTS_PROVIDER`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `EDGE_TTS_VOICE`, `EDGE_TTS_PITCH`, `EDGE_TTS_RATE`.
   - Cập nhật database schema `GuildConfig`: thêm trường `ttsVoiceStyle` và `greetingMode` để cho phép quản trị viên tùy biến linh hoạt theo từng guild.

## Consequences
- Bot có chất giọng anime e-girl ngọt ngào, tự nhiên ngay lập tức với 0 chi phí và không cần đăng ký tài khoản.
- Độ trễ cực thấp (< 500ms), không làm trễ cuộc trò chuyện trong voice channel.
- Server có thể linh hoạt chuyển sang ElevenLabs bất kỳ lúc nào chỉ bằng việc thêm key vào file `.env`.
