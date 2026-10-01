import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction
} from 'discord.js';
import type { PetType } from '@sentinel/shared';
import { PetService } from '../services/pet/PetService';

export const petSlashCommand = new SlashCommandBuilder()
  .setName('pet')
  .setDescription('Nuôi và chăm sóc thú cưng ảo (Zero-Death Companion)')
  .addSubcommand((sub) =>
    sub
      .setName('adopt')
      .setDescription('Nhận nuôi một thú cưng đồng hành mới')
      .addStringOption((opt) =>
        opt
          .setName('type')
          .setDescription('Loại thú cưng')
          .setRequired(true)
          .addChoices(
            { name: '🐱 Mèo', value: 'cat' },
            { name: '🐶 Chó', value: 'dog' },
            { name: '🐲 Rồng', value: 'dragon' },
            { name: '🦊 Cáo', value: 'fox' }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('name')
          .setDescription('Tên đặt cho thú cưng (1-32 ký tự)')
          .setRequired(true)
          .setMaxLength(32)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('status')
      .setDescription('Xem trạng thái, độ no và tâm trạng thú cưng')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Xem thú cưng của thành viên khác').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('feed')
      .setDescription('Cho thú cưng ăn (tốn 10 DNE Coins)')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Cho thú cưng của bạn bè ăn').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('play').setDescription('Chơi đùa cùng thú cưng để tăng độ vui vẻ (hồi 15 phút)')
  );

/**
 * Handles /pet slash commands.
 */
export async function handlePetCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng được trong server!', ephemeral: true });
    return;
  }

  const callerId = interaction.user.id;
  await interaction.deferReply();

  try {
    if (subcommand === 'adopt') {
      const petType = interaction.options.getString('type', true) as PetType;
      const name = interaction.options.getString('name', true);

      const pet = await PetService.adoptPet({
        guildId,
        userId: callerId,
        petType,
        name
      });

      const embed = PetService.createPetEmbed({ pet });
      const buttons = PetService.createPetButtons(callerId);

      await interaction.editReply({
        content: `🎉 Chúc mừng bạn đã nhận nuôi thành công thú cưng **${pet.name}**!`,
        embeds: [embed],
        components: [buttons]
      });
      return;
    }

    if (subcommand === 'status') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const petData = await PetService.getPet(guildId, targetUser.id);

      if (!petData) {
        if (targetUser.id === callerId) {
          await interaction.editReply({
            content: '🐾 Bạn chưa nuôi thú cưng nào! Hãy dùng lệnh `/pet adopt` để nhận nuôi một người bạn đồng hành nhé.'
          });
        } else {
          await interaction.editReply({
            content: `🐾 <@${targetUser.id}> chưa nuôi thú cưng nào trong server này.`
          });
        }
        return;
      }

      const embed = PetService.createPetEmbed(petData);
      const buttons = PetService.createPetButtons(targetUser.id);

      await interaction.editReply({
        embeds: [embed],
        components: [buttons]
      });
      return;
    }

    if (subcommand === 'feed') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const feedResult = await PetService.feedPet({
        guildId,
        userId: targetUser.id,
        feederId: callerId
      });

      const embed = PetService.createPetEmbed({ pet: feedResult.pet });
      const buttons = PetService.createPetButtons(targetUser.id);

      await interaction.editReply({
        content: `🥪 ${callerId === targetUser.id ? 'Bạn' : `<@${callerId}>`} đã cho ${targetUser.id === callerId ? 'thú cưng' : `<@${targetUser.id}>`} ăn no nê! (-10 DNE Coins)`,
        embeds: [embed],
        components: [buttons]
      });
      return;
    }

    if (subcommand === 'play') {
      const playResult = await PetService.playWithPet({
        guildId,
        userId: callerId
      });

      const embed = PetService.createPetEmbed({ pet: playResult.pet });
      const buttons = PetService.createPetButtons(callerId);

      await interaction.editReply({
        content: `🎾 Bạn đã chơi đùa cùng thú cưng! Thú cưng cảm thấy vui vẻ hơn (+${playResult.restoredHappiness} vui vẻ).`,
        embeds: [embed],
        components: [buttons]
      });
      return;
    }

  } catch (error: any) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('❌ Thao tác không thành công')
      .setDescription(error.message || 'Đã xảy ra lỗi không xác định.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * Handles Pet Button interactions (Feed & Play).
 */
export async function handlePetButton(interaction: ButtonInteraction): Promise<void> {
  const { customId, guildId, user } = interaction;
  if (!guildId) return;

  if (customId.startsWith('pet:feed:')) {
    const ownerId = customId.replace('pet:feed:', '');
    await interaction.deferReply({ ephemeral: true });

    try {
      await PetService.feedPet({
        guildId,
        userId: ownerId,
        feederId: user.id
      });

      const petData = await PetService.getPet(guildId, ownerId);
      if (petData && interaction.message && typeof (interaction.message as any).edit === 'function') {
        const embed = PetService.createPetEmbed(petData);
        const buttons = PetService.createPetButtons(ownerId);
        await (interaction.message as any).edit({ embeds: [embed], components: [buttons] });
      }

      await interaction.editReply({
        content: `🥪 Bạn đã cho ${ownerId === user.id ? 'thú cưng' : `<@${ownerId}>`} ăn no nê! (-10 DNE Coins)`
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'Không thể cho thú cưng ăn lúc này.'}`
      });
    }
    return;
  }

  if (customId.startsWith('pet:play:')) {
    const ownerId = customId.replace('pet:play:', '');
    await interaction.deferReply({ ephemeral: true });

    try {
      await PetService.playWithPet({
        guildId,
        userId: ownerId
      });

      const petData = await PetService.getPet(guildId, ownerId);
      if (petData && interaction.message && typeof (interaction.message as any).edit === 'function') {
        const embed = PetService.createPetEmbed(petData);
        const buttons = PetService.createPetButtons(ownerId);
        await (interaction.message as any).edit({ embeds: [embed], components: [buttons] });
      }

      await interaction.editReply({
        content: `🎾 Bạn đã chơi đùa cùng thú cưng! Thú cưng cảm thấy vui vẻ và gắn kết hơn.`
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'Không thể chơi với thú cưng lúc này.'}`
      });
    }
    return;
  }
}
