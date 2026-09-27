import { VoiceState } from 'discord.js';
import { VoiceService } from '../services/voice/VoiceService.js';

/**
 * voiceStateUpdate event handler.
 * Delegates to VoiceService for join/leave tracking, TTS greetings, and EXP rewards.
 */
export async function onVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  await VoiceService.handleVoiceStateUpdate(oldState, newState);
}
