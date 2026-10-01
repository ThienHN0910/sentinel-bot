import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import type { IPet, PetMood, PetType } from '@sentinel/shared';
import { UserStatModel } from '../src/models/UserStat';
import { PetModel } from '../src/models/Pet';
import { PetService } from '../src/services/pet/PetService';
import { handlePetButton, handlePetCommand } from '../src/commands/pet';

describe('PetService & Virtual Pet Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Pet Adoption & Validations', () => {
    it('successfully adopts a new pet when user has no pet', async () => {
      vi.spyOn(PetModel, 'findOne').mockResolvedValue(null);
      const mockCreatedPet: IPet = {
        guildId: 'guild-1',
        userId: 'user-1',
        petType: 'dragon',
        name: 'Smaug',
        hunger: 80,
        happiness: 80,
        lastFedAt: new Date(),
        lastPlayedAt: new Date(),
        adoptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const createSpy = vi.spyOn(PetModel, 'create').mockResolvedValue(mockCreatedPet as never);

      const pet = await PetService.adoptPet({
        guildId: 'guild-1',
        userId: 'user-1',
        petType: 'dragon',
        name: 'Smaug'
      });

      expect(PetModel.findOne).toHaveBeenCalledWith({ guildId: 'guild-1', userId: 'user-1' });
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'guild-1',
          userId: 'user-1',
          petType: 'dragon',
          name: 'Smaug'
        })
      );
      expect(pet.name).toBe('Smaug');
      expect(pet.petType).toBe('dragon');
    });

    it('rejects adoption if user already has a pet in the guild', async () => {
      vi.spyOn(PetModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        name: 'Miu Miu'
      } as never);

      await expect(
        PetService.adoptPet({
          guildId: 'guild-1',
          userId: 'user-1',
          petType: 'cat',
          name: 'Luna'
        })
      ).rejects.toThrow('Bạn đã có thú cưng trong server này rồi!');
    });

    it('validates pet name length (1-32 characters)', async () => {
      await expect(
        PetService.adoptPet({
          guildId: 'guild-1',
          userId: 'user-1',
          petType: 'cat',
          name: '   '
        })
      ).rejects.toThrow('Tên thú cưng phải từ 1 đến 32 ký tự!');

      await expect(
        PetService.adoptPet({
          guildId: 'guild-1',
          userId: 'user-1',
          petType: 'cat',
          name: 'A'.repeat(33)
        })
      ).rejects.toThrow('Tên thú cưng phải từ 1 đến 32 ký tự!');
    });

    it('validates pet type to allowed companion types', async () => {
      await expect(
        PetService.adoptPet({
          guildId: 'guild-1',
          userId: 'user-1',
          petType: 'tiger' as PetType,
          name: 'TigerKing'
        })
      ).rejects.toThrow('Loại thú cưng không hợp lệ!');
    });
  });

  describe('Mood, Decay, and Zero-Death Guarantee', () => {
    it('calculates happy mood within 24 hours of feeding', () => {
      const now = new Date('2026-10-01T12:00:00Z');
      const pet: IPet = {
        guildId: 'guild-1',
        userId: 'user-1',
        petType: 'cat',
        name: 'Miu',
        hunger: 100,
        happiness: 100,
        lastFedAt: new Date('2026-10-01T06:00:00Z'), // 6h ago
        lastPlayedAt: new Date('2026-10-01T08:00:00Z'), // 4h ago
        adoptedAt: new Date('2026-09-01T00:00:00Z'),
        createdAt: new Date('2026-09-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T06:00:00Z')
      };

      const result = PetService.calculateMood(pet, now);

      expect(result.mood).toBe('happy');
      expect(result.moodLabel).toBe('Hạnh phúc ✨');
      expect(result.moodEmoji).toBe('✨');
      // 6h * 2 = 12 points decayed => 100 - 12 = 88
      expect(result.currentHunger).toBe(88);
      // 4h * 1.5 = 6 points decayed => 100 - 6 = 94
      expect(result.currentHappiness).toBe(94);
    });

    it('calculates hungry mood between 24h and 48h of feeding', () => {
      const now = new Date('2026-10-02T06:00:00Z'); // 30h after lastFedAt
      const pet: IPet = {
        guildId: 'guild-1',
        userId: 'user-1',
        petType: 'dog',
        name: 'Corgi',
        hunger: 100,
        happiness: 80,
        lastFedAt: new Date('2026-10-01T00:00:00Z'), // 30h ago
        lastPlayedAt: new Date('2026-10-01T18:00:00Z'), // 12h ago
        adoptedAt: new Date('2026-09-01T00:00:00Z'),
        createdAt: new Date('2026-09-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T00:00:00Z')
      };

      const result = PetService.calculateMood(pet, now);

      expect(result.mood).toBe('hungry');
      expect(result.moodLabel).toBe('Đói bụng 🥪');
      expect(result.moodEmoji).toBe('🥪');
      // 30h * 2 = 60 decayed => 100 - 60 = 40
      expect(result.currentHunger).toBe(40);
      // 12h * 1.5 = 18 decayed => 80 - 18 = 62
      expect(result.currentHappiness).toBe(62);
    });

    it('calculates sad mood over 48h of feeding', () => {
      const now = new Date('2026-10-03T12:00:00Z'); // 60h after lastFedAt
      const pet: IPet = {
        guildId: 'guild-1',
        userId: 'user-1',
        petType: 'fox',
        name: 'Kitsune',
        hunger: 100,
        happiness: 80,
        lastFedAt: new Date('2026-10-01T00:00:00Z'), // 60h ago
        lastPlayedAt: new Date('2026-10-01T00:00:00Z'), // 60h ago
        adoptedAt: new Date('2026-09-01T00:00:00Z'),
        createdAt: new Date('2026-09-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T00:00:00Z')
      };

      const result = PetService.calculateMood(pet, now);

      expect(result.mood).toBe('sad');
      expect(result.moodLabel).toBe('Buồn bã 😿');
      expect(result.moodEmoji).toBe('😿');
      // 60h * 2 = 120 decayed => clamped to 0
      expect(result.currentHunger).toBe(0);
      // 60h * 1.5 = 90 decayed => 80 - 90 = clamped to 0
      expect(result.currentHappiness).toBe(0);
    });

    it('Zero-Death Guarantee: pet never dies or flees even after 30 days without food', () => {
      const now = new Date('2026-11-01T00:00:00Z'); // 31 days (744 hours) later
      const pet: IPet = {
        guildId: 'guild-1',
        userId: 'user-1',
        petType: 'dragon',
        name: 'Ignis',
        hunger: 100,
        happiness: 100,
        lastFedAt: new Date('2026-10-01T00:00:00Z'),
        lastPlayedAt: new Date('2026-10-01T00:00:00Z'),
        adoptedAt: new Date('2026-09-01T00:00:00Z'),
        createdAt: new Date('2026-09-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T00:00:00Z')
      };

      const result = PetService.calculateMood(pet, now);

      expect(result.mood).toBe('sad');
      expect(result.currentHunger).toBe(0);
      expect(result.currentHappiness).toBe(0);
      // Pet is still safe, ready to be fed
    });
  });

  describe('getPet', () => {
    it('returns null if pet does not exist', async () => {
      vi.spyOn(PetModel, 'findOne').mockResolvedValue(null);

      const result = await PetService.getPet('guild-1', 'user-unknown');
      expect(result).toBeNull();
    });

    it('returns pet with real-time decayed status when pet exists', async () => {
      const mockPet: IPet = {
        guildId: 'guild-1',
        userId: 'user-1',
        petType: 'cat',
        name: 'Mimi',
        hunger: 100,
        happiness: 100,
        lastFedAt: new Date(Date.now() - 3600 * 1000 * 5), // 5 hours ago
        lastPlayedAt: new Date(Date.now() - 3600 * 1000 * 2), // 2 hours ago
        adoptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      vi.spyOn(PetModel, 'findOne').mockResolvedValue(mockPet as never);

      const result = await PetService.getPet('guild-1', 'user-1');

      expect(result).not.toBeNull();
      expect(result?.pet.name).toBe('Mimi');
      expect(result?.mood).toBe('happy');
      expect(result?.currentHunger).toBe(90); // 100 - 5*2
      expect(result?.currentHappiness).toBe(97); // 100 - 2*1.5
    });
  });

  describe('feedPet (Financial Integrity & Atomic Coins)', () => {
    it('deducts 10 DNE Coins atomically and restores hunger to 100 and happiness by +15', async () => {
      const mockPet: IPet = {
        guildId: 'guild-1',
        userId: 'user-1',
        petType: 'fox',
        name: 'Foxie',
        hunger: 30,
        happiness: 50,
        lastFedAt: new Date(Date.now() - 3600 * 1000 * 35),
        lastPlayedAt: new Date(),
        adoptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      vi.spyOn(PetModel, 'findOne').mockResolvedValue(mockPet as never);

      const coinDeductSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        dneCoins: 90
      } as never);

      const updatePetSpy = vi.spyOn(PetModel, 'findOneAndUpdate').mockImplementation(async (query: any, update: any) => {
        return {
          ...mockPet,
          hunger: update.$set.hunger,
          happiness: update.$set.happiness,
          lastFedAt: update.$set.lastFedAt
        } as never;
      });

      const result = await PetService.feedPet({
        guildId: 'guild-1',
        userId: 'user-1'
      });

      // Verify atomic financial query
      expect(coinDeductSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'user-1', dneCoins: { $gte: 10 } },
        expect.objectContaining({ $inc: { dneCoins: -10 } }),
        { new: true }
      );

      // Verify PetModel update
      expect(updatePetSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'user-1' },
        expect.objectContaining({
          $set: expect.objectContaining({
            hunger: 100,
            happiness: 65, // 50 + 15
            lastFedAt: expect.any(Date)
          })
        }),
        { new: true }
      );

      expect(result.cost).toBe(10);
      expect(result.pet.hunger).toBe(100);
      expect(result.pet.happiness).toBe(65);
    });

    it('throws error if user has insufficient DNE coins', async () => {
      const mockPet: IPet = {
        guildId: 'guild-1',
        userId: 'user-1',
        petType: 'cat',
        name: 'Miu',
        hunger: 10,
        happiness: 20,
        lastFedAt: new Date(),
        lastPlayedAt: new Date(),
        adoptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      vi.spyOn(PetModel, 'findOne').mockResolvedValue(mockPet as never);

      // Insufficient coins returns null
      vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue(null);

      await expect(
        PetService.feedPet({
          guildId: 'guild-1',
          userId: 'user-1'
        })
      ).rejects.toThrow('Bạn không đủ DNE Coins để mua thức ăn cho pet (cần 10 xu)!');
    });

    it('throws error if pet does not exist', async () => {
      vi.spyOn(PetModel, 'findOne').mockResolvedValue(null);

      await expect(
        PetService.feedPet({
          guildId: 'guild-1',
          userId: 'user-nonexistent'
        })
      ).rejects.toThrow('Không tìm thấy thú cưng!');
    });

    it('allows a friend to feed another user pet with feederId', async () => {
      const mockPet: IPet = {
        guildId: 'guild-1',
        userId: 'pet-owner',
        petType: 'dog',
        name: 'Buddy',
        hunger: 20,
        happiness: 40,
        lastFedAt: new Date(),
        lastPlayedAt: new Date(),
        adoptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      vi.spyOn(PetModel, 'findOne').mockResolvedValue(mockPet as never);

      const coinDeductSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'friend-feeder',
        dneCoins: 150
      } as never);

      vi.spyOn(PetModel, 'findOneAndUpdate').mockResolvedValue({
        ...mockPet,
        hunger: 100,
        happiness: 55
      } as never);

      await PetService.feedPet({
        guildId: 'guild-1',
        userId: 'pet-owner',
        feederId: 'friend-feeder'
      });

      expect(coinDeductSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'friend-feeder', dneCoins: { $gte: 10 } },
        expect.anything(),
        { new: true }
      );
    });
  });

  describe('playWithPet (15m Cooldown & Happiness Boost)', () => {
    it('increases happiness by +25 and updates lastPlayedAt when cooldown elapsed', async () => {
      const pastTime = new Date(Date.now() - 20 * 60 * 1000); // 20m ago (> 15m)
      const mockPet: IPet = {
        guildId: 'guild-1',
        userId: 'user-1',
        petType: 'dragon',
        name: 'Drakon',
        hunger: 80,
        happiness: 60,
        lastFedAt: new Date(),
        lastPlayedAt: pastTime,
        adoptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      vi.spyOn(PetModel, 'findOne').mockResolvedValue(mockPet as never);

      const updateSpy = vi.spyOn(PetModel, 'findOneAndUpdate').mockImplementation(async (query: any, update: any) => {
        return {
          ...mockPet,
          happiness: update.$set.happiness,
          lastPlayedAt: update.$set.lastPlayedAt
        } as never;
      });

      const result = await PetService.playWithPet({
        guildId: 'guild-1',
        userId: 'user-1'
      });

      expect(updateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'user-1' },
        expect.objectContaining({
          $set: expect.objectContaining({
            happiness: 85, // 60 + 25
            lastPlayedAt: expect.any(Date)
          })
        }),
        { new: true }
      );
      expect(result.restoredHappiness).toBe(25);
    });

    it('enforces 15m cooldown between play sessions', async () => {
      const recentTime = new Date(Date.now() - 5 * 60 * 1000); // 5m ago (10m remaining)
      const mockPet: IPet = {
        guildId: 'guild-1',
        userId: 'user-1',
        petType: 'cat',
        name: 'Neko',
        hunger: 80,
        happiness: 60,
        lastFedAt: new Date(),
        lastPlayedAt: recentTime,
        adoptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      vi.spyOn(PetModel, 'findOne').mockResolvedValue(mockPet as never);

      await expect(
        PetService.playWithPet({
          guildId: 'guild-1',
          userId: 'user-1'
        })
      ).rejects.toThrow(/Thú cưng đang mệt, hãy đợi thêm \d+ phút/);
    });

    it('throws error if pet does not exist when playing', async () => {
      vi.spyOn(PetModel, 'findOne').mockResolvedValue(null);

      await expect(
        PetService.playWithPet({
          guildId: 'guild-1',
          userId: 'user-nonexistent'
        })
      ).rejects.toThrow('Không tìm thấy thú cưng!');
    });
  });

  describe('UI Embeds & Buttons Helpers', () => {
    it('returns proper emojis and labels for pet types', () => {
      expect(PetService.getPetTypeEmoji('cat')).toBe('🐱');
      expect(PetService.getPetTypeEmoji('dog')).toBe('🐶');
      expect(PetService.getPetTypeEmoji('dragon')).toBe('🐲');
      expect(PetService.getPetTypeEmoji('fox')).toBe('🦊');

      expect(PetService.getPetTypeName('cat')).toBe('Mèo');
      expect(PetService.getPetTypeName('dog')).toBe('Chó');
      expect(PetService.getPetTypeName('dragon')).toBe('Rồng');
      expect(PetService.getPetTypeName('fox')).toBe('Cáo');
    });

    it('creates rich pet embed with hunger/happiness bars and mood', () => {
      const mockPet: IPet = {
        guildId: 'guild-1',
        userId: 'user-1',
        petType: 'dragon',
        name: 'Bahamut',
        hunger: 80,
        happiness: 70,
        lastFedAt: new Date(),
        lastPlayedAt: new Date(),
        adoptedAt: new Date('2026-09-15T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const embed = PetService.createPetEmbed({
        pet: mockPet,
        mood: 'happy',
        moodLabel: 'Hạnh phúc ✨',
        moodEmoji: '✨',
        currentHunger: 80,
        currentHappiness: 70
      });

      expect(embed.data.title).toContain('Bahamut');
      expect(embed.data.title).toContain('🐲');
      expect(embed.data.description).toContain('Hạnh phúc ✨');
      expect(embed.data.fields).toBeDefined();
    });

    it('creates pet buttons with custom IDs and ownerId', () => {
      const row = PetService.createPetButtons('owner-123');
      const json = row.toJSON();

      expect(json.components).toHaveLength(2);
      expect((json.components[0] as any).custom_id).toBe('pet:feed:owner-123');
      expect((json.components[0] as any).label).toContain('Cho ăn (10 xu)');
      expect((json.components[1] as any).custom_id).toBe('pet:play:owner-123');
      expect((json.components[1] as any).label).toContain('Chơi đùa');
    });
  });

  describe('Slash Command & Button Handler Workflows', () => {
    const mockChatInteraction = (subcommand: string, options: Record<string, any> = {}) => {
      return {
        guildId: 'guild-1',
        user: { id: 'caller-1', username: 'TestUser' },
        options: {
          getSubcommand: () => subcommand,
          getString: (name: string) => options[name] ?? null,
          getUser: (name: string) => options[name] ?? null
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined)
      } as unknown as ChatInputCommandInteraction;
    };

    it('handles /pet adopt subcommand', async () => {
      const interaction = mockChatInteraction('adopt', { type: 'fox', name: 'Kurama' });
      vi.spyOn(PetService, 'adoptPet').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'caller-1',
        petType: 'fox',
        name: 'Kurama',
        hunger: 80,
        happiness: 80,
        lastFedAt: new Date(),
        lastPlayedAt: new Date(),
        adoptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await handlePetCommand(interaction);

      expect(PetService.adoptPet).toHaveBeenCalledWith({
        guildId: 'guild-1',
        userId: 'caller-1',
        petType: 'fox',
        name: 'Kurama'
      });
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          components: expect.any(Array)
        })
      );
    });

    it('handles /pet status subcommand when pet exists', async () => {
      const interaction = mockChatInteraction('status');
      vi.spyOn(PetService, 'getPet').mockResolvedValue({
        pet: {
          guildId: 'guild-1',
          userId: 'caller-1',
          petType: 'cat',
          name: 'Luna',
          hunger: 80,
          happiness: 80,
          lastFedAt: new Date(),
          lastPlayedAt: new Date(),
          adoptedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        mood: 'happy',
        moodLabel: 'Hạnh phúc ✨',
        moodEmoji: '✨',
        currentHunger: 80,
        currentHappiness: 80
      });

      await handlePetCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          components: expect.any(Array)
        })
      );
    });

    it('handles /pet status subcommand when no pet exists', async () => {
      const interaction = mockChatInteraction('status');
      vi.spyOn(PetService, 'getPet').mockResolvedValue(null);

      await handlePetCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('/pet adopt')
        })
      );
    });

    it('handles /pet feed subcommand', async () => {
      const interaction = mockChatInteraction('feed');
      vi.spyOn(PetService, 'feedPet').mockResolvedValue({
        pet: {
          guildId: 'guild-1',
          userId: 'caller-1',
          petType: 'cat',
          name: 'Luna',
          hunger: 100,
          happiness: 95,
          lastFedAt: new Date(),
          lastPlayedAt: new Date(),
          adoptedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        cost: 10,
        restoredHunger: 20,
        restoredHappiness: 15
      });

      await handlePetCommand(interaction);

      expect(PetService.feedPet).toHaveBeenCalledWith({
        guildId: 'guild-1',
        userId: 'caller-1',
        feederId: 'caller-1'
      });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });

    it('handles /pet play subcommand', async () => {
      const interaction = mockChatInteraction('play');
      vi.spyOn(PetService, 'playWithPet').mockResolvedValue({
        pet: {
          guildId: 'guild-1',
          userId: 'caller-1',
          petType: 'cat',
          name: 'Luna',
          hunger: 80,
          happiness: 100,
          lastFedAt: new Date(),
          lastPlayedAt: new Date(),
          adoptedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        restoredHappiness: 25
      });

      await handlePetCommand(interaction);

      expect(PetService.playWithPet).toHaveBeenCalledWith({
        guildId: 'guild-1',
        userId: 'caller-1'
      });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });

    it('handles button interaction: pet:feed:<ownerId>', async () => {
      const messageEditMock = vi.fn().mockResolvedValue(undefined);
      const btnInteraction = {
        guildId: 'guild-1',
        customId: 'pet:feed:owner-1',
        user: { id: 'feeder-1', username: 'FeederUser' },
        message: { edit: messageEditMock },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined)
      } as unknown as ButtonInteraction;

      vi.spyOn(PetService, 'feedPet').mockResolvedValue({
        pet: {
          guildId: 'guild-1',
          userId: 'owner-1',
          petType: 'dog',
          name: 'Shiba',
          hunger: 100,
          happiness: 95,
          lastFedAt: new Date(),
          lastPlayedAt: new Date(),
          adoptedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        cost: 10,
        restoredHunger: 20,
        restoredHappiness: 15
      });

      vi.spyOn(PetService, 'getPet').mockResolvedValue({
        pet: {
          guildId: 'guild-1',
          userId: 'owner-1',
          petType: 'dog',
          name: 'Shiba',
          hunger: 100,
          happiness: 95,
          lastFedAt: new Date(),
          lastPlayedAt: new Date(),
          adoptedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        mood: 'happy',
        moodLabel: 'Hạnh phúc ✨',
        moodEmoji: '✨',
        currentHunger: 100,
        currentHappiness: 95
      });

      await handlePetButton(btnInteraction);

      expect(btnInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(PetService.feedPet).toHaveBeenCalledWith({
        guildId: 'guild-1',
        userId: 'owner-1',
        feederId: 'feeder-1'
      });
      expect(messageEditMock).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          components: expect.any(Array)
        })
      );
      expect(btnInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('ăn no nê')
        })
      );
    });

    it('handles button interaction: pet:play:<ownerId>', async () => {
      const messageEditMock = vi.fn().mockResolvedValue(undefined);
      const btnInteraction = {
        guildId: 'guild-1',
        customId: 'pet:play:owner-1',
        user: { id: 'owner-1', username: 'OwnerUser' },
        message: { edit: messageEditMock },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined)
      } as unknown as ButtonInteraction;

      vi.spyOn(PetService, 'playWithPet').mockResolvedValue({
        pet: {
          guildId: 'guild-1',
          userId: 'owner-1',
          petType: 'dog',
          name: 'Shiba',
          hunger: 80,
          happiness: 100,
          lastFedAt: new Date(),
          lastPlayedAt: new Date(),
          adoptedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        restoredHappiness: 25
      });

      vi.spyOn(PetService, 'getPet').mockResolvedValue({
        pet: {
          guildId: 'guild-1',
          userId: 'owner-1',
          petType: 'dog',
          name: 'Shiba',
          hunger: 80,
          happiness: 100,
          lastFedAt: new Date(),
          lastPlayedAt: new Date(),
          adoptedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        mood: 'happy',
        moodLabel: 'Hạnh phúc ✨',
        moodEmoji: '✨',
        currentHunger: 80,
        currentHappiness: 100
      });

      await handlePetButton(btnInteraction);

      expect(btnInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(PetService.playWithPet).toHaveBeenCalledWith({
        guildId: 'guild-1',
        userId: 'owner-1'
      });
      expect(messageEditMock).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          components: expect.any(Array)
        })
      );
      expect(btnInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('chơi đùa')
        })
      );
    });

    it('handles button error gracefully with ephemeral message', async () => {
      const btnInteraction = {
        guildId: 'guild-1',
        customId: 'pet:play:owner-1',
        user: { id: 'owner-1', username: 'OwnerUser' },
        message: { edit: vi.fn() },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined)
      } as unknown as ButtonInteraction;

      vi.spyOn(PetService, 'playWithPet').mockRejectedValue(
        new Error('Thú cưng đang mệt, hãy đợi thêm 10 phút để chơi tiếp!')
      );

      await handlePetButton(btnInteraction);

      expect(btnInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Thú cưng đang mệt')
        })
      );
    });
  });
});
