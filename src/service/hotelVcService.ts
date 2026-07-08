import {
  ButtonInteraction,
  UserSelectMenuInteraction,
  ChannelType,
  GuildMember,
  PermissionsBitField,
  Client,
  Channel,
  VoiceChannel,
  StringSelectMenuInteraction,
  OverwriteType,
} from "discord.js";

import { Account } from "../type/account";

import { hasRole } from "../util/role";
import { formatNumber } from "../util/number";
import { updateVcStatus } from "../util/vc";

import { AccountService } from "./accountService";
import { ActionService } from "./actionService";
import { DbService } from "./dbService";
import { VcPanelService } from "./vcPanelService";

import {
  HOTEL_PRICE,
  HOTEL_TYPE_NAMES,
  HOTEL_MESSAGES,
  HOTEL_PURCHASE_WAY_TYPE,
} from "../constant/hotel";
import { VC_ALL_TYPES } from "../constant/vc";
import { HOTEL_TYPE } from "../constant/hotel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { CURRENCY_NAMES } from "../constant/currency";
import { BOT_ID, ROLE_IDS } from "../constant/id";
import { normalizePollingIntervalMs } from "../util/runtimeConfig";

export class HotelVcService {
  private static expiredVcCheckerStarted = false;
  private static expiredVcCheckerRunning = false;

  private static async sendHotelVcMessage(
    voiceChannel: VoiceChannel,
    message:
      | string
      | {
          embeds: any[];
          components: any[];
        },
    errorLabel: string,
  ) {
    try {
      await voiceChannel.send(message as any);
    } catch (error) {
      console.error(`ホテルVCへの${errorLabel}送信に失敗しました:`, error);
    }
  }

  /**
   * ホテルVCの利用時間を取得
   * @param hotelType ホテルVCタイプ
   * @returns 利用時間（時間）
   */
  static getHotelVcDurationHours(hotelType: string): number {
    switch (hotelType) {
      case HOTEL_TYPE.NORMAL:
      case HOTEL_TYPE.SECRET:
      case HOTEL_TYPE.FREEDOM:
        return 12;
      case HOTEL_TYPE.SECRETLONG:
      case HOTEL_TYPE.FREEDOMLONG:
        return 24;
      default:
        throw new Error(HOTEL_MESSAGES.UNDEFINED_TYPE_OF_HOTEL);
    }
  }

  /**
   * ホテルチケットのバリデーション
   */
  static async validateTicket(
    interaction: StringSelectMenuInteraction | UserSelectMenuInteraction,
  ) {
    try {
      throw new Error(HOTEL_MESSAGES.HAS_NOT_TICKET);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * ホテルVCタイプ名を取得
   * @param commandId コマンドID
   * @returns ホテルVCタイプ名
   */
  static getHotelVcTypeName(commandId: string): string {
    switch (commandId) {
      case PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL:
        return HOTEL_TYPE_NAMES.NORMAL;
      case PANEL_COMMAND_NAMES.HOTEL_VC_SECRET:
        return HOTEL_TYPE_NAMES.SECRET;
      case PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG:
        return HOTEL_TYPE_NAMES.SECRETLONG;
      case PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM:
        return HOTEL_TYPE_NAMES.FREEDOM;
      case PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOMLONG:
        return HOTEL_TYPE_NAMES.FREEDOMLONG;
      default:
        throw new Error(HOTEL_MESSAGES.UNDEFINED_TYPE_OF_HOTEL);
    }
  }

  /**
   * VCタイプ名を取得
   * @param commandId コマンドID (NORMAL, SECRET, SECRET-LONG, FREEDOM, FREEDOM-LONG)
   * @returns VCタイプ名
   */
  static getVcType(commandId: string): string {
    return VC_ALL_TYPES[commandId as keyof typeof HOTEL_TYPE];
  }

  /**
   * ホテル表示名から内部タイプを取得
   * @param hotelVcTypeName ホテルVC表示名
   * @returns ホテルVC内部タイプ
   */
  static getHotelTypeFromName(hotelVcTypeName: string): string {
    switch (hotelVcTypeName) {
      case HOTEL_TYPE_NAMES.NORMAL:
        return HOTEL_TYPE.NORMAL;
      case HOTEL_TYPE_NAMES.SECRET:
        return HOTEL_TYPE.SECRET;
      case HOTEL_TYPE_NAMES.SECRETLONG:
        return HOTEL_TYPE.SECRETLONG;
      case HOTEL_TYPE_NAMES.FREEDOM:
        return HOTEL_TYPE.FREEDOM;
      case HOTEL_TYPE_NAMES.FREEDOMLONG:
        return HOTEL_TYPE.FREEDOMLONG;
      default:
        throw new Error(HOTEL_MESSAGES.UNDEFINED_TYPE_OF_HOTEL);
    }
  }

  /**
   * ホテルVC価格を取得 (宵闇は半額)
   * @param commandId コマンドID (NORMAL, SECRET, FREEDOM)
   * @param member メンバー
   * @returns ホテルVC価格
   */
  static async getHotelVcPrice(
    commandId: string,
    member: GuildMember,
  ): Promise<number> {
    switch (commandId) {
      case HOTEL_TYPE.NORMAL:
        return HOTEL_PRICE.NORMAL;
      // (await hasRole(member, ROLE_IDS.YOIYAMI_NO_AKASHI)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_TOHKATSU)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_TOHKATSU_HOSA)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_STAFF))
      //   ? HOTEL_PRICE.NORMAL / 2
      //   : HOTEL_PRICE.NORMAL;
      case HOTEL_TYPE.SECRET:
        return HOTEL_PRICE.SECRET;
      // (await hasRole(member, ROLE_IDS.YOIYAMI_NO_AKASHI)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_TOHKATSU)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_TOHKATSU_HOSA)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_STAFF))
      //   ? HOTEL_PRICE.SECRET / 2
      //   : HOTEL_PRICE.SECRET;
      case HOTEL_TYPE.SECRETLONG:
        return HOTEL_PRICE.SECRETLONG;
      // (await hasRole(member, ROLE_IDS.YOIYAMI_NO_AKASHI)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_TOHKATSU)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_TOHKATSU_HOSA)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_STAFF))
      //   ? HOTEL_PRICE.SECRETLONG / 2
      //   : HOTEL_PRICE.SECRETLONG;
      case HOTEL_TYPE.FREEDOM:
        return HOTEL_PRICE.FREEDOM;
      // (await hasRole(member, ROLE_IDS.YOIYAMI_NO_AKASHI)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_TOHKATSU)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_TOHKATSU_HOSA)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_STAFF))
      //   ? HOTEL_PRICE.FREEDOM / 2
      //   : HOTEL_PRICE.FREEDOM;
      case HOTEL_TYPE.FREEDOMLONG:
        return HOTEL_PRICE.FREEDOMLONG;
      // (await hasRole(member, ROLE_IDS.YOIYAMI_NO_AKASHI)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_TOHKATSU)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_TOHKATSU_HOSA)) ||
      //   (await hasRole(member, ROLE_IDS.YUMEHAKO_STAFF))
      //   ? HOTEL_PRICE.FREEDOMLONG / 2
      //   : HOTEL_PRICE.FREEDOMLONG;
      default:
        throw new Error(HOTEL_MESSAGES.UNDEFINED_TYPE_OF_HOTEL);
    }
  }

  /**
   * 残高バリデーション
   * @param userAccount ユーザーアカウント
   * @param price 価格
   */
  static async validateWallet(
    userAccount: Account,
    price: number,
  ): Promise<void> {
    if (userAccount.wallet < price) {
      throw new Error(
        `残高が不足しています。\n現在の残高: ${formatNumber(userAccount.wallet)}${CURRENCY_NAMES}\n必要な残高: ${formatNumber(price)}${CURRENCY_NAMES}`,
      );
    }
  }

  static async isNormalHotelBonusMember(member: GuildMember): Promise<boolean> {
    return (
      (await hasRole(member, ROLE_IDS.CORE_MEMBER_ROLES.HONMEN)) ||
      (await hasRole(member, ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN)) ||
      (await hasRole(member, ROLE_IDS.KANRISYA)) ||
      (await hasRole(member, ROLE_IDS.SABANUSI))
    );
  }

  /**
   * ホテルVCを作成
   * @param interaction ボタンインタラクション
   * @param hotelVcTypeName ホテルVCタイプ名 ("夢灯", "夢秘境", "宙夢")
   * @param isBonus 特典(ロール)を利用して作成したかどうか
   * @param selectedUserId? 選択されたユーザーID（シークレットホテル用）
   */
  static async createHotelVc(
    interaction: ButtonInteraction | UserSelectMenuInteraction,
    hotelVcTypeName: string,
    isBonus: boolean,
    selectedUserId?: string,
  ) {
    try {
      const guild = interaction.guild;
      const member = interaction.member as GuildMember;

      const subUserId = await AccountService.getSubUserIdByMainUserId(member.id);
      const subMember = subUserId ? await interaction.guild?.members.fetch(subUserId) : null;

      const selectedSubUserId = selectedUserId ? await AccountService.getSubUserIdByMainUserId(selectedUserId) : null;
      const selectedSubMember = selectedSubUserId ? await interaction.guild?.members.fetch(selectedSubUserId) : null;
      let channelName, voiceChannel;

      //パネルが所属しているカテゴリー内にVCを作成(parentIdはカテゴリーID)
      const parentId =
        interaction.channel && "parentId" in interaction.channel
          ? interaction.channel.parentId
          : undefined;

      // カテゴリーの権限を取得（ノーマルとフリーダムで使用）
      const categoryChannel =
        parentId && guild ? await guild.channels.fetch(parentId) : null;
      const categoryPermissions =
        categoryChannel && "permissionOverwrites" in categoryChannel
          ? categoryChannel.permissionOverwrites.cache
          : null;

      // 期限切れ時間を取得
      const hotelVcType = this.getHotelTypeFromName(hotelVcTypeName);
      const durationHours = this.getHotelVcDurationHours(hotelVcType);
      const expireDateTime = new Date(Date.now() + durationHours * 60 * 60 * 1000);
      const jstExpireDateTime = expireDateTime.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
      });

      const inChatPanel = await VcPanelService.createVcPanel(true, true);

      switch (hotelVcTypeName) {
        case HOTEL_TYPE_NAMES.NORMAL:
          channelName = `通常 - ${member.displayName}`;

          // カテゴリーの権限を取得
          const normalPermissionOverwrites: any[] = [];
          if (categoryPermissions) {
            categoryPermissions.forEach((overwrite) => {
              normalPermissionOverwrites.push({
                id: overwrite.id,
                type: overwrite.type,
                allow: overwrite.allow,
                deny: overwrite.deny,
              });
            });
          }

          // 作成者にチャンネル管理権限を追加
          normalPermissionOverwrites.push({
            id: interaction.user.id,
            type: OverwriteType.Member,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.UseVAD,
              PermissionsBitField.Flags.Stream,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.AddReactions,
              PermissionsBitField.Flags.SendVoiceMessages,
              PermissionsBitField.Flags.UseEmbeddedActivities,
            ],
            deny: [
              PermissionsBitField.Flags.UseExternalEmojis,
              PermissionsBitField.Flags.UseExternalStickers,
              PermissionsBitField.Flags.UseExternalSounds,
            ],
          });

          voiceChannel = await guild?.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: parentId,
            permissionOverwrites: normalPermissionOverwrites,
            userLimit: 2,
          });
          // 有料VCの場合はインチャに期限時刻を送信 & パネル設置
          if (!isBonus && voiceChannel) {
            await this.sendHotelVcMessage(
              voiceChannel,
              `期限時刻: ${jstExpireDateTime}`,
              "期限時刻",
            );
          }
          if (inChatPanel) {
            await this.sendHotelVcMessage(
              voiceChannel!,
              {
                embeds: [inChatPanel.embeds[0]],
                components: [inChatPanel.components[0]],
              },
              "パネル",
            );
          }
          break;
        case HOTEL_TYPE_NAMES.SECRET:
        case HOTEL_TYPE_NAMES.SECRETLONG:
          if (!selectedUserId) {
            throw new Error(HOTEL_MESSAGES.NO_USER_SELECTED);
          }

          // ユーザーIDから選択されたユーザー情報を取得
          const selectedMember = await guild?.members.fetch(selectedUserId);
          channelName = `VIP - ${member.displayName} & ${selectedMember?.displayName}`;

          // カテゴリーの権限を取得
          const secretPermissionOverwrites: any[] = [];
          if (categoryPermissions) {
            categoryPermissions.forEach((overwrite) => {
              secretPermissionOverwrites.push({
                id: overwrite.id,
                type: overwrite.type,
                allow: overwrite.allow,
                deny: overwrite.deny,
              });
            });
          }

          secretPermissionOverwrites.push({
            id: interaction.user.id,
            type: OverwriteType.Member,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.UseVAD,
              PermissionsBitField.Flags.Stream,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.AddReactions,
              PermissionsBitField.Flags.SendVoiceMessages,
              PermissionsBitField.Flags.UseEmbeddedActivities,
            ],
            deny: [
              PermissionsBitField.Flags.UseExternalEmojis,
              PermissionsBitField.Flags.UseExternalStickers,
              PermissionsBitField.Flags.UseExternalSounds,
            ],
          });

          if (subMember) {
            secretPermissionOverwrites.push({
              id: subMember.id,
              type: OverwriteType.Member,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.UseVAD,
                PermissionsBitField.Flags.Stream,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.AttachFiles,
                PermissionsBitField.Flags.AddReactions,
                PermissionsBitField.Flags.SendVoiceMessages,
                PermissionsBitField.Flags.UseEmbeddedActivities,
              ],
              deny: [
                PermissionsBitField.Flags.UseExternalEmojis,
                PermissionsBitField.Flags.UseExternalStickers,
                PermissionsBitField.Flags.UseExternalSounds,
              ],
            });
          }

          secretPermissionOverwrites.push({
            id: selectedUserId,
            type: OverwriteType.Member,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.UseVAD,
              PermissionsBitField.Flags.Stream,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.AddReactions,
              PermissionsBitField.Flags.SendVoiceMessages,
              PermissionsBitField.Flags.UseEmbeddedActivities,
            ],
            deny: [
              PermissionsBitField.Flags.UseExternalEmojis,
              PermissionsBitField.Flags.UseExternalStickers,
              PermissionsBitField.Flags.UseExternalSounds,
            ],
          });

          if (selectedSubMember) {
            secretPermissionOverwrites.push({
              id: selectedSubMember.id,
              type: OverwriteType.Member,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.UseVAD,
                PermissionsBitField.Flags.Stream,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.AttachFiles,
                PermissionsBitField.Flags.AddReactions,
                PermissionsBitField.Flags.SendVoiceMessages,
                PermissionsBitField.Flags.UseEmbeddedActivities,
              ],
              deny: [
                PermissionsBitField.Flags.UseExternalEmojis,
                PermissionsBitField.Flags.UseExternalStickers,
                PermissionsBitField.Flags.UseExternalSounds,
              ],
            });
          }

          secretPermissionOverwrites.push(
            {
              id: ROLE_IDS.CORE_MEMBER_ROLES.HONMEN,
              type: OverwriteType.Role,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN,
              type: OverwriteType.Role,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN,
              type: OverwriteType.Role,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: ROLE_IDS.CORE_MEMBER_ROLES.HANTEIZUMI,
              type: OverwriteType.Role,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: ROLE_IDS.CORE_MEMBER_ROLES.MENSETUMATI,
              type: OverwriteType.Role,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
          );

          voiceChannel = await guild?.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: parentId,
            permissionOverwrites: secretPermissionOverwrites,
            userLimit: 2,
          });
          // 選択されたユーザーをインチャでメンション
          await this.sendHotelVcMessage(
            voiceChannel!,
            `<@${selectedUserId}>`,
            "メンション",
          );
          if (!isBonus && voiceChannel) {
            await this.sendHotelVcMessage(
              voiceChannel,
              `期限時刻: ${jstExpireDateTime}`,
              "期限時刻",
            );
          }
          if (inChatPanel) {
            await this.sendHotelVcMessage(
              voiceChannel!,
              {
                embeds: [inChatPanel.embeds[0]],
                components: [inChatPanel.components[0]],
              },
              "パネル",
            );
          }
          break;
        case HOTEL_TYPE_NAMES.FREEDOM:
        case HOTEL_TYPE_NAMES.FREEDOMLONG:
          channelName = `フリーダム - ${member.displayName}`;

          // カテゴリーの権限を取得
          const freedomPermissionOverwrites: any[] = [];
          if (categoryPermissions) {
            categoryPermissions.forEach((overwrite) => {
              freedomPermissionOverwrites.push({
                id: overwrite.id,
                type: overwrite.type,
                allow: overwrite.allow,
                deny: overwrite.deny,
              });
            });
          }

          freedomPermissionOverwrites.push(
            {
              id: ROLE_IDS.CORE_MEMBER_ROLES.HONMEN,
              type: OverwriteType.Role,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN,
              type: OverwriteType.Role,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN,
              type: OverwriteType.Role,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: ROLE_IDS.CORE_MEMBER_ROLES.HANTEIZUMI,
              type: OverwriteType.Role,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: ROLE_IDS.CORE_MEMBER_ROLES.MENSETUMATI,
              type: OverwriteType.Role,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
          );

          // 作成者に管理者権限を追加（既存の権限設定を上書き）
          freedomPermissionOverwrites.push({
            id: interaction.user.id,
            type: OverwriteType.Member,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.UseVAD,
              PermissionsBitField.Flags.Stream,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.ManageRoles,
            ],
          });
          if (subMember) {
            freedomPermissionOverwrites.push({
              id: subMember.id,
              type: OverwriteType.Member,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.UseVAD,
                PermissionsBitField.Flags.Stream,
                PermissionsBitField.Flags.ManageChannels,
                PermissionsBitField.Flags.ManageRoles,
              ],
            });
          }

          voiceChannel = await guild?.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: parentId,
            permissionOverwrites: freedomPermissionOverwrites,
          });
          if (!isBonus && voiceChannel) {
            await this.sendHotelVcMessage(
              voiceChannel,
              `期限時刻: ${jstExpireDateTime}`,
              "期限時刻",
            );
          }
          await this.sendHotelVcMessage(
            voiceChannel!,
            `ご利用の際は権限をご自由に変更いただけます。\n人数制限とVC名はパネルとチャンネル管理画面のどちらでも変更可能です。\n※チャンネル編集の際には「everyone」の権限を触らないでください。\n終了時間になりましたらチャンネルが削除されます。\n`,
            "案内文",
          );
          if (inChatPanel) {
            await this.sendHotelVcMessage(
              voiceChannel!,
              {
                embeds: [inChatPanel.embeds[0]],
                components: [inChatPanel.components[0]],
              },
              "パネル",
            );
          }
          break;
        default:
          throw new Error(HOTEL_MESSAGES.UNDEFINED_TYPE_OF_HOTEL);
      }

      // 成功メッセージ
      if (interaction.deferred) {
        await interaction.editReply({
          content: `✅ **${hotelVcTypeName}**を作成しました！\n<#${voiceChannel?.id}>`,
        });
      } else {
        await interaction.reply({
          content: `✅ **${hotelVcTypeName}**を作成しました！\n<#${voiceChannel?.id}>`,
        });
      }
      return voiceChannel!.id;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * ホテルVCを作成する際のRoyal消費処理
   * @param interaction ボタンインタラクション
   * @param commandId コマンドID (hotelVcNormal, hotelVcSecret, hotelVcSecretLong, hotelVcFreedom, hotelVcFreedomLong)
   * @param purchaseWay 支払方法（MONEY | TICKET）
   */
  static async hotelVcPaymentByRoyal(
    interaction: ButtonInteraction | UserSelectMenuInteraction,
    commandId: string,
    hotelVcTypeName: string,
  ) {
    try {
      const userId = interaction.user.id;
      const userAccount = (await AccountService.getAccountByUserId(userId))[0];
      const member = await interaction.guild?.members.fetch(userId);

      // ホテルVC価格を取得
      const price = await this.getHotelVcPrice(
        commandId,
        member as GuildMember,
      );

      // 残高バリデーション
      await this.validateWallet(userAccount, price);

      // 通貨を消費
      const afterWallet = userAccount.wallet - price;
      const connection = await DbService.getConnection();
      try {
        await connection.execute(
          `UPDATE accounts SET wallet = ? WHERE user_id = ?;`,
          [afterWallet, userId],
        );
      } finally {
        connection.release();
      }

      // アクションログ記録
      const botAccount = (
        await AccountService.getAccountByUserId(BOT_ID)
      )[0];
      await ActionService.executeActionLog(
        interaction,
        commandId,
        price,
        userId,
        BOT_ID,
        afterWallet,
        botAccount.wallet,
        "",
      );
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * VC情報をデータベースに挿入
   * @param voiceChannelId 作成されたVCチャンネルID
   * @param ownerId 作成者のユーザーID
   * @param hotelVcType ホテルVCタイプ名 (NORMAL, SECRET, FREEDOM)
   * @param isTicket チケットを消費して作成したかどうか
   * @param isBonus 特典(ロール)を利用して作成したかどうか
   * @param guestId ゲストのユーザーID（シークレットホテルの場合のみ）
   */
  static async insertIntoVcs(
    voiceChannelId: string,
    ownerId: string,
    hotelVcType: string,
    isTicket: boolean,
    isBonus: boolean,
    guestId?: string | null,
  ) {
    const connection = await DbService.getConnection();
    try {
      const type = this.getVcType(hotelVcType); // NORMAL, SECRET, SECRETLONG, FREEDOM, FREEDOMLONG

      // expire_at：特典VC（isBonus=true）の場合はNULL、有料VC（isBonus=false）の場合は利用時間に応じて設定
      let expireAt: Date | null = null;
      if (!isBonus) {
        const hotelVcTypeDurationHours = this.getHotelVcDurationHours(type);
        expireAt = new Date(Date.now() + hotelVcTypeDurationHours * 60 * 60 * 1000);
      }
      await connection.execute(
        `INSERT INTO vcs (channel_id, owner_id, guest_id, type, is_ticket, is_bonus, expire_at) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          voiceChannelId,
          ownerId,
          guestId ?? null,
          type,
          isTicket,
          isBonus,
          expireAt,
        ],
      );
    } catch (error: any) {
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * ホテルVCを作成する
   * @param interaction ボタンインタラクション
   * @param commandId コマンドID (NORMAL, SECRET, SECRETLONG, FREEDOM, FREEDOMLONG)
   * @param selectedHotelPurchaseWay ホテル購入方法（Royal, チケット）
   * @param isBonus 特典(ロール)を利用して作成したかどうか
   * @param selectedUserId 選択されたユーザーID（シークレットホテル用）
   */
  static async executeHotelVc(
    interaction: ButtonInteraction | UserSelectMenuInteraction,
    commandId: string,
    selectedHotelPurchaseWay: string,
    isBonus: boolean,
    selectedUserId?: string,
  ) {
    try {
      const hotelVcTypeName = this.getHotelVcTypeName(commandId);
      const isTicket =
        selectedHotelPurchaseWay === HOTEL_PURCHASE_WAY_TYPE.TICKET;

      if (isTicket) {
        // TODO: チケット支払いの実装
      } else {
        await this.hotelVcPaymentByRoyal(
          interaction,
          commandId,
          hotelVcTypeName,
        );
      }
      const voiceChannelId = await this.createHotelVc(
        interaction,
        hotelVcTypeName,
        false,
        selectedUserId,
      );

      // シークレットホテルの場合のみguestIdを設定
      const guestId =
        hotelVcTypeName === HOTEL_TYPE_NAMES.SECRET ||
        hotelVcTypeName === HOTEL_TYPE_NAMES.SECRETLONG
          ? selectedUserId
          : null;

      await this.insertIntoVcs(
        voiceChannelId,
        interaction.user.id,
        commandId,
        isTicket,
        isBonus,
        guestId,
      );
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * 期限切れのVCを削除（有料VCで期限が過ぎたもの）
   * @param client Discordクライアント
   */
  static async deleteExpiredVcs(client: Client) {
    const connection = await DbService.getConnection();
    let rows: any[];
    try {
      // 有料VCで期限が過ぎたものを取得
      [rows] = await connection.execute<any[]>(
        `SELECT channel_id FROM vcs 
           WHERE is_active = TRUE 
           AND expire_at IS NOT NULL 
           AND expire_at <= NOW()`,
      );
    } finally {
      connection.release();
    }

    if (!rows || rows.length === 0) {
      return;
    }

    for (const row of rows) {
      const channelId = row.channel_id.toString();
      try {
        let channel: Channel | null = null;
        try {
          channel = await client.channels.fetch(channelId);
        } catch {
          await updateVcStatus(channelId, false);
          continue;
        }
        if (channel) {
          await channel.delete();
        }
      } catch (error: any) {
        throw error;
      }

      try {
        await updateVcStatus(channelId, false);
      } catch (error: any) {
        throw error;
      }
    }
  }

  /**
   * 無料VCが空になったときにlast_empty_atを設定
   * @param channelId VCチャンネルID
   */
  static async setLastEmptyAtForBonusVc(channelId: string) {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<any[]>(
        `SELECT is_bonus, last_empty_at FROM vcs 
         WHERE channel_id = ? AND is_active = TRUE`,
        [channelId],
      );

      if (!rows || rows.length === 0) {
        return;
      }

      // 無料VCで、last_empty_atがまだ設定されていない場合のみ設定
      if (rows[0].is_bonus && !rows[0].last_empty_at) {
        const updateConnection = await DbService.getConnection();
        try {
          await updateConnection.execute(
            `UPDATE vcs SET last_empty_at = NOW() WHERE channel_id = ?`,
            [channelId],
          );
        } finally {
          updateConnection.release();
        }
      }
    } catch (error: any) {
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 無料VCに人が入ったときにlast_empty_atをリセット
   * @param channelId VCチャンネルID
   */
  static async resetLastEmptyAtForBonusVc(channelId: string) {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<any[]>(
        `SELECT is_bonus, last_empty_at FROM vcs 
         WHERE channel_id = ? AND is_active = TRUE`,
        [channelId],
      );

      if (!rows || rows.length === 0) {
        return;
      }

      // 無料VCで、last_empty_atが設定されている場合のみリセット
      if (rows[0].is_bonus && rows[0].last_empty_at) {
        const updateConnection = await DbService.getConnection();
        try {
          await updateConnection.execute(
            `UPDATE vcs SET last_empty_at = NULL WHERE channel_id = ?`,
            [channelId],
          );
        } finally {
          updateConnection.release();
        }
      }
    } catch (error: any) {
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 空になった無料VCをチェックして削除（10秒以上空の状態が続いているもの）
   * @param client Discordクライアント
   */
  static async deleteEmptyBonusVcs(client: Client) {
    const connection = await DbService.getConnection();
    try {
      // 全無料VCを取得
      const [rows] = await connection.execute<any[]>(
        `SELECT channel_id, last_empty_at FROM vcs 
         WHERE is_active = TRUE 
         AND is_bonus = TRUE`,
      );

      if (!rows || rows.length === 0) {
        return;
      }

      for (const row of rows) {
        const channelId = row.channel_id.toString();
        try {
          let channel: Channel | null = null;
          try {
            channel = await client.channels.fetch(channelId);
          } catch {
            await updateVcStatus(channelId, false);
            continue;
          }

          if (!channel || channel.type !== ChannelType.GuildVoice) {
            await updateVcStatus(channelId, false);
            continue;
          }

          const voiceChannel = channel as VoiceChannel;
          const members = voiceChannel.members.filter(
            (member) => !member.user.bot,
          );
          const memberCount = members.size;

          if (memberCount === 0) {
            // 空の場合、last_empty_atが10秒以上前かどうかをチェック
            if (row.last_empty_at) {
              const lastEmptyAt = new Date(row.last_empty_at);
              const now = new Date();
              const diffSeconds =
                (now.getTime() - lastEmptyAt.getTime()) / 1000;

              if (diffSeconds >= 10) {
                // 10秒以上空の状態が続いているので削除
                await channel.delete();

                await updateVcStatus(channelId, false);
              }
            }
          }
        } catch (error: any) {
          throw error;
        }
      }
    } catch (error: any) {
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 定期チェックを開始（30秒ごとに実行）
   * @param client Discordクライアント
   */
  static async startExpiredVcChecker(client: Client) {
    try {
      if (this.expiredVcCheckerStarted) {
        return;
      }

      this.expiredVcCheckerStarted = true;
      const intervalMs = normalizePollingIntervalMs(
        process.env.EXPIRED_VC_CHECK_INTERVAL_MS,
        60 * 1000,
      );

      const runCheck = async () => {
        if (this.expiredVcCheckerRunning) {
          return;
        }

        this.expiredVcCheckerRunning = true;

        try {
          await this.deleteExpiredVcs(client);
          await this.deleteEmptyBonusVcs(client);
        } catch (error) {
          console.error("expired VC checker error:", error);
        } finally {
          this.expiredVcCheckerRunning = false;
        }
      };

      await runCheck();

      setInterval(async () => {
        await runCheck();
      }, intervalMs);
    } catch (error: any) {
      throw error;
    }
  }
}
