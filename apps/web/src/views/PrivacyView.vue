<script setup lang="ts">
import { SUPPORT_URL, usePageSeo } from '../seo';

usePageSeo(
  'Chính sách quyền riêng tư | Sentinel Bot',
  'Sentinel Bot thu thập và sử dụng dữ liệu Discord nào, thời hạn lưu trữ, bên cung cấp hạ tầng và cách yêu cầu xóa dữ liệu.',
  '/privacy'
);
</script>

<template>
  <article class="site-container legal-page">
    <header class="page-intro">
      <p class="eyebrow">PHÁP LÝ / 01</p>
      <h1>Chính sách<br /><span>quyền riêng tư.</span></h1>
      <p>Cập nhật: 27/09/2026. Chính sách này áp dụng cho Sentinel Bot và website Sentinel Dashboard do dự án Sentinel Bot vận hành.</p>
    </header>

    <div class="legal-layout">
      <aside class="legal-aside"><span>ĐIỀU CẦN BIẾT</span><p>Bot xử lý dữ liệu để cung cấp tính năng trong server Discord. Website công khai hiển thị số liệu tổng hợp và bảng xếp hạng từ dữ liệu bot đã ghi nhận.</p></aside>
      <div class="legal-content">
        <section><h2>1. Đơn vị vận hành và liên hệ</h2><p>Sentinel Bot là dự án độc lập được duy trì tại <a href="https://github.com/ThienHN0910/sentinel-bot" target="_blank" rel="noopener noreferrer">kho mã nguồn GitHub</a>. Mọi yêu cầu hỗ trợ hoặc quyền riêng tư có thể bắt đầu tại <a :href="SUPPORT_URL" target="_blank" rel="noopener noreferrer">GitHub Issues</a>. Đừng đăng token, nội dung riêng tư hoặc ID cá nhân trong issue công khai; hãy nêu loại yêu cầu để người vận hành hướng dẫn kênh trao đổi phù hợp.</p></section>
        <section><h2>2. Dữ liệu được xử lý</h2><ul><li>ID server và ID người dùng Discord, tên hiển thị, ảnh đại diện để gắn thống kê với đúng server và tài khoản.</li><li>Số tin nhắn, ảnh đính kèm, thời gian tham gia voice, điểm kinh nghiệm và DNE Coins để cung cấp bảng xếp hạng, trò chơi và thống kê.</li><li>Từ được tách từ tin nhắn và số lần xuất hiện để tạo word cloud. Bot không lưu toàn bộ nội dung tin nhắn dưới dạng bản sao trong cơ sở dữ liệu thống kê.</li><li>Dữ liệu phiên vòng quay như danh sách mục, người tạo, kết quả; cấu hình lời chào server; và dữ liệu nhắc nhở nếu tính năng nhắc nhở được sử dụng.</li><li>Website lưu ID server được chọn trong localStorage của trình duyệt để nhớ lựa chọn. Hạ tầng lưu log truy cập kỹ thuật theo chính sách của nhà cung cấp.</li></ul></section>
        <section><h2>3. Mục đích sử dụng</h2><p>Dữ liệu được dùng để vận hành slash command, mini-game, voice greeting, thống kê cộng đồng và dashboard. Bot chỉ xử lý nội dung kênh mà Discord cấp quyền truy cập; quản trị viên có thể giới hạn bot ở các kênh phù hợp. Sentinel không bán dữ liệu người dùng hoặc dùng dữ liệu để nhắm quảng cáo.</p></section>
        <section><h2>4. Nhà cung cấp liên quan</h2><p>Bot chạy trên Oracle Cloud và lưu dữ liệu ứng dụng trong MongoDB Atlas. Website được phục vụ qua Vercel; API có thể đi qua Cloudflare. Giao diện tải font từ Google Fonts. Khi quản trị viên bật lời chào bằng giọng nói, văn bản lời chào có thể được gửi tới dịch vụ Google Text-to-Speech để tạo âm thanh. Discord vẫn xử lý dữ liệu theo chính sách riêng của Discord.</p></section>
        <section><h2>5. Thời gian lưu</h2><p>Phiên vòng quay có cơ chế hết hạn sau khoảng 24 giờ; dữ liệu hoạt động theo giờ sau khoảng 8 ngày; từ khóa sau khoảng 60 ngày kể từ lần xuất hiện gần nhất. Thống kê người dùng, cấu hình server và bản ghi nhắc nhở hiện không có lịch tự xóa cố định, được giữ để tính năng tiếp tục hoạt động cho tới khi được xóa theo yêu cầu hoặc khi dự án thay đổi cách lưu trữ. Việc xóa bằng TTL của MongoDB có thể diễn ra sau mốc hết hạn, không nhất thiết ngay lập tức.</p></section>
        <section><h2>6. Yêu cầu xem hoặc xóa dữ liệu</h2><p>Bạn hoặc quản trị viên server có thể yêu cầu xem, sửa hoặc xóa dữ liệu liên quan qua <a :href="SUPPORT_URL" target="_blank" rel="noopener noreferrer">GitHub Issues</a>. Chỉ mô tả yêu cầu ở issue công khai, không đăng thông tin nhạy cảm; người vận hành sẽ hướng dẫn bước xác minh và trao đổi chi tiết. Gỡ bot khỏi server sẽ dừng thu thập dữ liệu mới nhưng không tự động xóa mọi bản ghi đã lưu. Dữ liệu nằm trên Discord cần được xử lý theo công cụ và chính sách của Discord.</p></section>
        <section><h2>7. Bảo mật và thay đổi</h2><p>Chúng tôi giới hạn quyền truy cập hạ tầng và không đưa bot token hoặc khóa cơ sở dữ liệu vào mã nguồn công khai. Không hệ thống nào có thể bảo đảm an toàn tuyệt đối. Khi cách xử lý dữ liệu thay đổi đáng kể, chính sách này sẽ được cập nhật trên URL hiện tại cùng ngày cập nhật mới.</p></section>
      </div>
    </div>
  </article>
</template>
