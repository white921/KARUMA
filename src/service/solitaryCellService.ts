import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  GuildMember,
  OverwriteType,
  PermissionsBitField,
} from "discord.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

import { toActionType } from "../constant/action";
import { COLOR } from "../constant/color";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { BOT_ID, CATEGORY_IDS, ROLE_IDS, TEXT_CHANNEL_IDS } from "../constant/id";
import { CURRENCY_NAMES } from "../constant/currency";
import { SOLITARY_CELL, SOLITARY_CELL_MESSAGES } from "../constant/solitaryCell";
import { formatNumber } from "../util/number";
import { DbService } from "./dbService";

type SolitaryCellTier = {
  label: string;
  price: number;
};

type WalletRow = RowDataPacket & { wallet: number };

export class SolitaryCellService {
  static getTier(member: GuildMember): SolitaryCellTier {
    const paidTiers: Array<SolitaryCellTier & { roleId: string }> = [
      {
        label: "徴兵罪（上級）",
        price: SOLITARY_CELL.PRICES.CONSCRIPTION_CRIME,
        roleId: ROLE_IDS.DETENTION_ROLES.CONSCRIPTION_CRIME,
      },
      {
        label: "従軍罪（中級）",
        price: SOLITARY_CELL.PRICES.MILITARY_CRIME,
        roleId: ROLE_IDS.DETENTION_ROLES.MILITARY_CRIME,
      },
      {
        label: "召役罪（下級）",
        price: SOLITARY_CELL.PRICES.SUMMONED_CRIME,
        roleId: ROLE_IDS.DETENTION_ROLES.SUMMONED_CRIME,
      },
    ];

    const paidTier = paidTiers.find((tier) =>
      member.roles.cache.has(tier.roleId),
    );
    if (paidTier) {
      return paidTier;
    }

    if (member.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN)) {
      return { label: "空位者", price: SOLITARY_CELL.PRICES.VACANT };
    }

    throw new Error(SOLITARY_CELL_MESSAGES.NO_ELIGIBLE_ROLE);
  }

  static async showConfirmation(interaction: ButtonInteraction) {
    const member = interaction.member as GuildMember;
    const tier = this.getTier(member);
    const priceLabel =
      tier.price === 0
        ? "無料"
        : `${formatNumber(tier.price)}${CURRENCY_NAMES}`;

    const cancelButton = new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.SOLITARY_CELL_CANCEL)
      .setLabel(SOLITARY_CELL_MESSAGES.CANCEL)
      .setStyle(ButtonStyle.Secondary);
    const confirmButton = new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.SOLITARY_CELL_CONFIRM)
      .setLabel("作成を確定")
      .setStyle(ButtonStyle.Danger);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("独房を作成しますか？")
          .setDescription(
            `対象ロール：${tier.label}\n料金：**${priceLabel}**\n利用時間：${SOLITARY_CELL.DURATION_HOURS}時間`,
          )
          .setColor(COLOR.YELLOW),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          cancelButton,
          confirmButton,
        ),
      ],
      flags: "Ephemeral" as any,
    });
  }

  static async cancel(interaction: ButtonInteraction) {
    await interaction.update({
      content: SOLITARY_CELL_MESSAGES.CANCEL,
      embeds: [],
      components: [],
    });
  }

  static async create(interaction: ButtonInteraction) {
    const guild = interaction.guild;
    if (!guild) {
      throw new Error("この操作はサーバー内でのみ実行できます。");
    }

    const member = interaction.member as GuildMember;
    const tier = this.getTier(member);
    await interaction.deferUpdate();

    const category = await guild.channels.fetch(CATEGORY_IDS.SOLITARY);
    if (!category || category.type !== ChannelType.GuildCategory) {
      throw new Error("独房カテゴリが見つからないか、無効な型です。");
    }

    const permissionOverwrites: any[] = category.permissionOverwrites.cache.map(
      (overwrite) => ({
        id: overwrite.id,
        type: overwrite.type,
        allow: overwrite.allow,
        deny: overwrite.deny,
      }),
    );
    permissionOverwrites.push({
      id: interaction.user.id,
      type: OverwriteType.Member,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.Connect,
        PermissionsBitField.Flags.Speak,
        PermissionsBitField.Flags.UseVAD,
        PermissionsBitField.Flags.Stream,
        PermissionsBitField.Flags.SendMessages,
      ],
    });

    const voiceChannel = await guild.channels.create({
      name: `独房 - ${member.displayName}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites,
      userLimit: SOLITARY_CELL.USER_LIMIT,
    });

    const expireAt = new Date(
      Date.now() + SOLITARY_CELL.DURATION_HOURS * 60 * 60 * 1000,
    );
    let afterWallet = 0;
    try {
      afterWallet = await this.recordPurchase(
        interaction.user.id,
        tier.price,
        voiceChannel.id,
        expireAt,
      );
    } catch (error) {
      await voiceChannel.delete().catch((deleteError) =>
        console.error("独房作成の失敗後にVCを削除できませんでした:", deleteError),
      );
      throw error;
    }

    await voiceChannel
      .send(
        `期限時刻: ${expireAt.toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
          hour: "2-digit",
          minute: "2-digit",
        })}\n${SOLITARY_CELL_MESSAGES.EXPIRED_NOTICE}`,
      )
      .catch((error) => console.error("独房VCへの案内送信に失敗しました:", error));

    await this.sendLog(interaction, tier, voiceChannel.id, afterWallet);
    await interaction.editReply({
      content:
        `✅ 独房を作成しました。\n<#${voiceChannel.id}>\n` +
        `${tier.price === 0 ? "料金：無料" : `料金：${formatNumber(tier.price)}${CURRENCY_NAMES}`}`,
      embeds: [],
      components: [],
    });
  }

  private static async recordPurchase(
    userId: string,
    price: number,
    voiceChannelId: string,
    expireAt: Date,
  ): Promise<number> {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [accountRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE",
        [userId],
      );
      const account = accountRows[0];
      if (!account) {
        throw new Error("口座が見つかりません。");
      }
      if (account.wallet < price) {
        throw new Error(
          `残高が不足しています。\n現在の残高: ${formatNumber(account.wallet)}${CURRENCY_NAMES}\n必要な残高: ${formatNumber(price)}${CURRENCY_NAMES}`,
        );
      }

      const afterWallet = account.wallet - price;
      if (price > 0) {
        await connection.execute(
          "UPDATE accounts SET wallet = ? WHERE user_id = ?",
          [afterWallet, userId],
        );
      }
      await connection.execute(
        `INSERT INTO vcs (channel_id, owner_id, guest_id, type, is_ticket, is_bonus, expire_at)
         VALUES (?, ?, NULL, ?, FALSE, FALSE, ?)`,
        [voiceChannelId, userId, SOLITARY_CELL.TYPE, expireAt],
      );

      const [botRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ?",
        [BOT_ID],
      );
      const botWallet = botRows[0]?.wallet ?? 0;
      await connection.execute<ResultSetHeader>(
        `INSERT INTO actions
         (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          toActionType(PANEL_COMMAND_NAMES.SOLITARY_CELL_CREATE),
          price,
          userId,
          BOT_ID,
          afterWallet,
          botWallet,
          `独房作成: ${SOLITARY_CELL.DURATION_HOURS}時間`,
        ],
      );
      await connection.commit();
      return afterWallet;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private static async sendLog(
    interaction: ButtonInteraction,
    tier: SolitaryCellTier,
    voiceChannelId: string,
    afterWallet: number,
  ) {
    try {
      const channel = await interaction.client.channels.fetch(
        TEXT_CHANNEL_IDS.SOLITARY_CELL_LOG,
      );
      if (!channel || !channel.isTextBased()) {
        throw new Error("独房ログチャンネルが見つからないか、テキストチャンネルではありません。");
      }
      await (channel as any).send(
        `**独房作成**\n<@${interaction.user.id}>\n` +
          `対象ロール: ${tier.label}\n` +
          `料金: ${tier.price === 0 ? "無料" : `${formatNumber(tier.price)}${CURRENCY_NAMES}`}\n` +
          `残高: ${formatNumber(afterWallet)}${CURRENCY_NAMES}\n` +
          `作成VC: <#${voiceChannelId}>\n` +
          `利用時間: ${SOLITARY_CELL.DURATION_HOURS}時間`,
      );
    } catch (error) {
      console.error("独房ログの送信に失敗しました:", error);
    }
  }
}
