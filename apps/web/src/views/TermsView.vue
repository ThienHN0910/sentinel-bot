<script setup lang="ts">
import { SUPPORT_URL, usePageSeo } from '../seo';

usePageSeo(
  'Điều khoản sử dụng | Sentinel Bot',
  'Điều khoản sử dụng Sentinel Bot: cách cài đặt, quyền của quản trị viên, các lệnh, DNE Coins, giới hạn dịch vụ và kênh hỗ trợ.',
  '/terms'
);
</script>

<template>
  <article class="site-container legal-page">
    <header class="page-intro">
      <p class="eyebrow">PHÁP LÝ / 02</p>
      <h1>Điều khoản<br /><span>sử dụng.</span></h1>
      <p>Cập nhật: 27/09/2026. Khi cài hoặc sử dụng Sentinel Bot, bạn đồng ý với các điều khoản dưới đây.</p>
    </header>

    <div class="legal-layout">
      <aside class="legal-aside"><span>TÓM TẮT</span><p>Sentinel là bot cộng đồng độc lập. Hãy cấp quyền phù hợp, dùng lệnh đúng mục đích và báo lỗi qua kênh hỗ trợ của dự án.</p></aside>
      <div class="legal-content">
        <section><h2>1. Dịch vụ</h2><p>Sentinel Bot cung cấp slash command, mini-game, voice greeting, thống kê cộng đồng và website dashboard. Các tính năng có thể thay đổi, tạm ngừng hoặc ngừng hoạt động khi cần bảo trì, khắc phục lỗi hay tuân thủ quy định của Discord. Tài liệu giới thiệu không bảo đảm mọi tính năng dự kiến đã được triển khai.</p></section>
        <section><h2>2. Cài đặt và quyền quản trị</h2><p>Người cài bot cần có quyền quản lý server và chịu trách nhiệm chọn kênh, quyền và cấu hình phù hợp với cộng đồng. Bot cần các quyền Discord được hiển thị trong màn hình cài đặt để phản hồi lệnh, gửi embed và dùng voice khi tính năng này bật. Việc sử dụng bot cũng chịu <a href="https://discord.com/terms" target="_blank" rel="noopener noreferrer">Điều khoản Discord</a> và các chính sách liên quan của Discord.</p></section>
        <section><h2>3. Sử dụng được phép</h2><p>Không dùng bot để quấy rối, phát tán nội dung bất hợp pháp, khai thác lỗi, quá tải API hoặc né các cơ chế an toàn của Discord. Người vận hành có thể giới hạn quyền truy cập khi phát hiện lạm dụng hoặc khi cần bảo vệ dịch vụ và người dùng.</p></section>
        <section><h2>4. Trò chơi và DNE Coins</h2><p>Kết quả vòng quay và bầu cua mang tính giải trí. DNE Coins là điểm ảo trong bot, không phải tiền, không có giá trị quy đổi và không tạo quyền đòi thanh toán hoặc phần thưởng ngoài đời. Quản trị viên server nên đặt quy tắc sử dụng phù hợp cho cộng đồng của mình.</p></section>
        <section><h2>5. Dữ liệu và nội dung</h2><p>Cách Sentinel xử lý dữ liệu được mô tả trong <router-link to="/privacy">Chính sách quyền riêng tư</router-link>. Bạn chỉ nên nhập vào bot nội dung mà mình có quyền chia sẻ. Nội dung và tài khoản trên Discord vẫn thuộc phạm vi điều khoản của Discord và chủ thể liên quan.</p></section>
        <section><h2>6. Tính sẵn có và giới hạn trách nhiệm</h2><p>Dịch vụ được cung cấp theo tình trạng hiện có. Chúng tôi cố gắng duy trì hoạt động nhưng không cam kết không gián đoạn hoặc không có lỗi. Trong phạm vi pháp luật cho phép, dự án không chịu trách nhiệm cho tổn thất phát sinh từ việc dịch vụ ngừng hoạt động, dữ liệu bên thứ ba không chính xác hoặc việc sử dụng sai mục đích.</p></section>
        <section><h2>7. Thay đổi và liên hệ</h2><p>Điều khoản có thể được cập nhật khi dịch vụ thay đổi; ngày cập nhật sẽ hiển thị tại trang này. Nếu cần hỗ trợ hoặc muốn báo lỗi, hãy mở yêu cầu tại <a :href="SUPPORT_URL" target="_blank" rel="noopener noreferrer">GitHub Issues</a>. Không đưa token hoặc dữ liệu cá nhân vào issue công khai.</p></section>
      </div>
    </div>
  </article>
</template>
