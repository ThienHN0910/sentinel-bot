import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import cron from 'node-cron';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder
} from 'discord.js';
import { IDailyQuestion, QuestionBankItem, QuestionType } from '@sentinel/shared';
import { DailyQuestionModel } from '../../models/DailyQuestion.js';
import { GuildConfigModel } from '../../models/GuildConfig.js';
import { UserStatModel } from '../../models/UserStat.js';

let cachedQuestionBank: QuestionBankItem[] | null = null;

function loadQuestionBank(): QuestionBankItem[] {
  if (cachedQuestionBank) {
    return cachedQuestionBank;
  }

  const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

  const candidatePaths = [
    resolve(currentDir, '../../../../../packages/shared/src/constants/questions.json'),
    resolve(currentDir, '../../../../packages/shared/src/constants/questions.json'),
    resolve(process.cwd(), 'packages/shared/src/constants/questions.json'),
    resolve(process.cwd(), '../../packages/shared/src/constants/questions.json')
  ];

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      const raw = readFileSync(candidate, 'utf-8');
      cachedQuestionBank = JSON.parse(raw) as QuestionBankItem[];
      return cachedQuestionBank;
    }
  }

  throw new Error('Question bank questions.json not found');
}

export class DailyQuestionService {
  /**
   * Returns date string in format YYYY-MM-DD for Asia/Ho_Chi_Minh timezone (UTC+7).
   */
  public static getTodayDateString(now: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(now);
  }

  /**
   * Retrieves a random question from the question bank, optionally filtered by type.
   */
  public static getRandomQuestion(type?: QuestionType): QuestionBankItem {
    const bank = loadQuestionBank();
    const filtered = type ? bank.filter((item) => item.type === type) : bank;
    if (filtered.length === 0) {
      throw new Error(`No questions found in bank for type: ${type}`);
    }

    const randomIndex = Math.floor(Math.random() * filtered.length);
    return JSON.parse(JSON.stringify(filtered[randomIndex])) as QuestionBankItem;
  }

  /**
   * Builds an embed for a daily question displaying options and vote statistics.
   */
  public static createQuestionEmbed(question: IDailyQuestion): EmbedBuilder {
    const totalVotes = question.options.reduce(
      (sum, opt) => sum + (opt.votes ? opt.votes.length : 0),
      0
    );

    let typeTitle = 'Câu Hỏi Trong Ngày';
    let color = 0x3b82f6; // blue

    if (question.type === 'wyr') {
      typeTitle = '🤔 Would You Rather? | Bạn Thà Chọn...';
      color = 0x8b5cf6; // purple
    } else if (question.type === 'this_that') {
      typeTitle = '⚖️ This or That? | Cái Này Hay Cái Kia';
      color = 0x06b6d4; // cyan
    } else if (question.type === 'trivia') {
      typeTitle = '🧠 Câu Đố Tri Thức (Trivia)';
      color = 0xf59e0b; // amber
    }

    const embed = new EmbedBuilder()
      .setTitle(typeTitle)
      .setDescription(
        question.type === 'trivia'
          ? `**${question.question}**\n\n🎁 *Trả lời đúng nhận ngay **+50 DNE Coins** và **+20 XP**! Lưu ý: Mỗi người chỉ được chọn 1 lần duy nhất.*`
          : `**${question.question}**`
      )
      .setColor(color)
      .setFooter({
        text: `Sentinel QOTD • ${question.date} • Tổng lượt bình chọn: ${totalVotes}`
      });

    for (const opt of question.options) {
      const votesCount = opt.votes ? opt.votes.length : 0;
      const percentage =
        totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;

      embed.addFields({
        name: `Lựa chọn [${opt.key}]`,
        value: `${opt.label}\n📊 **${votesCount}** lượt chọn (${percentage}%)`,
        inline: question.options.length <= 2
      });
    }

    return embed;
  }

  /**
   * Builds the action row with vote buttons for each option.
   */
  public static createQuestionButtons(
    question: IDailyQuestion
  ): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();

    for (const opt of question.options) {
      const labelText = `[${opt.key}] ${opt.label}`;
      const truncatedLabel =
        labelText.length > 80 ? `${labelText.slice(0, 77)}...` : labelText;

      const button = new ButtonBuilder()
        .setCustomId(`qotd:vote:${question.date}:${opt.key}`)
        .setLabel(truncatedLabel)
        .setStyle(
          question.type === 'trivia'
            ? ButtonStyle.Secondary
            : ButtonStyle.Primary
        );

      row.addComponents(button);
    }

    return row;
  }

  /**
   * Posts daily question to the configured guild channel.
   * Guarantees single-delivery per day per guild.
   */
  public static async postDailyQuestion(params: {
    guildId: string;
    client: Client;
    forceQuestion?: QuestionBankItem;
    now?: Date;
  }): Promise<IDailyQuestion> {
    const date = DailyQuestionService.getTodayDateString(params.now);

    // Single-delivery check
    const existing = await DailyQuestionModel.findOne({
      guildId: params.guildId,
      date
    });
    if (existing) {
      return existing;
    }

    const config = await GuildConfigModel.findOne({ guildId: params.guildId });
    if (!config || !config.qotdChannelId) {
      throw new Error('QOTD channel is not configured for this guild.');
    }

    const channel = await params.client.channels
      .fetch(config.qotdChannelId)
      .catch(() => null);

    if (
      !channel ||
      !channel.isTextBased() ||
      typeof (channel as any).send !== 'function'
    ) {
      throw new Error(
        'Configured QOTD channel was not found or is not text-based.'
      );
    }

    const questionItem =
      params.forceQuestion || DailyQuestionService.getRandomQuestion();

    const tempQuestionDoc: IDailyQuestion = {
      guildId: params.guildId,
      date,
      type: questionItem.type,
      question: questionItem.prompt,
      options: questionItem.options.map((opt) => ({
        key: opt.key,
        label: opt.label,
        votes: []
      })),
      correctAnswerKey: questionItem.correctKey,
      rewardedUserIds: [],
      messageId: '',
      channelId: config.qotdChannelId
    };

    const embed = DailyQuestionService.createQuestionEmbed(tempQuestionDoc);
    const row = DailyQuestionService.createQuestionButtons(tempQuestionDoc);

    const message = await (channel as any).send({
      embeds: [embed],
      components: [row]
    });

    const created = await DailyQuestionModel.create({
      ...tempQuestionDoc,
      messageId: message.id
    });

    return created;
  }

  /**
   * Records a user's vote for a question option.
   * For trivia: locks answer and awards 50 DNE coins + 20 XP atomically if correct.
   * For wyr/this_that: allows changing votes dynamically.
   */
  public static async recordVote(params: {
    guildId: string;
    date: string;
    userId: string;
    username: string;
    optionKey: string;
  }): Promise<{
    success: boolean;
    isCorrect?: boolean;
    rewardEarned?: boolean;
    error?: string;
    question: IDailyQuestion;
  }> {
    const question = await DailyQuestionModel.findOne({
      guildId: params.guildId,
      date: params.date
    });

    if (!question) {
      return {
        success: false,
        error: 'Không tìm thấy câu hỏi trong ngày.',
        question: null as any
      };
    }

    const targetOption = question.options.find(
      (o) => o.key === params.optionKey
    );
    if (!targetOption) {
      return {
        success: false,
        error: 'Lựa chọn không hợp lệ.',
        question
      };
    }

    if (question.type === 'trivia') {
      const alreadyVoted = question.options.some((o) =>
        o.votes.includes(params.userId)
      );
      if (alreadyVoted) {
        return {
          success: false,
          error:
            'Bạn đã trả lời câu hỏi Trivia này rồi và không thể đổi đáp án.',
          question
        };
      }

      targetOption.votes.push(params.userId);
      const isCorrect = params.optionKey === question.correctAnswerKey;
      let rewardEarned = false;

      if (isCorrect && !question.rewardedUserIds.includes(params.userId)) {
        question.rewardedUserIds.push(params.userId);
        rewardEarned = true;

        await UserStatModel.findOneAndUpdate(
          { guildId: params.guildId, userId: params.userId },
          {
            $inc: { dneCoins: 50, exp: 20 },
            $setOnInsert: {
              username: params.username,
              avatar: ''
            },
            $set: { updatedAt: new Date() }
          },
          { upsert: true, new: true }
        );
      }

      question.markModified?.('options');
      question.markModified?.('rewardedUserIds');
      await question.save();

      return {
        success: true,
        isCorrect,
        rewardEarned,
        question
      };
    } else {
      // 'wyr' or 'this_that': allow changing votes
      for (const opt of question.options) {
        opt.votes = opt.votes.filter((id) => id !== params.userId);
      }
      targetOption.votes.push(params.userId);

      question.markModified?.('options');
      await question.save();

      return {
        success: true,
        question
      };
    }
  }

  /**
   * Initializes daily cron job scheduled at 10:00 (Asia/Ho_Chi_Minh).
   */
  public static startDailyCron(client: Client): any {
    return cron.schedule(
      '0 10 * * *',
      async () => {
        try {
          const configs = await GuildConfigModel.find({
            qotdChannelId: { $exists: true, $nin: [null, ''] }
          });

          for (const config of configs) {
            if (!config.qotdChannelId) continue;
            await DailyQuestionService.postDailyQuestion({
              guildId: config.guildId,
              client
            }).catch((err) => {
              console.error(
                `[QOTD] Error posting daily question for guild ${config.guildId}:`,
                err
              );
            });
          }
        } catch (err) {
          console.error('[QOTD] Error in daily cron execution:', err);
        }
      },
      { timezone: 'Asia/Ho_Chi_Minh' }
    );
  }
}
