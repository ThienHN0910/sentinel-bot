import type { RouteRecordRaw } from 'vue-router';
import LandingView from '../views/LandingView.vue';
import CommandsView from '../views/CommandsView.vue';
import PrivacyView from '../views/PrivacyView.vue';
import TermsView from '../views/TermsView.vue';
import DashboardView from '../views/DashboardView.vue';
import WheelView from '../views/WheelView.vue';

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: LandingView },
  { path: '/commands', name: 'commands', component: CommandsView },
  { path: '/privacy', name: 'privacy', component: PrivacyView },
  { path: '/terms', name: 'terms', component: TermsView },
  { path: '/dashboard', name: 'dashboard', component: DashboardView },
  { path: '/wheel', name: 'wheel', component: WheelView }
];
