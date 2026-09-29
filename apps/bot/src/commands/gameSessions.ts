import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type ButtonInteraction, type ChatInputCommandInteraction, type Client } from 'discord.js';
import type { GameSessionView, RpsChoice } from '@sentinel/shared';
import { actOnGameSession, attachGameMessage, createGameSession, getGameSession } from '../services/game/GameSessionService';

const GAME_ID = /^[A-Za-z0-9_-]{21}$/;
const webBase = () => (process.env.FRONTEND_URL || 'https://sentinel-dashboard.thienhn.io.vn').replace(/\/$/, '');
const webUrl = (id: string) => `${webBase()}/games/${id}`;
const button = (id: string, label: string, style = ButtonStyle.Secondary, disabled = false) =>
  new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);

export function renderGameMessage(game: GameSessionView) {
  const name = game.kind === 'tictactoe' ? 'Cờ 3×3' : 'Oẳn tù tì';
  const status = game.phase === 'waiting' ? 'Đang chờ người thứ hai' :
    game.phase === 'expired' ? 'Ván đã hết hạn' : game.phase === 'finished' ?
      (game.result?.winnerId ? `Người thắng: <@${game.result.winnerId}>` : 'Hòa') :
      game.kind === 'tictactoe' ? `Lượt của <@${game.turnId}>` :
        `<@${game.creatorId}> ${game.rps?.creatorChosen ? 'đã chọn' : 'chưa chọn'} · <@${game.opponentId}> ${game.rps?.opponentChosen ? 'đã chọn' : 'chưa chọn'}`;
  const content = `**${name}** · ${status}\nNgười tạo: <@${game.creatorId}>${game.opponentId ? ` · Người tham gia: <@${game.opponentId}>` : ''}\nChơi tiếp trên web: ${webUrl(game.sessionId)}`;
  if (game.phase === 'waiting') {
    return { content, components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button(`game:join:${game.sessionId}`, 'Tham gia', ButtonStyle.Primary))] };
  }
  if (game.kind === 'rps') {
    const components = game.phase === 'active' ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
      button(`game:pick:${game.sessionId}`, 'Chọn kín', ButtonStyle.Primary)
    )] : [];
    const revealed = game.phase === 'finished' && game.rps?.choices ?
      `\nLựa chọn: ${game.rps.choices.creator} / ${game.rps.choices.opponent}` : '';
    return { content: content + revealed, components };
  }
  const board = game.board ?? Array(9).fill(null);
  const components = [0, 1, 2].map(row => new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...[0, 1, 2].map(col => {
      const cell = row * 3 + col;
      return button(`game:place:${game.sessionId}:${cell}`, board[cell] || '·',
        board[cell] === 'X' ? ButtonStyle.Danger : board[cell] === 'O' ? ButtonStyle.Success : ButtonStyle.Secondary,
        game.phase !== 'active' || !!board[cell]);
    })
  ));
  return { content, components };
}

async function replyError(interaction: ChatInputCommandInteraction | ButtonInteraction, error: unknown) {
  const message = error instanceof Error ? error.message : 'Không thể xử lý ván này.';
  if (interaction.deferred || interaction.replied) await interaction.editReply(message);
  else await interaction.reply({ content: message, ephemeral: true });
}

export async function handleNewGameCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) { await interaction.reply({ content: 'Chỉ tạo ván trong server.', ephemeral: true }); return; }
  await interaction.deferReply();
  try {
    const kind = interaction.options.getSubcommand() === 'rps' ? 'rps' : 'tictactoe';
    const game = await createGameSession({ guildId: interaction.guildId, creatorId: interaction.user.id, kind, channelId: interaction.channelId });
    const message = await interaction.editReply(renderGameMessage(game));
    try { await attachGameMessage(game.sessionId, interaction.user.id, interaction.guildId, interaction.channelId, message.id); }
    catch { await interaction.followUp({ content: `Ván đã được tạo. Bạn vẫn chơi được tại ${webUrl(game.sessionId)}.`, ephemeral: true }); }
  } catch (error) { await replyError(interaction, error); }
}

export async function handleOpenGameCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  try {
    const id = interaction.options.getString('id', true);
    if (!GAME_ID.test(id)) throw new Error('Mã ván không hợp lệ.');
    const game = await getGameSession(id, interaction.user.id);
    if (!interaction.guildId || game.guildId !== interaction.guildId) throw new Error('Ván thuộc server khác.');
    if (game.creatorId !== interaction.user.id && game.opponentId !== interaction.user.id) throw new Error('Chỉ người chơi được mở ván.');
    if (game.discordMessageUrl) { await interaction.editReply(`Ván đã mở: ${game.discordMessageUrl}`); return; }
    if (game.phase !== 'waiting' && game.phase !== 'active') throw new Error('Ván đã kết thúc hoặc hết hạn.');
    const channel = interaction.channel;
    if (!channel?.isTextBased() || !('send' in channel)) throw new Error('Cần kênh văn bản để mở ván.');
    const message = await channel.send(renderGameMessage(game));
    try {
      const attached = await attachGameMessage(id, interaction.user.id, interaction.guildId, interaction.channelId, message.id);
      await interaction.editReply(`Đã mở ván: ${attached.discordMessageUrl}`);
    } catch (error) {
      await message.delete().catch(() => undefined);
      throw error;
    }
  } catch (error) { await replyError(interaction, error); }
}

export async function syncGameMessage(client: Client | undefined, game: GameSessionView): Promise<void> {
  if (!client || !game.discordMessageUrl) return;
  const match = game.discordMessageUrl.match(/\/channels\/\d+\/(\d+)\/(\d+)$/);
  if (!match) return;
  const channel = await client.channels.fetch(match[1]);
  if (channel?.isTextBased() && 'messages' in channel) {
    const message = await channel.messages.fetch(match[2]);
    await message.edit(renderGameMessage(game));
  }
}

export async function handleGameButton(interaction: ButtonInteraction): Promise<void> {
  const [, action, id, value] = interaction.customId.split(':');
  if (!GAME_ID.test(id) || !['join', 'pick', 'place', 'choose'].includes(action)) {
    await interaction.reply({ content: 'Nút game không hợp lệ.', ephemeral: true }); return;
  }
  await interaction.deferReply({ ephemeral: true });
  try {
    const game = await getGameSession(id, interaction.user.id);
    if (!interaction.guildId || game.guildId !== interaction.guildId) throw new Error('Ván thuộc server khác.');
    if (action === 'pick') {
      if (game.kind !== 'rps' || game.phase !== 'active' ||
        (interaction.user.id !== game.creatorId && interaction.user.id !== game.opponentId)) throw new Error('Bạn không thể chọn trong ván này.');
      if (game.rps?.ownChoice) throw new Error('Bạn đã chọn rồi.');
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        button(`game:choose:${id}:rock`, 'Búa'), button(`game:choose:${id}:paper`, 'Bao'),
        button(`game:choose:${id}:scissors`, 'Kéo')
      );
      await interaction.editReply({ content: 'Chọn kín một lựa chọn:', components: [row] });
      return;
    }
    const move = action === 'join' ? { type: 'join' as const } : action === 'place' ?
      { type: 'place' as const, cell: Number(value) } : { type: 'choose' as const, choice: value as RpsChoice };
    if (action === 'place' && !/^[0-8]$/.test(value || '')) throw new Error('Ô không hợp lệ.');
    if (action === 'choose' && !['rock', 'paper', 'scissors'].includes(value)) throw new Error('Lựa chọn không hợp lệ.');
    const updated = await actOnGameSession(id, interaction.user.id, move);
    try { await syncGameMessage(interaction.client, updated); }
    catch { await interaction.editReply(`Đã lưu lượt chơi. Tiếp tục tại ${webUrl(id)}; tin nhắn Discord có thể chưa cập nhật.`); return; }
    await interaction.editReply(action === 'choose' ? `Đã ghi nhận lựa chọn kín: ${value}.` : 'Đã cập nhật ván.');
  } catch (error) { await replyError(interaction, error); }
}
