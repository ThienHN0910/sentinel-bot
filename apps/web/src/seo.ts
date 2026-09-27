import { useHead } from '@unhead/vue';

export const SITE_URL = 'https://sentinel-dashboard.thienhn.io.vn';
export const APPLICATION_ID = '1553723429423808572';
export const INSTALL_URL = `https://discord.com/oauth2/authorize?client_id=${APPLICATION_ID}&scope=bot%20applications.commands&permissions=3230720`;
export const SUPPORT_URL = 'https://github.com/ThienHN0910/sentinel-bot/issues';

export function usePageSeo(title: string, description: string, path: string, index = true) {
  const url = `${SITE_URL}${path}`;
  useHead({
    title,
    link: [{ rel: 'canonical', href: url }],
    meta: [
      { name: 'description', content: description },
      { name: 'robots', content: index ? 'index,follow' : 'noindex,follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Sentinel Bot' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: `${SITE_URL}/sentinel-icon.png` },
      { name: 'twitter:card', content: 'summary' }
    ]
  });
}
