import { Interaction } from 'discord.js';
import { handleRandomWheelCommand, handleQuickSpinButton } from '../commands/random.js';
import { handleGameCommand } from '../commands/game.js';
import { handleStatsCommand } from '../commands/stats.js';
import { handleLeaderboardCommand } from '../commands/leaderboard.js';
import { handleHelpCommand } from '../commands/help.js';
import { handleRemindCommand } from '../commands/remind.js';
import { handleServerStatsCommand } from '../commands/serverstats.js';
import { handleDailyCommand } from '../commands/daily.js';
import { handleRepCommand } from '../commands/rep.js';
import { handleGachaCommand } from '../commands/gacha.js';
import { handleGameButton } from '../commands/gameSessions.js';
import {
  handleConfessCommand,
  handleConfessModalSubmit,
  handleConfessButton
} from '../commands/confess.js';
import { handleBetCommand, handleBetButton } from '../commands/bet.js';
import { handleQotdCommand, handleQotdButton } from '../commands/qotd.js';
import { handlePetCommand, handlePetButton } from '../commands/pet.js';


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

    if (commandName === 'stats') {
      await handleStatsCommand(interaction);
      return;
    }

    if (commandName === 'remind') {
      await handleRemindCommand(interaction);
      return;
    }

    if (commandName === 'serverstats') {
      await handleServerStatsCommand(interaction);
      return;
    }

    if (commandName === 'leaderboard') {
      await handleLeaderboardCommand(interaction);
      return;
    }

    if (commandName === 'daily') {
      await handleDailyCommand(interaction);
      return;
    }

    if (commandName === 'rep') {
      await handleRepCommand(interaction);
      return;
    }

    if (commandName === 'gacha') {
      await handleGachaCommand(interaction);
      return;
    }

    if (commandName === 'confess') {
      await handleConfessCommand(interaction);
      return;
    }

    if (commandName === 'bet') {
      await handleBetCommand(interaction);
      return;
    }

    if (commandName === 'qotd') {
      await handleQotdCommand(interaction);
      return;
    }

    if (commandName === 'pet') {
      await handlePetCommand(interaction);
      return;
    }

    if (commandName === 'help') {

      await handleHelpCommand(interaction);
      return;
    }

    return;
  }

  // ── Modal Submissions ───────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'confess_modal') {
      await handleConfessModalSubmit(interaction);
      return;
    }

    return;
  }

  // ── Button Interactions ───────────────────────────────────────────────────
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('confess:')) {
      await handleConfessButton(interaction);
      return;
    }
    if (interaction.customId.startsWith('bet:')) {
      await handleBetButton(interaction);
      return;
    }
    if (interaction.customId.startsWith('qotd:')) {
      await handleQotdButton(interaction);
      return;
    }
    if (interaction.customId.startsWith('pet:')) {
      await handlePetButton(interaction);
      return;
    }
    if (interaction.customId.startsWith('game:')) {

      await handleGameButton(interaction);
      return;
    }
    if (interaction.customId.startsWith('spin_quick_')) {
      await handleQuickSpinButton(interaction);
      return;
    }

    return;
  }
}
