import { Interaction } from 'discord.js';
import { handleRandomWheelCommand, handleQuickSpinButton } from '../commands/random.js';
import { handleGameCommand } from '../commands/game.js';

/**
 * interactionCreate event handler.
 * Routes slash commands and button interactions to the appropriate handlers.
 */
export async function onInteractionCreate(interaction: Interaction): Promise<void> {
  // ── Slash Commands ────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'random') {
      await handleRandomWheelCommand(interaction);
      return;
    }

    if (commandName === 'game') {
      await handleGameCommand(interaction);
      return;
    }

    return;
  }

  // ── Button Interactions ───────────────────────────────────────────────────
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('spin_quick_')) {
      await handleQuickSpinButton(interaction);
      return;
    }

    return;
  }
}
