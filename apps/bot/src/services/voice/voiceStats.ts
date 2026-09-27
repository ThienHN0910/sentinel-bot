export interface VoiceStart {
  startedAt: Date;
}

export function getActiveVoiceSeconds(session: VoiceStart | null | undefined, now = new Date()): number {
  if (!session) return 0;
  return Math.max(0, Math.floor((now.getTime() - session.startedAt.getTime()) / 1000));
}

export function getUserVoiceSeconds(completed: number, session: VoiceStart | null | undefined, now = new Date()) {
  const completedSeconds = Math.max(0, Math.floor(completed));
  const activeEstimatedSeconds = getActiveVoiceSeconds(session, now);
  return {
    completedSeconds,
    activeEstimatedSeconds,
    totalEstimatedSeconds: completedSeconds + activeEstimatedSeconds
  };
}
