<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { ArrowRight, ArrowUpRight, BarChart3, AudioLines, Dices, ShieldCheck, Terminal } from 'lucide-vue-next';
import { commands } from '../content/commands';
import { INSTALL_URL, SITE_URL, usePageSeo } from '../seo';

usePageSeo(
  'Sentinel Bot | Discord bot cho cộng đồng',
  'Sentinel Bot giúp theo dõi hoạt động cộng đồng, chào thành viên bằng giọng nói và chơi mini-game. Xem lệnh, hướng dẫn cài đặt và dashboard trực tiếp.',
  '/'
);
useHead({ script: [{ type: 'application/ld+json', innerHTML: JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Sentinel Bot',
  applicationCategory: 'CommunicationApplication',
  operatingSystem: 'Discord',
  url: SITE_URL,
  description: 'Discord bot cho hoạt động cộng đồng, voice và mini-game.',
  image: `${SITE_URL}/sentinel-icon.png`
}) }] });
</script>

<template>
  <div>
    <section class="site-container landing-hero">
      <div class="hero-copy">
        <p class="eyebrow"><span class="eyebrow-line" /> DISCORD COMMUNITY TOOLKIT</p>
        <h1>Một bot.<br /><span>Một cộng đồng</span><br />sống động hơn.</h1>
        <p class="hero-description">Theo dõi nhịp hoạt động, chào đón qua voice và mở những trò chơi nhỏ ngay trong server. Sentinel đưa mọi thứ về một nơi dễ dùng.</p>
        <div class="hero-actions">
          <a class="button-primary" :href="INSTALL_URL" target="_blank" rel="noopener noreferrer">Thêm Sentinel vào server <ArrowUpRight :size="18" /></a>
          <router-link class="button-text" to="/commands">Khám phá lệnh <ArrowRight :size="17" /></router-link>
        </div>
        <p class="hero-footnote">Miễn phí sử dụng · Cần quyền quản lý server để cài bot</p>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="hero-art-halo" />
        <img src="/sentinel-mark.png" alt="" width="500" height="500" fetchpriority="high" />
        <span class="hero-art-label top">COMMUNITY / ONLINE</span>
        <span class="hero-art-label bottom">SENTINEL SYSTEMS · 01</span>
      </div>
    </section>

    <section class="section-band">
      <div class="site-container band-inner">
        <span>THE SIGNAL</span>
        <p>Hoạt động trong Discord không nên biến mất sau khi cuộc trò chuyện kết thúc.</p>
        <router-link to="/dashboard">Xem dashboard thực <ArrowUpRight :size="18" /></router-link>
      </div>
    </section>

    <section class="site-container landing-section" id="features">
      <div class="section-heading">
        <p class="eyebrow">01 / KHẢ NĂNG</p>
        <h2>Đủ dữ liệu để hiểu cộng đồng.<br />Đủ niềm vui để giữ mọi người ở lại.</h2>
      </div>
      <div class="feature-grid">
        <article class="feature feature-featured">
          <div class="feature-icon"><BarChart3 :size="28" /></div>
          <div>
            <p class="feature-index">01 — INSIGHT</p>
            <h3>Dashboard từ dữ liệu thật</h3>
            <p>Thành viên, người đang trong voice, tin nhắn, bảng xếp hạng và từ khóa được cập nhật từ hoạt động của server. Không có số liệu demo.</p>
            <router-link to="/dashboard">Mở dashboard <ArrowUpRight :size="16" /></router-link>
          </div>
        </article>
        <article class="feature">
          <div class="feature-icon"><AudioLines :size="27" /></div>
          <p class="feature-index">02 — VOICE</p>
          <h3>Chào đón có giọng nói</h3>
          <p>Tùy cấu hình server, bot có thể đọc lời chào khi thành viên vào voice và ghi nhận thời lượng tham gia.</p>
        </article>
        <article class="feature">
          <div class="feature-icon"><Dices :size="27" /></div>
          <p class="feature-index">03 — PLAY</p>
          <h3>Chơi ngay trong cuộc trò chuyện</h3>
          <p>Cờ 3×3 và oẳn tù tì chơi chung một ván trên web và Discord. Vòng quay, nối từ và bầu cua giúp cả server cùng tham gia.</p>
          <router-link to="/games/new">Mở game UI <ArrowUpRight :size="16" /></router-link>
        </article>
      </div>
    </section>

    <section class="landing-section commands-section">
      <div class="site-container commands-layout">
        <div class="section-heading">
          <p class="eyebrow">02 / LỆNH HIỆN CÓ</p>
          <h2>Bắt đầu bằng một dấu /.</h2>
          <p>Những lệnh bên dưới đang được bot đăng ký và xử lý. Xem cú pháp đầy đủ trước khi dùng.</p>
          <router-link class="button-text" to="/commands">Toàn bộ lệnh &amp; hướng dẫn <ArrowRight :size="17" /></router-link>
        </div>
        <div class="command-preview">
          <div v-for="command in commands" :key="command.syntax" class="command-preview-row">
            <Terminal :size="18" />
            <div><code>{{ command.syntax }}</code><span>{{ command.name }}</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="site-container landing-section install-section">
      <div class="section-heading">
        <p class="eyebrow">03 / CÀI ĐẶT</p>
        <h2>Ba bước để Sentinel vào server.</h2>
      </div>
      <div class="steps-grid">
        <div><span>01</span><h3>Mở liên kết cài bot</h3><p>Nhấn “Thêm Sentinel” và đăng nhập Discord nếu được yêu cầu.</p></div>
        <div><span>02</span><h3>Chọn server</h3><p>Bạn cần có quyền quản lý server. Kiểm tra quyền bot yêu cầu trước khi cấp.</p></div>
        <div><span>03</span><h3>Gõ lệnh đầu tiên</h3><p>Thử <code>/random</code> hoặc <code>/game</code> trong kênh bot có quyền xem và gửi tin nhắn.</p></div>
      </div>
    </section>

    <section class="site-container final-cta">
      <ShieldCheck :size="29" />
      <div><p class="eyebrow">SẴN SÀNG KHI BẠN SẴN SÀNG</p><h2>Cho cộng đồng thêm một điểm kết nối.</h2></div>
      <a class="button-primary" :href="INSTALL_URL" target="_blank" rel="noopener noreferrer">Thêm vào Discord <ArrowUpRight :size="18" /></a>
    </section>
  </div>
</template>
