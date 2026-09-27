import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import { nanoid } from 'nanoid';
import { WheelSessionModel } from '../models/WheelSession';

export async function handleRandomWheelCommand(interaction: ChatInputCommandInteraction) {
  const itemsRaw = interaction.options.getString('items', true);
  const itemLabels = itemsRaw
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);

  if (itemLabels.length < 2) {
    return interaction.reply({
      content: 'Vui lòng nhập ít nhất 2 mục, cách nhau bởi dấu phẩy!',
      ephemeral: true
    });
  }

  const items = itemLabels.map((label, idx) => ({
    id: `item-${idx}`,
    label,
    color: ['#00F2FE', '#7F00FF', '#FF007F', '#FFB300', '#00E676'][idx % 5],
    weight: 1
  }));

  const sessionId = nanoid(8);
  await WheelSessionModel.create({
    sessionId,
    guildId: interaction.guildId || 'dm',
    createdBy: interaction.user.username,
    items
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const webLink = `${frontendUrl}/wheel?session=${sessionId}`;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('🎡 Mở Vòng Quay 3D trên Web')
      .setStyle(ButtonStyle.Link)
      .setURL(webLink),
    new ButtonBuilder()
      .setCustomId(`spin_quick_${sessionId}`)
      .setLabel('⚡ Quay Nhanh tại Discord')
      .setStyle(ButtonStyle.Primary)
  );

  const embed = new EmbedBuilder()
    .setTitle('🎡 VÒNG QUAY MAY MẮN - DNE BOT')
    .setDescription(
      `Đã tạo phiên quay với **${items.length}** mục!\nBấm nút bên dưới để mở giao diện Web 3D hoặc quay nhanh.`
    )
    .setColor(0x7f00ff);

  await interaction.reply({ embeds: [embed], components: [row] });
}

export async function handleQuickSpinButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  if (!customId.startsWith('spin_quick_')) return;

  const sessionId = customId.replace('spin_quick_', '');
  const session = await WheelSessionModel.findOne({ sessionId });
  if (!session || !session.items || session.items.length === 0) {
    return interaction.reply({
      content: 'Không tìm thấy phiên vòng quay hoặc danh sách mục trống!',
      ephemeral: true
    });
  }

  if (session.isCompleted && session.winner) {
    return interaction.reply({
      content: `Vòng quay đã kết thúc trước đó! Kết quả: **${session.winner}**`,
      ephemeral: true
    });
  }

  const targetIndex = Math.floor(Math.random() * session.items.length);
  const winner = session.items[targetIndex].label;

  session.winner = winner;
  session.isCompleted = true;
  await session.save();

  const embed = new EmbedBuilder()
    .setTitle('🎉 KẾT QUẢ VÒNG QUAY MAY MẮN')
    .setDescription(`Chúc mừng! Mục may mắn trúng thưởng là:\n# 🏆 **${winner}**`)
    .setColor(0x00e676)
    .setFooter({ text: `Người quay: ${interaction.user.username} • Session: ${sessionId}` });

  await interaction.reply({ embeds: [embed] });
}
