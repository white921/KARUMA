import { ButtonInteraction, EmbedBuilder, GuildMember, TextChannel } from "discord.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

import { PANEL_COMMAND_NAMES } from "../constant/command";
import { CURRENCY_NAMES } from "../constant/currency";
import { BOT_ID, TEXT_CHANNEL_IDS } from "../constant/id";
import { OmikujiPrize, selectOmikujiPrize } from "../constant/omikuji";
import { COLOR } from "../constant/color";
import { DbService } from "./dbService";

type WalletRow = RowDataPacket & { wallet: number };

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
        `💀 **${prize.fortune}！**\n` +
        `本来は**${Math.abs(prize.amount).toLocaleString()}${CURRENCY_NAMES}**の減額ですが、残高が足りないので今回は残高**0${CURRENCY_NAMES}**で許してあげます。`
      );
    }
    return (
      `💀 **${prize.fortune}！**\n` +
      `**${Math.abs(prize.amount).toLocaleString()}${CURRENCY_NAMES}** を失いました…。\n` +
      `現在の残高：${afterWallet.toLocaleString()}${CURRENCY_NAMES}`
    );
  }

  return (
    `🎊 **${prize.fortune}！**\n` +
    `**${prize.amount.toLocaleString()}${CURRENCY_NAMES}** を獲得しました！\n` +
    `現在の残高：${afterWallet.toLocaleString()}${CURRENCY_NAMES}`
  );
}

export function createOmikujiSpecialLogEmbed(
  displayName: string,
  avatarUrl: string,
  prize: OmikujiPrize,
  actualAmount: number,
  afterWallet: number,
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
      { name: "残高", value: `${afterWallet.toLocaleString()}${CURRENCY_NAMES}`, inline: true },
      ...(wasBalanceCapped
        ? [
            {
              name: "補足",
              value: `本来の減額: -${Math.abs(prize.amount).toLocaleString()}${CURRENCY_NAMES}（残高不足のため0${CURRENCY_NAMES}まで）`,
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
   * 日本時間で一日一回だけ抽選し、当選記録・残高・取引履歴を同一トランザクションで確定する。
   */
  static async draw(interaction: ButtonInteraction): Promise<void> {
    const prize = selectOmikujiPrize(Math.random());
    const drawDate = getJapanDate();
    const connection = await DbService.getConnection();

    let afterWallet = 0;
    let actualAmount = 0;
    let wasBalanceCapped = false;
    try {
      await connection.beginTransaction();
      try {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO omikuji_draws (user_id, draw_date, fortune, amount)
           VALUES (?, ?, ?, ?)`,
          [interaction.user.id, drawDate, prize.fortune, prize.amount],
        );
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") {
          throw new Error("おみくじは日本時間で1日1回までです。次の0:00以降に引けます。");
        }
        throw error;
      }

      const [userRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE",
        [interaction.user.id],
      );
      const [botRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ?",
        [BOT_ID],
      );
      const user = userRows[0];
      const bot = botRows[0];
      if (!user || !bot) {
        throw new Error("おみくじの口座情報が見つかりません。");
      }

      const currentWallet = Number(user.wallet);
      afterWallet = calculateOmikujiWalletAfter(currentWallet, prize.amount);
      actualAmount = afterWallet - currentWallet;
      wasBalanceCapped = prize.amount < 0 && actualAmount !== prize.amount;
      await connection.execute(
        "UPDATE accounts SET wallet = ? WHERE user_id = ?",
        [afterWallet, interaction.user.id],
      );
      await connection.execute(
        `INSERT INTO actions
         (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          PANEL_COMMAND_NAMES.OMIKUJI_DRAW,
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
          afterWallet,
        ),
      ],
    });
  }
}
