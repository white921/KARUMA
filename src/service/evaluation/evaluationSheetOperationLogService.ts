import { Client, EmbedBuilder, escapeMarkdown } from "discord.js";
import { COLOR } from "../../constant/shared/color";
import { TEXT_CHANNEL_IDS } from "../../constant/shared/id";

type EvaluationSheetDeleteLog = {
  operatorUserId: string;
  targetUserId: string;
  savedCount: number;
  deletedCount: number;
  pendingDeletionCount: number;
  reason: string | null;
};

type EvaluationSheetRestoreLog = {
  operatorUserId: string;
  targetUserId: string;
  createdCount: number;
  restoredCount: number;
  restoreFailureCount: number;
};

type EvaluationExtensionLog = {
  operatorUserId: string;
  targetUserId: string | null;
  days: number;
  extendedCount: number;
  skippedCount: number;
  failedCount: number;
  reason: string | null;
};

export class EvaluationSheetOperationLogService {
  static async sendDelete(
    client: Client,
    guildId: string,
    log: EvaluationSheetDeleteLog,
  ): Promise<void> {
    const fields = [
      { name: "実行者", value: `<@${log.operatorUserId}>` },
      { name: "対象者", value: `<@${log.targetUserId}>` },
      { name: "保存件数", value: `${log.savedCount}件`, inline: true },
      { name: "削除件数", value: `${log.deletedCount}件`, inline: true },
      { name: "理由", value: this.formatReason(log.reason) },
    ];
    if (log.pendingDeletionCount > 0) {
      fields.splice(4, 0, {
        name: "削除未完了",
        value: `${log.pendingDeletionCount}件`,
        inline: true,
      });
    }

    await this.send(
      client,
      guildId,
      TEXT_CHANNEL_IDS.EVALUATION_SHEET_ARCHIVE_LOG,
      new EmbedBuilder()
        .setTitle("評価シート保存・削除")
        .setColor(COLOR.RED)
        .addFields(fields)
        .setTimestamp(),
    );
  }

  static async sendRestore(
    client: Client,
    guildId: string,
    log: EvaluationSheetRestoreLog,
  ): Promise<void> {
    await this.send(
      client,
      guildId,
      TEXT_CHANNEL_IDS.EVALUATION_SHEET_ARCHIVE_LOG,
      new EmbedBuilder()
        .setTitle("評価シート復元")
        .setColor(COLOR.GREEN)
        .addFields(
          { name: "実行者", value: `<@${log.operatorUserId}>` },
          { name: "対象者", value: `<@${log.targetUserId}>` },
          { name: "作成件数", value: `${log.createdCount}件`, inline: true },
          { name: "過去評価の添付", value: `${log.restoredCount}件`, inline: true },
          { name: "添付失敗", value: `${log.restoreFailureCount}件`, inline: true },
        )
        .setTimestamp(),
    );
  }

  static async sendExtension(
    client: Client,
    guildId: string,
    log: EvaluationExtensionLog,
  ): Promise<void> {
    const operation = log.days < 0 ? "短縮" : "延長";
    const signedDays = `${log.days > 0 ? "+" : ""}${log.days}日`;
    await this.send(
      client,
      guildId,
      TEXT_CHANNEL_IDS.EVALUATION_EXTENSION_LOG,
      new EmbedBuilder()
        .setTitle(`評価期間${operation}`)
        .setColor(log.days < 0 ? COLOR.YELLOW : COLOR.BLUE)
        .addFields(
          { name: "実行者", value: `<@${log.operatorUserId}>` },
          { name: "対象", value: log.targetUserId ? `<@${log.targetUserId}>` : "全員" },
          { name: "変更日数", value: signedDays, inline: true },
          { name: "更新件数", value: `${log.extendedCount}件`, inline: true },
          { name: "スキップ", value: `${log.skippedCount}件`, inline: true },
          { name: "失敗", value: `${log.failedCount}件`, inline: true },
          { name: "理由", value: this.formatReason(log.reason) },
        )
        .setTimestamp(),
    );
  }

  private static async send(
    client: Client,
    guildId: string,
    channelId: string,
    embed: EmbedBuilder,
  ): Promise<void> {
    try {
      const channel = await client.channels.fetch(channelId);
      if (
        !channel ||
        !channel.isTextBased() ||
        !("send" in channel) ||
        !("guildId" in channel) ||
        channel.guildId !== guildId
      ) {
        throw new Error("評価シート操作ログの送信先が見つかりません。");
      }
      await channel.send({
        embeds: [embed],
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      // 評価シート操作は確定済み。ログ失敗を操作失敗として見せ、再実行を誘発しない。
      console.error("[EvaluationSheetOperationLog] ログ送信失敗", {
        channelId,
        guildId,
        error,
      });
    }
  }

  private static formatReason(reason: string | null): string {
    const escaped = escapeMarkdown(reason?.trim() || "未記入");
    return escaped.length <= 1024 ? escaped : `${escaped.slice(0, 1021)}...`;
  }
}
