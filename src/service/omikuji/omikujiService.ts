import { ButtonInteraction, EmbedBuilder, GuildMember, TextChannel } from "discord.js";
import type { RowDataPacket } from "mysql2";
import { ACTION_TYPES } from "../../constant/action";
import { COLOR } from "../../constant/color";
import { CURRENCY_NAMES } from "../../constant/currency";
import { BOT_ID, TEXT_CHANNEL_IDS } from "../../constant/id";
import {
  OMIKUJI_FORTUNE_MESSAGES,
  OMIKUJI_MESSAGES,
  selectOmikujiPrize,
} from "../../constant/omikuji";
import type { OmikujiPrize, WalletRow } from "../../type/omikuji";
import { AccountService } from "../account/accountService";
import { DbService } from "../system/dbService";

export function assertOmikujiDrawAllowed(isSubAccount: boolean): void {
  if (isSubAccount) {
    throw new Error(OMIKUJI_MESSAGES.SUB_ACCOUNT_NOT_ALLOWED);
  }
}

export function assertOmikujiDailyLimit(hasDrawnToday: boolean): void {
  if (hasDrawnToday) {
    throw new Error("おみくじは日本時間で1日1回までです。次の0:00以降に引けます。");
  }
}

export function calculateOmikujiWalletAfter(
  currentWallet: number,
  amount: number,
): number {
  return Math.max(0, currentWallet + amount);
}

export function formatOmikujiDrawReply(
  prize: OmikujiPrize,
  afterWallet: number,
  wasBalanceCapped: boolean,
): string {
  if (prize.amount < 0) {
    if (wasBalanceCapped) {
      return (
        `📜 **皇帝のお告げ：${prize.fortune}**\n` +
        `本来は**${Math.abs(prize.amount).toLocaleString()}${CURRENCY_NAMES}**の減額だが、残高が足りないなら仕方ない。今回は残高**0${CURRENCY_NAMES}**で許してあげよう。これから善行を積むのだよ。`
      );
    }
    return (
      `📜 **皇帝のお告げ：${prize.fortune}**\n` +
      `今日は己を見つめ直す日だ。**${Math.abs(prize.amount).toLocaleString()}${CURRENCY_NAMES}** を納め、次はよりよい行いを心がけなさい。\n` +
      `現在の残高：${afterWallet.toLocaleString()}${CURRENCY_NAMES}`
    );
  }
  const message = OMIKUJI_FORTUNE_MESSAGES[prize.fortune];

  return (
    `📜 **皇帝のお告げ：${prize.fortune}**\n` +
    `${message}\n` +
    `**${prize.amount.toLocaleString()}${CURRENCY_NAMES}** を授けよう。\n` +
    `現在の残高：${afterWallet.toLocaleString()}${CURRENCY_NAMES}`
  );
}

export function createOmikujiSpecialLogEmbed(
  displayName: string,
  avatarUrl: string,
  prize: OmikujiPrize,
  actualAmount: number,
): EmbedBuilder {
  const result = prize.fortune === "超大吉" ? "🎉 超大吉" : "💀 凶";
  const actualAmountText = `${actualAmount >= 0 ? "+" : "-"}${Math.abs(
    actualAmount,
  ).toLocaleString()}${CURRENCY_NAMES}`;
  const wasBalanceCapped = actualAmount !== prize.amount;

  return new EmbedBuilder()
    .setTitle(`おみくじ ${result}`)
    .setAuthor({ name: displayName, iconURL: avatarUrl })
    .setThumbnail(avatarUrl)
    .setColor(prize.fortune === "超大吉" ? COLOR.YELLOW : COLOR.RED)
    .addFields(
      { name: "結果", value: prize.fortune, inline: true },
      { name: "増減", value: actualAmountText, inline: true },
      ...(wasBalanceCapped
        ? [
            {
              name: "補足",
              value: `本来の減額: -${Math.abs(prize.amount).toLocaleString()}${CURRENCY_NAMES}（残高不足のため減額は可能な額まで）`,
            },
          ]
        : []),
    );
}

export function getJapanDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) {
    throw new Error("日本時間の日付を取得できませんでした。");
  }
  return `${year}-${month}-${day}`;
}

export class OmikujiService {
  /**
   * サブアカウント以外は日本時間で一日一回抽選できる。
   * 当選記録・残高・取引履歴は同一トランザクションで確定する。
  */
  static async draw(interaction: ButtonInteraction): Promise<void> {
    assertOmikujiDrawAllowed(
      await AccountService.isSubAccount(interaction.user.id),
    );

    const prize = selectOmikujiPrize(Math.random());
    const drawDate = getJapanDate();
    const connection = await DbService.getConnection();

    let afterWallet = 0;
    let actualAmount = 0;
    let wasBalanceCapped = false;
    try {
      await connection.beginTransaction();
      const [userRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE",
        [interaction.user.id],
      );
      const user = userRows[0];
      if (!user) {
        throw new Error("おみくじの口座情報が見つかりません。");
      }

      const [drawRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM omikuji_draws
         WHERE user_id = ? AND draw_date = ?
         LIMIT 1`,
        [interaction.user.id, drawDate],
      );
      assertOmikujiDailyLimit(drawRows.length > 0);

      const [botRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ?",
        [BOT_ID],
      );
      const bot = botRows[0];
      if (!bot) {
        throw new Error("おみくじの口座情報が見つかりません。");
      }

      const currentWallet = Number(user.wallet);
      afterWallet = calculateOmikujiWalletAfter(currentWallet, prize.amount);
      actualAmount = afterWallet - currentWallet;
      wasBalanceCapped = prize.amount < 0 && actualAmount !== prize.amount;
      await connection.execute(
        `INSERT INTO omikuji_draws (user_id, draw_date, fortune, amount)
         VALUES (?, ?, ?, ?)`,
        [interaction.user.id, drawDate, prize.fortune, prize.amount],
      );
      await connection.execute(
        "UPDATE accounts SET wallet = ? WHERE user_id = ?",
        [afterWallet, interaction.user.id],
      );
      await connection.execute(
        `INSERT INTO actions
         (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ACTION_TYPES.OMIKUJI_DRAW,
          actualAmount,
          BOT_ID,
          interaction.user.id,
          Number(bot.wallet),
          afterWallet,
          prize.fortune,
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (prize.fortune === "凶" || prize.fortune === "超大吉") {
      await this.sendSpecialResultLog(
        interaction,
        prize,
        actualAmount,
        afterWallet,
      );
    }

    await interaction.editReply({
      content: formatOmikujiDrawReply(prize, afterWallet, wasBalanceCapped),
    });
  }

  private static async sendSpecialResultLog(
    interaction: ButtonInteraction,
    prize: OmikujiPrize,
    actualAmount: number,
    afterWallet: number,
  ): Promise<void> {
    const member =
      interaction.member instanceof GuildMember
        ? interaction.member
        : await interaction.guild?.members
            .fetch(interaction.user.id)
            .catch(() => null);
    const displayName = member?.displayName ?? interaction.user.displayName;
    const avatarUrl = member
      ? member.displayAvatarURL({ extension: "png" })
      : interaction.user.displayAvatarURL({ extension: "png" });
    const channel = await interaction.client.channels.fetch(
      TEXT_CHANNEL_IDS.OMIKUJI_SPECIAL_LOG,
    );
    if (!channel || !channel.isTextBased()) {
      throw new Error("おみくじ特別結果ログチャンネルが見つからないか、無効な型です。");
    }

    await (channel as TextChannel).send({
      embeds: [
        createOmikujiSpecialLogEmbed(
          displayName,
          avatarUrl,
          prize,
          actualAmount,
        ),
      ],
    });
  }
}
