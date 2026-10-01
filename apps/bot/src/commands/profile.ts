import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type User
} from 'discord.js';
import type { IPet, PetMood } from '@sentinel/shared';
import { UserStatModel, type UserStatDocument } from '../models/UserStat.js';
import { BadgeService } from '../services/badge/BadgeService.js';
import { createBadgeListEmbed } from './badge.js';
import { PetService } from '../services/pet/PetService.js';
import { LevelService } from '../services/economy/EconomyService.js';

export const profileSlashCommand = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Xem hồ sơ cá nhân tổng hợp: cấp độ, danh hiệu, tài chính, hoạt động và thú cưng')
  .addUserOption((opt) =>
    opt.setName('user').setDescription('Xem hồ sơ của thành viên khác trong server').setRequired(false)
  );

/**
 * Calculates and formats a 10-block visual progress bar for EXP within the current level.
 */
export function formatExpBar(exp: number, level: number): string {
  const currentLevelBase = level === 1 ? 0 : LevelService.expForLevel(level);
  const nextLevelThreshold = LevelService.expForLevel(level + 1);
  const span = Math.max(1, nextLevelThreshold - currentLevelBase);
  const currentInLevel = Math.max(0, Math.min(span, exp - currentLevelBase));
  const percent = Math.floor((currentInLevel / span) * 100);
  const filledBlocks = Math.round((percent / 100) * 10);
  const emptyBlocks = 10 - filledBlocks;
  const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  return `[${bar}] ${currentInLevel}/${span} XP (${percent}%)`;
}

/**
 * Creates the unified profile embed for a user.
 */
export function createProfileEmbed(params: {
  targetUser: User;
  userStat: UserStatDocument | null;
  petData: {
    pet: IPet;
    mood: PetMood;
    moodLabel: string;
    moodEmoji: string;
    currentHunger: number;
    currentHappiness: number;
  } | null;
}): EmbedBuilder {
  const { targetUser, userStat, petData } = params;
  const displayName = targetUser.displayName || targetUser.username;

  // Title / Author with equipped badge
  const equippedBadge = userStat?.equippedBadge ? BadgeService.getBadge(userStat.equippedBadge) : null;
  const authorPrefix = equippedBadge ? `[${equippedBadge.emoji} ${equippedBadge.name}] ` : '';

  const level = userStat?.level ?? 1;
  const exp = userStat?.exp ?? 0;
  const expBar = formatExpBar(exp, level);

  const dneCoins = userStat?.dneCoins ?? 0;
  const repCount = userStat?.repCount ?? 0;

  const totalMessages = userStat?.totalMessages ?? 0;
  const totalVoiceSeconds = userStat?.totalVoiceSeconds ?? 0;
  const dailyStreak = userStat?.dailyStreak ?? 0;
  const voiceHours = (totalVoiceSeconds / 3600).toFixed(1);

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${authorPrefix}${displayName}`,
      iconURL: targetUser.displayAvatarURL()
    })
    .setThumbnail(targetUser.displayAvatarURL())
    .setColor('#5865F2')
    .addFields(
      {
        name: '⭐ Cấp độ & Tiến trình',
        value: `Cấp độ: **${level}** | ${expBar}`
      },
      {
        name: '🪙 Tài chính & Uy tín',
        value: `DNE Coins: **${dneCoins.toLocaleString('vi-VN')}** 🪙 | Uy tín: **+${repCount}** ⭐`
      },
      {
        name: '📊 Hoạt động',
        value: `Tin nhắn: **${totalMessages.toLocaleString('vi-VN')}** 💬 | Voice: **${voiceHours}** giờ 🎙️ | Chuỗi streak: **${dailyStreak}** ngày 🔥`
      }
    );

  if (petData) {
    const pet = petData.pet;
    const petEmoji = PetService.getPetTypeEmoji(pet.petType);
    const petTypeName = PetService.getPetTypeName(pet.petType);
    embed.addFields({
      name: '🐾 Thú cưng đồng hành',
      value: `${petEmoji} **${pet.name}** (${petTypeName}) — ${petData.moodLabel}\nNo: ${petData.currentHunger}/100 🥪 • Vui vẻ: ${petData.currentHappiness}/100 🎾`
    });
  } else {
    embed.addFields({
      name: '🐾 Thú cưng đồng hành',
      value: '*(Chưa nhận nuôi thú cưng — dùng /pet adopt để nhận nuôi!)*'
    });
  }

  embed.setFooter({ text: 'Thành viên của server • Sentinel Bot' });
  embed.setTimestamp();

  return embed;
}

/**
 * Creates profile action row with badge collection button.
 */
export function createProfileButtons(targetUserId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`profile:badges:${targetUserId}`)
      .setLabel('Bộ Sưu Tập Huy Hiệu')
      .setEmoji('🏅')
      .setStyle(ButtonStyle.Secondary)
  );
}

/**
 * Handles /profile slash commands.
 */
export async function handleProfileCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: 'Lệnh này chỉ dùng được trong server!',
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user') || interaction.user;

  // Auto-evaluate badges before rendering so newly qualified badges appear immediately
  await BadgeService.evaluateBadges(guildId, targetUser.id);

  const [userStat, petData] = await Promise.all([
    UserStatModel.findOne({ guildId, userId: targetUser.id }),
    PetService.getPet(guildId, targetUser.id)
  ]);

  const embed = createProfileEmbed({
    targetUser,
    userStat,
    petData
  });

  const buttons = createProfileButtons(targetUser.id);

  await interaction.editReply({
    embeds: [embed],
    components: [buttons]
  });
}

/**
 * Handles profile button interactions (such as the badge drawer button).
 */
export async function handleProfileButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith('profile:badges:')) {
    return;
  }

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: 'Tương tác chỉ dùng được trong server!',
      ephemeral: true
    });
    return;
  }

  const targetUserId = interaction.customId.replace('profile:badges:', '');
  const member = interaction.guild?.members.cache.get(targetUserId);
  let username = member?.displayName || member?.user?.username;

  if (!username) {
    const fetchedUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
    username = fetchedUser?.displayName || fetchedUser?.username || 'Thành viên';
  }

  const summary = await BadgeService.getUserBadges(guildId, targetUserId);
  const embed = createBadgeListEmbed(username, summary);

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}
