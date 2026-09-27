<script setup lang="ts">
import { ArrowUpRight, CircleHelp, ExternalLink } from 'lucide-vue-next';
import { commands } from '../content/commands';
import { INSTALL_URL, SUPPORT_URL, usePageSeo } from '../seo';

usePageSeo(
  'Lệnh và hướng dẫn cài đặt | Sentinel Bot',
  'Hướng dẫn thêm Sentinel Bot vào Discord và cách dùng các lệnh /random, /game wordchain, /game noitu, /game baucua hiện có.',
  '/commands'
);
</script>

<template>
  <div class="site-container content-page">
    <div class="page-intro">
      <p class="eyebrow">HƯỚNG DẪN / 01</p>
      <h1>Cài nhanh.<br /><span>Chơi và theo dõi ngay.</span></h1>
      <p>Danh sách này phản ánh những slash command bot hiện đăng ký. Các tính năng dự kiến trong tài liệu dự án chưa được liệt kê như lệnh đang dùng được.</p>
    </div>

    <section class="guide-section" aria-labelledby="install-title">
      <div class="guide-title"><span>01</span><h2 id="install-title">Thêm bot vào server</h2></div>
      <div class="guide-body">
        <ol class="guide-list">
          <li>Mở <a :href="INSTALL_URL" target="_blank" rel="noopener noreferrer">liên kết cài đặt <ExternalLink :size="14" /></a> bằng tài khoản có quyền quản lý server.</li>
          <li>Chọn server và xem quyền bot yêu cầu: xem/gửi tin nhắn, nhúng liên kết, xem lịch sử tin nhắn, kết nối và nói trong voice.</li>
          <li>Nhấn “Authorize”, hoàn tất CAPTCHA nếu Discord yêu cầu, rồi thử <code>/random</code> hoặc <code>/game</code>.</li>
        </ol>
        <p class="guide-note">Nếu bạn là người vận hành ứng dụng, hãy bật các gateway intent cần thiết cho bot trong Discord Developer Portal: Server Members và Message Content. Người cài bot vào server không cần làm bước này.</p>
        <a class="button-primary" :href="INSTALL_URL" target="_blank" rel="noopener noreferrer">Thêm Sentinel <ArrowUpRight :size="18" /></a>
      </div>
    </section>

    <section class="guide-section" aria-labelledby="commands-title">
      <div class="guide-title"><span>02</span><h2 id="commands-title">Các lệnh đang có</h2></div>
      <div class="guide-body command-docs">
        <article v-for="command in commands" :key="command.syntax" class="command-doc">
          <p class="command-doc-label">{{ command.name }}</p>
          <h3><code>{{ command.syntax }}</code></h3>
          <p>{{ command.summary }}</p>
          <div class="command-example"><span>Ví dụ</span><code>{{ command.example }}</code></div>
          <p class="command-note">{{ command.note }}</p>
        </article>
      </div>
    </section>

    <section class="guide-section" aria-labelledby="help-title">
      <div class="guide-title"><span>03</span><h2 id="help-title">Khi lệnh không hiện</h2></div>
      <div class="guide-body">
        <p>Kiểm tra bot đã vào đúng server, có quyền xem kênh và sử dụng application commands. Lệnh toàn cục đôi khi cần thời gian để Discord hiển thị sau khi đăng ký. Nếu vòng quay web không mở được, kiểm tra liên kết phiên còn hiệu lực trong 24 giờ.</p>
        <a class="help-link" :href="SUPPORT_URL" target="_blank" rel="noopener noreferrer"><CircleHelp :size="19" /> Báo lỗi qua GitHub Issues <ArrowUpRight :size="16" /></a>
      </div>
    </section>
  </div>
</template>
