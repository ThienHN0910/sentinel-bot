import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import type { IPet, PetMood, PetType } from '@sentinel/shared';
import { PetModel } from '../../models/Pet';
import { UserStatModel } from '../../models/UserStat';

export function renderProgressBar(value: number, max = 100, length = 10): string {
  const clamped = Math.max(0, Math.min(max, value));
  const filled = Math.round((clamped / max) * length);
  const empty = length - filled;
  return `${'▰'.repeat(filled)}${'▱'.repeat(empty)} ${clamped}/${max}`;
}

export class PetService {
  /**
   * Returns emoji representation for each pet type.
   */
  static getPetTypeEmoji(petType: PetType): string {
    switch (petType) {
      case 'cat':
        return '🐱';
      case 'dog':
        return '🐶';
      case 'dragon':
        return '🐲';
      case 'fox':
        return '🦊';
      default:
        return '🐾';
    }
  }

  /**
   * Returns Vietnamese name for each pet type.
   */
  static getPetTypeName(petType: PetType): string {
    switch (petType) {
      case 'cat':
        return 'Mèo';
      case 'dog':
        return 'Chó';
      case 'dragon':
        return 'Rồng';
      case 'fox':
        return 'Cáo';
      default:
        return 'Thú cưng';
    }
  }

  /**
   * Calculates real-time mood and decayed stats.
   * Zero-Death Guarantee: Virtual pets never die or flee.
   */
  static calculateMood(
    pet: IPet,
    now = new Date()
  ): {
    mood: PetMood;
    moodLabel: string;
    moodEmoji: string;
    currentHunger: number;
    currentHappiness: number;
  } {
    const nowDate = new Date(now);
    const lastFed = new Date(pet.lastFedAt);
    const lastPlayed = new Date(pet.lastPlayedAt);

    const hoursFed = Math.max(0, (nowDate.getTime() - lastFed.getTime()) / (1000 * 60 * 60));
    const hoursPlayed = Math.max(0, (nowDate.getTime() - lastPlayed.getTime()) / (1000 * 60 * 60));

    let mood: PetMood = 'happy';
    let moodLabel = 'Hạnh phúc ✨';
    let moodEmoji = '✨';

    if (hoursFed > 48) {
      mood = 'sad';
      moodLabel = 'Buồn bã 😿';
      moodEmoji = '😿';
    } else if (hoursFed > 24) {
      mood = 'hungry';
      moodLabel = 'Đói bụng 🥪';
      moodEmoji = '🥪';
    }

    const currentHunger = Math.max(0, Math.min(100, Math.round(pet.hunger - hoursFed * 2)));
    const currentHappiness = Math.max(0, Math.min(100, Math.round(pet.happiness - hoursPlayed * 1.5)));

    return {
      mood,
      moodLabel,
      moodEmoji,
      currentHunger,
      currentHappiness
    };
  }

  /**
   * Adopts a new companion pet for the user.
   */
  static async adoptPet(params: {
    guildId: string;
    userId: string;
    petType: PetType;
    name: string;
  }): Promise<IPet> {
    const name = params.name ? params.name.trim() : '';
    if (name.length < 1 || name.length > 32) {
      throw new Error('Tên thú cưng phải từ 1 đến 32 ký tự!');
    }

    const validTypes: PetType[] = ['cat', 'dog', 'dragon', 'fox'];
    if (!validTypes.includes(params.petType)) {
      throw new Error('Loại thú cưng không hợp lệ!');
    }

    const existing = await PetModel.findOne({ guildId: params.guildId, userId: params.userId });
    if (existing) {
      throw new Error('Bạn đã có thú cưng trong server này rồi!');
    }

    const now = new Date();
    const pet = await PetModel.create({
      guildId: params.guildId,
      userId: params.userId,
      petType: params.petType,
      name,
      hunger: 80,
      happiness: 80,
      lastFedAt: now,
      lastPlayedAt: now,
      adoptedAt: now,
      createdAt: now,
      updatedAt: now
    });

    return pet;
  }

  /**
   * Fetches the pet for a user in a guild with calculated real-time decay and mood.
   */
  static async getPet(
    guildId: string,
    userId: string
  ): Promise<{
    pet: IPet;
    mood: PetMood;
    moodLabel: string;
    moodEmoji: string;
    currentHunger: number;
    currentHappiness: number;
  } | null> {
    const pet = await PetModel.findOne({ guildId, userId });
    if (!pet) {
      return null;
    }

    const moodData = PetService.calculateMood(pet);
    return {
      pet,
      ...moodData
    };
  }

  /**
   * Feeds the pet with 10 DNE Coins atomic deduction.
   */
  static async feedPet(params: {
    guildId: string;
    userId: string;
    feederId?: string;
  }): Promise<{ pet: IPet; cost: number; restoredHunger: number; restoredHappiness: number }> {
    const pet = await PetModel.findOne({ guildId: params.guildId, userId: params.userId });
    if (!pet) {
      throw new Error('Không tìm thấy thú cưng!');
    }

    const feederUserId = params.feederId || params.userId;
    const updatedUser = await UserStatModel.findOneAndUpdate(
      { guildId: params.guildId, userId: feederUserId, dneCoins: { $gte: 10 } },
      { $inc: { dneCoins: -10 }, $set: { updatedAt: new Date() } },
      { new: true }
    );

    if (!updatedUser) {
      throw new Error('Bạn không đủ DNE Coins để mua thức ăn cho pet (cần 10 xu)!');
    }

    const newHunger = 100;
    const restoredHunger = Math.max(0, 100 - pet.hunger);
    const newHappiness = Math.min(100, pet.happiness + 15);
    const restoredHappiness = newHappiness - pet.happiness;

    const updatedPet = await PetModel.findOneAndUpdate(
      { guildId: params.guildId, userId: params.userId },
      {
        $set: {
          hunger: newHunger,
          happiness: newHappiness,
          lastFedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    return {
      pet: updatedPet || pet,
      cost: 10,
      restoredHunger,
      restoredHappiness
    };
  }

  /**
   * Plays with pet, boosting happiness by +25 with a 15-minute cooldown.
   */
  static async playWithPet(params: {
    guildId: string;
    userId: string;
  }): Promise<{ pet: IPet; restoredHappiness: number }> {
    const pet = await PetModel.findOne({ guildId: params.guildId, userId: params.userId });
    if (!pet) {
      throw new Error('Không tìm thấy thú cưng!');
    }

    const now = new Date();
    const lastPlayed = pet.lastPlayedAt ? new Date(pet.lastPlayedAt) : new Date(0);
    const elapsedMs = now.getTime() - lastPlayed.getTime();
    const cooldownMs = 15 * 60 * 1000;

    if (elapsedMs < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - elapsedMs) / (60 * 1000));
      throw new Error(`Thú cưng đang mệt, hãy đợi thêm ${remainingMinutes} phút để chơi tiếp!`);
    }

    const newHappiness = Math.min(100, pet.happiness + 25);
    const restoredHappiness = newHappiness - pet.happiness;

    const updatedPet = await PetModel.findOneAndUpdate(
      { guildId: params.guildId, userId: params.userId },
      {
        $set: {
          happiness: newHappiness,
          lastPlayedAt: now,
          updatedAt: now
        }
      },
      { new: true }
    );

    return {
      pet: updatedPet || pet,
      restoredHappiness
    };
  }

  /**
   * Generates a Discord embed representing the pet's current status.
   */
  static createPetEmbed(data: {
    pet: IPet;
    mood?: PetMood;
    moodLabel?: string;
    moodEmoji?: string;
    currentHunger?: number;
    currentHappiness?: number;
  }): EmbedBuilder {
    const { pet } = data;
    const moodData = PetService.calculateMood(pet);
    const mood = data.mood || moodData.mood;
    const moodLabel = data.moodLabel || moodData.moodLabel;
    const moodEmoji = data.moodEmoji || moodData.moodEmoji;
    const hunger = data.currentHunger !== undefined ? data.currentHunger : moodData.currentHunger;
    const happiness = data.currentHappiness !== undefined ? data.currentHappiness : moodData.currentHappiness;

    const emoji = PetService.getPetTypeEmoji(pet.petType);
    const typeName = PetService.getPetTypeName(pet.petType);

    const embedColor = mood === 'happy' ? 0x57f287 : mood === 'hungry' ? 0xfee75c : 0xed4245;

    const adoptedTimestamp = Math.floor(new Date(pet.adoptedAt).getTime() / 1000);

    return new EmbedBuilder()
      .setTitle(`${emoji} ${pet.name} (${typeName})`)
      .setDescription(`**Tâm trạng:** ${moodEmoji} ${moodLabel}\n**Chủ nhân:** <@${pet.userId}>`)
      .setColor(embedColor)
      .addFields(
        {
          name: '🥪 Độ no bụng',
          value: renderProgressBar(hunger),
          inline: false
        },
        {
          name: '🎾 Độ vui vẻ',
          value: renderProgressBar(happiness),
          inline: false
        },
        {
          name: '📅 Ngày nhận nuôi',
          value: `<t:${adoptedTimestamp}:D> (<t:${adoptedTimestamp}:R>)`,
          inline: true
        }
      )
      .setFooter({ text: 'Sentinel Virtual Pet Engine • Zero-Death Companion' })
      .setTimestamp();
  }

  /**
   * Generates interactive buttons for feeding and playing with the pet.
   */
  static createPetButtons(ownerId: string): ActionRowBuilder<ButtonBuilder> {
    const feedBtn = new ButtonBuilder()
      .setCustomId(`pet:feed:${ownerId}`)
      .setLabel('Cho ăn (10 xu) 🥪')
      .setStyle(ButtonStyle.Primary);

    const playBtn = new ButtonBuilder()
      .setCustomId(`pet:play:${ownerId}`)
      .setLabel('Chơi đùa 🎾')
      .setStyle(ButtonStyle.Success);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(feedBtn, playBtn);
  }
}
