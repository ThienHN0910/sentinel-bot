import {
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { WordChainGame } from '../services/game/WordChainGame';
import {
  BauCuaGame,
  calculateBauCuaPayout,
  BAU_CUA_ITEMS,
  type BauCuaItem
} from '../services/game/BauCuaGame';
import { UserStatModel } from '../models/UserStat';

export async function handleWordChainCommand(interaction: ChatInputCommandInteraction) {
  const word = interaction.options.getString('word', true);
  const result = WordChainGame.processWord(interaction.channelId, word);

  await interaction.reply({
    content: result.message
  });
}

export async function handleBauCuaCommand(interaction: ChatInputCommandInteraction) {
  const item = interaction.options.getString('item', true) as BauCuaItem;
  const bet = interaction.options.getInteger('bet', true);

  if (bet <= 0) {
    return interaction.reply({
      content: 'Số xu cược phải lớn hơn 0!',
      ephemeral: true
    });
  }

  if (!BAU_CUA_ITEMS.includes(item)) {
    return interaction.reply({
      content: `Lựa chọn không hợp lệ! Vui lòng chọn một trong: ${BAU_CUA_ITEMS.join(', ')}`,
      ephemeral: true
    });
  }

  const guildId = interaction.guildId || 'dm';
  const userId = interaction.user.id;
  const username = interaction.user.username;

  const stat = await UserStatModel.findOne({ guildId, userId });
  const currentBalance = stat?.dneCoins ?? 0;

  if (currentBalance < bet) {
    return interaction.reply({
      content: `Số dư DNE Coins của bạn không đủ! Hiện có: **${currentBalance}** xu.`,
      ephemeral: true
    });
  }

  const rolled = BauCuaGame.rollDice();
  const payout = calculateBauCuaPayout(item, bet, rolled);
  const netChange = payout - bet;

  await UserStatModel.findOneAndUpdate(
    { guildId, userId },
    {
      $inc: { dneCoins: netChange },
      $setOnInsert: { username }
    },
    { upsert: true }
  );

  const isWin = payout > 0;
  const embed = new EmbedBuilder()
    .setTitle('🎲 BẦU CUA TÔM CÁ')
    .setColor(isWin ? 0x00e676 : 0xff3366)
    .setDescription(`Kết quả phiên đặt cược của **${username}**:`)
    .addFields(
      { name: '🎯 Bạn đặt cược', value: `**${item}** (${bet} DNE Coins)`, inline: true },
      { name: '🎲 Xúc xắc ra', value: rolled.map((d) => `[${d}]`).join(' '), inline: true },
      {
        name: '💰 Kết quả',
        value: isWin
          ? `🎉 Thắng! Nhận lại **${payout}** xu (Lãi: **+${netChange}** xu)`
          : `😢 Rất tiếc! Mất **${bet}** xu`,
        inline: false
      }
    )
    .setFooter({ text: 'DNE Gaming • Chúc bạn may mắn lần sau!' });

  await interaction.reply({ embeds: [embed] });
}

export async function handleGameCommand(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand(false);

  if (subcommand === 'wordchain' || subcommand === 'noitu') {
    return handleWordChainCommand(interaction);
  }

  if (subcommand === 'baucua') {
    return handleBauCuaCommand(interaction);
  }

  return interaction.reply({
    content: 'Vui lòng chọn mini-game: `/game wordchain <từ>` hoặc `/game baucua <cửa> <tiền cược>`',
    ephemeral: true
  });
}
