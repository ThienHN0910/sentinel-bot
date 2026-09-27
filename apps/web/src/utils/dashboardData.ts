import type { PodiumUser } from '../components/LeaderboardPodium.vue';
import type { CloudWord } from '../components/WordCloudSphere.vue';

export interface DashboardData {
  guild: { id: string; name: string };
  stats: { members: number; voiceNow: number; messages: number };
  podium: PodiumUser[];
  words: { text: string; count: number }[];
  activity: { days: string[]; matrix: number[][] };
  updatedAt: string;
}

export function toPodium(users: PodiumUser[]): PodiumUser[] {
  return users.map(({ rank, username, avatar, score }) => ({ rank, username, avatar, score }));
}

export function toCloudWords(words: DashboardData['words']): CloudWord[] {
  const max = Math.max(1, ...words.map(({ count }) => count));
  const colors = ['#00f2fe', '#7f00ff', '#ff007f', '#00ff88'];
  return words.map(({ text, count }, index) => ({
    text,
    weight: Math.max(1, Math.round((count / max) * 10)),
    color: colors[index % colors.length]
  }));
}
