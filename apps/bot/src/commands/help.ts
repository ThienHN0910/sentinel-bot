import type { ChatInputCommandInteraction } from 'discord.js';
import { slashCommands } from '../events/ready';

export async function handleHelpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const descriptions = slashCommands.map((command) => `/${command.name} — ${command.description}`);
  await interaction.reply({ content: `Các lệnh đang có:\n${descriptions.join('\n')}`, ephemeral: true });
}
