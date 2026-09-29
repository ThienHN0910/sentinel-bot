import type { RouteRecordRaw } from 'vue-router';
import LandingView from '../views/LandingView.vue';
import CommandsView from '../views/CommandsView.vue';
import PrivacyView from '../views/PrivacyView.vue';
import TermsView from '../views/TermsView.vue';
import DashboardView from '../views/DashboardView.vue';
import WheelView from '../views/WheelView.vue';
import RankingsView from '../views/RankingsView.vue';
import ManageView from '../views/ManageView.vue';
import GameView from '../views/GameView.vue';

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: LandingView },
  { path: '/commands', name: 'commands', component: CommandsView },
  { path: '/privacy', name: 'privacy', component: PrivacyView },
  { path: '/terms', name: 'terms', component: TermsView },
  { path: '/dashboard', name: 'dashboard', component: DashboardView },
  { path: '/dashboard/rankings', name: 'rankings', component: RankingsView },
  { path: '/dashboard/manage', name: 'manage', component: ManageView },
  { path: '/wheel', name: 'wheel', component: WheelView },
  { path: '/games/new', name: 'game-new', component: GameView },
  { path: '/games/:sessionId', name: 'game-session', component: GameView }
];
