import { EmbedBuilder } from "discord.js";
import { ACTION_TYPES } from "../../constant/currency/action";
import { CURRENCY_NAMES } from "../../constant/currency/currency";
import { RECEIPT_DM_DEFINITIONS, RECEIPT_DM_TEST_RECIPIENT_ID } from "../../constant/currency/receiptDm";
import { COLOR } from "../../constant/shared/color";
import { BOT_ID } from "../../constant/shared/id";
import type { CurrencyReceipt, ReceiptDmContext } from "../../type/currency/receiptDm";

export class ReceiptDmService {
  /** 残高・履歴の確定後に呼ぶ。DM失敗は金銭処理へ伝播させず、再送もしない。 */
  static async send(context: ReceiptDmContext, receipt: CurrencyReceipt): Promise<void> {
    const definition = RECEIPT_DM_DEFINITIONS[receipt.actionType];
    if (receipt.recipientId !== RECEIPT_DM_TEST_RECIPIENT_ID || !definition) return;
    try {
      const isDeduction = receipt.actionType === ACTION_TYPES.ADMIN_BURN
        || (receipt.actionType === ACTION_TYPES.OMIKUJI_DRAW && receipt.amount < 0);
      const omikujiLoss = receipt.actionType === ACTION_TYPES.OMIKUJI_DRAW && receipt.amount <= 0 && receipt.comment === "凶";
      const senderId = definition.humanSender ? receipt.senderId : BOT_ID;
      if (!senderId) throw new Error("Receipt sender is missing");
      const member = definition.humanSender
        ? await context.guild?.members.fetch(senderId).catch(() => null) : null;
      const sender = member?.user ?? (senderId === BOT_ID ? context.client.user : null)
        ?? await context.client.users.fetch(senderId);
      const avatarUrl = member?.displayAvatarURL({ extension: "png" }) ?? sender.displayAvatarURL({ extension: "png" });
      const embed = new EmbedBuilder()
        .setColor(isDeduction || omikujiLoss ? COLOR.RED : COLOR.GREEN)
        .setAuthor({ name: definition.humanSender ? member?.displayName ?? sender.displayName : "LEVELIA BOT", iconURL: avatarUrl })
        .setThumbnail(avatarUrl)
        .setTitle(omikujiLoss ? "⛩️ おみくじによる減額のお知らせ" : definition.title)
        .setDescription(`${definition.humanSender ? `<@${senderId}> さんから ` : ""}**${Math.abs(receipt.amount).toLocaleString("ja-JP")} ${CURRENCY_NAMES}**${omikujiLoss ? "が差し引かれました。" : definition.verb}`)
        .setFooter({ text: `${omikujiLoss ? "減額後" : definition.balanceLabel}の残高：${receipt.afterWallet.toLocaleString("ja-JP")} ${CURRENCY_NAMES}` })
        .setTimestamp();
      const fields = [...(receipt.fields ?? [])];
      if (receipt.comment?.trim()) fields.push({ name: definition.commentLabel ?? "備考", value: receipt.comment });
      for (const field of fields.slice(0, 4)) {
        embed.addFields({ name: field.name.slice(0, 256), value: field.value.length > 1024 ? `${field.value.slice(0, 1023)}…` : field.value });
      }
      const recipient = await context.client.users.fetch(receipt.recipientId);
      await recipient.send({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) {
      console.error("[ReceiptDmService] Transaction completed but receipt DM failed", {
        recipientId: receipt.recipientId, actionType: receipt.actionType, error,
      });
    }
  }
}
