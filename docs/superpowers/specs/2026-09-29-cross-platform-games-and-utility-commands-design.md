# Sentinel: game dùng chung Discord/web và lệnh tiện ích

Ngày: 2026-09-29

Trạng thái: bản đặc tả chờ chủ dự án duyệt trước khi lập kế hoạch triển khai.

## Mục tiêu và phạm vi

Thêm hai game nhẹ, hai người chơi, có giao diện trong Discord và trên web, cùng thao tác trên **một ván**: cờ 3×3 và oẳn tù tì. Thêm `/remind` để tự nhắc việc qua DM và `/serverstats` để xem thống kê cộng dồn của server. Cập nhật README, `/help`, trang `/commands`, Privacy Policy và hướng dẫn Discord Developer Portal theo đúng chức năng đã phát hành.

Đợt này không thêm thưởng XP/DNE Coins, cược, bảng xếp hạng game, Discord Activity, lời chào thành viên hay lịch thông báo server. Không dùng kết quả game để thay đổi thống kê hoạt động. Mục tiêu vận hành là số truy vấn và bản ghi có giới hạn, không có vòng lặp liên tục riêng cho mỗi ván.

## Kiến trúc và ranh giới

- Một dịch vụ `GameSession` thuộc bot/API giữ luật và trạng thái phiên trong MongoDB. Handler tương tác Discord và route Fastify chỉ chuyển đầu vào đã xác thực tới dịch vụ này; Vue chỉ hiển thị trạng thái và gửi hành động. Cả hai giao diện không tự quyết định kết quả.
- Mỗi phiên lưu `sessionId` ngẫu nhiên khó đoán, `guildId`, loại game, người tạo, người tham gia, trạng thái, phiên bản cập nhật, mốc hết hạn và trạng thái game tối thiểu. Tạo chỉ số cho `sessionId` duy nhất và TTL để xóa phiên cũ. Không lưu hồ sơ lịch sử trận lâu dài.
- Mỗi bước thay đổi dùng cập nhật có điều kiện theo trạng thái/phiên bản. Một bước chỉ được áp dụng một lần; khi hai thao tác tới đồng thời, thao tác thua cuộc nhận trạng thái mới để tải lại, không tạo hai nước đi hoặc hai kết quả.
- Discord sử dụng slash command và message components qua Gateway. Trang web dùng API cùng dịch vụ; web tải lại trạng thái sau thao tác và thăm dò trạng thái khi ván đang mở với nhịp vừa phải, dừng khi trang ẩn hoặc ván kết thúc. Không thêm Discord Embedded App SDK hay Activity URL Mapping.
- Không dùng phiên vòng quay hiện có làm quyền truy cập cho game mới. `sessionId` chỉ là định danh ván, không là credential.

## Định danh và quyền

- Lệnh `/game tictactoe` hoặc `/game rps` chỉ chạy trong server. Trên web, người đã đăng nhập cũng có thể chọn một server mà bot đang tham gia và mình còn là thành viên để tạo ván. Người tạo là người chơi thứ nhất. Một thành viên khác của **cùng server** bấm `Tham gia` trên Discord hoặc web để trở thành người chơi thứ hai; không thể tự tham gia ván mình tạo. Sau đó chỉ hai người được gửi nước đi hoặc lựa chọn.
- Discord xác định người thao tác từ interaction do Discord gửi. API web yêu cầu phiên đăng nhập Discord hiện có, Origin/CSRF cho mọi mutation, và kiểm tra người đó còn là thành viên của server bằng bot/Discord trước khi tham gia hoặc chơi. Quyền Manage Server không cần thiết để chơi. Người chưa đăng nhập được dẫn tới OAuth rồi quay lại đúng ván; không cấp quyền chỉ vì biết link.
- Người ngoài ván có thể xem trạng thái công khai nhưng không xem lựa chọn oẳn tù tì chưa lật. Nếu server không còn gắn bot, phiên hết hạn hoặc tài khoản không còn thuộc server, API từ chối thao tác bằng mã lỗi rõ ràng; UI cho biết cách quay lại hoặc tạo ván mới.
- Giới hạn tạo và thao tác theo người/server/IP ở API hoặc Discord handler; tối đa một ván chưa kết thúc do mỗi người tạo trong một server. Mọi payload, kể cả `sessionId`, `guildId`, vị trí ô và lựa chọn, được kiểm tra kiểu và giới hạn trước khi ghi.

## Vòng đời game

- Phiên chờ người thứ hai hết hạn sau 15 phút. Sau khi tham gia, mỗi nước đi hoặc lựa chọn hợp lệ gia hạn hạn không hoạt động lên 30 phút. Ván thắng, hòa hoặc hết hạn không cho phép thao tác tiếp. Trạng thái kết thúc còn đọc được 24 giờ để hai người xem kết quả rồi TTL xóa; Privacy Policy ghi rõ thời gian này.
- Ván tạo bằng slash command có ngay tin nhắn Discord với nút `Tham gia`, link web và trạng thái chung. Ván tạo trên web có link chia sẻ; người tạo hoặc người tham gia dùng `/game open id:<mã ván>` trong đúng server để đăng tin nhắn ván có nút, rồi tiếp tục trên Discord. Mỗi ván có tối đa một tin nhắn Discord đang liên kết; `open` lần sau trả link tới tin nhắn cũ nếu còn tồn tại thay vì đăng trùng. Sau mỗi hành động, bot cập nhật tin nhắn khi còn quyền; nếu tin nhắn bị xóa hoặc bot mất quyền sửa, phiên vẫn có thể tiếp tục trên web và phản hồi tương tác giải thích tình trạng. Web hiển thị trạng thái hiện tại, hai người chơi và hành động hợp lệ; hỗ trợ màn hình nhỏ và bàn phím.
- Cờ 3×3: người tạo là X và đi trước; người tham gia là O. Bàn có 9 ô, không chọn ô đã đánh, không đi ngoài lượt. Dịch vụ xác định thắng theo hàng, cột, đường chéo hoặc hòa khi kín bàn.
- Oẳn tù tì: mỗi người gửi đúng một trong búa, kéo, bao. Lựa chọn riêng chỉ được trả về cho chính người chọn trước khi cả hai hoàn tất; Discord dùng phản hồi riêng cho lựa chọn, tin nhắn ván chỉ hiện ai đã chọn. Khi cả hai chọn, dịch vụ xác định thắng/hòa và công bố hai lựa chọn cùng kết quả. Không cho sửa sau khi đã chọn.
- Không cộng thưởng và không phát sinh cược, vì vậy thao tác lặp hoặc khởi động lại không thể cấp thưởng trùng.

## `/remind`

- Đăng ký một slash command cấp cao nhất với `set`, `list`, `cancel`. `set` nhận `in` theo dạng số nguyên dương kèm `m`, `h` hoặc `d` (ví dụ `10m`, `2h`, `1d`) và `text`; chỉ chấp nhận thời gian từ 1 phút đến 7 ngày và nội dung 1–200 ký tự. Tối đa 10 lời nhắc đang chờ cho mỗi người, tính trên mọi server. Phản hồi tạo/hủy/danh sách là riêng với người dùng.
- Khi đến giờ, bot gửi **DM cho chính người tạo**. Không đăng nội dung ở kênh nơi gọi lệnh và không ping server. `list` hiển thị tối đa 10 lời nhắc đang chờ, mã công khai 12 ký tự dùng cho `cancel`, Discord timestamp và tối đa 5 lần gửi thất bại gần nhất; `cancel` chỉ hủy bản ghi của chính người tạo khi còn chờ.
- Bộ xử lý lấy việc đến hạn bằng cơ chế claim nguyên tử, có trạng thái `pending`/`sending`/`completed`/`failed`/`cancelled` cùng thời điểm claim và số lần thử. Không đánh dấu hoàn thành trước khi Discord xác nhận gửi DM. Claim hết hạn sau crash có thể được thử lại có giới hạn; cần khóa chống hai worker cùng xử lý. Với giới hạn của DM API, đảm bảo **không cố ý gửi trùng** nhưng không hứa exactly-once khi tiến trình chết sau khi Discord đã nhận DM mà trước khi lưu kết quả.
- Nếu Discord từ chối DM, ghi `failed`; người dùng thấy trạng thái qua `list` và có thể tạo lại sau khi mở DM. Nội dung lời nhắc không xuất hiện trong log. Bản ghi đã hoàn thành/hủy/thất bại được TTL xóa sau 7 ngày; Privacy Policy ghi rõ thời gian này.

## `/serverstats`

- Chỉ chạy trong server, đọc dữ liệu thực từ MongoDB và Discord, trả embed có tên server, số thành viên hiện tại do Discord cung cấp, số tin nhắn **cộng dồn từ khi bot quan sát**, tổng thời gian voice đã kết thúc và phần **ước tính** của các phiên đang diễn ra. Gắn nhãn rõ hai phần voice và thời điểm cập nhật; kèm link dashboard của đúng server.
- Dùng truy vấn tổng hợp có chỉ số và cache ngắn theo server để lệnh ở server đông người không quét toàn bộ lịch sử phiên mỗi lần. Không gọi chỉ số cộng dồn là “7 ngày” hoặc “tuần”. Khi MongoDB lỗi, phản hồi lỗi ngắn gọn thay vì số 0 giả.

## Tài liệu, Discord Developer Portal và phát hành

- Khi mã đã hoạt động, đồng bộ danh sách lệnh trong README, `/help` và trang `/commands`; mô tả luật và cách mở ván từ Discord/web. Cập nhật Privacy Policy về định danh người chơi, trạng thái phiên tạm và lời nhắc DM, thời gian lưu và cách xóa.
- Cập nhật `docs/discord-developer-portal.md` và mô tả ứng dụng nếu cần. Với Gateway + nút, giữ trống `Interactions Endpoint URL` và `Linked Roles Verification URL`; không bật Activities/URL Mapping. Giữ OAuth redirect hiện dùng cho đăng nhập web. Kiểm tra scope `bot` + `applications.commands`, quyền gửi/sửa tin nhắn và intent hiện dùng; chỉ ghi hướng dẫn bật cấu hình thực sự cần. Không ghi Client Secret hoặc token vào tài liệu.
- Tạo GitHub Issue theo `docs/agents/issue-tracker.md` khi lập kế hoạch triển khai, gắn một trong năm nhãn triage mặc định và liên kết spec/PR.
- Sau triển khai: test luật game, chuyển trạng thái đồng thời, quyền web/Discord, che lựa chọn oẳn tù tì, hết hạn/TTL, giới hạn tải, lời nhắc gửi DM, crash/retry và API lỗi. Chạy typecheck, test, build, SEO và smoke test production sau phát hành. Chỉ tuyên bố hoàn tất khi kết quả thực tế khớp tài liệu.

## Rủi ro cần giải trong kế hoạch triển khai

- Xác nhận thành viên server qua Discord tại mỗi mutation web, dùng giới hạn tốc độ để khống chế số lần gọi; không dùng danh sách guild trong phiên OAuth làm bằng chứng thành viên hiện tại.
- Tin nhắn game và trang web có thể cập nhật lệch vài giây; dịch vụ phiên chơi luôn là nguồn dữ liệu đúng. UI phải xử lý phản hồi xung đột bằng cách tải lại.
- DM có thể bị khóa; lệnh tạo phải nói rõ điều đó và `list` cho thấy lần gửi thất bại. Không chuyển lời nhắc sang kênh công khai.
