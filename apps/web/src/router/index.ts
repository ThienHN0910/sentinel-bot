import { createRouter, createWebHistory } from 'vue-router';
import DashboardPlaceholder from '../views/DashboardPlaceholder.vue';

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: DashboardPlaceholder
  }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
