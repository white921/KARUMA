import {
  Client,
  GatewayIntentBits,
  MessageFlags,
  VoiceState,
  ChannelType,
  GuildMember,
  PartialGuildMember,
} from "discord.js";

import { registerCommands } from "./registerCommands";

import { exeCommand } from "./util/exeCommand";
import { sendEphemeralMessage } from "./util/channelMessage";
import { validateSelectUserMenu } from "./util/select";
import { getVcMembersCount } from "./util/vc";

import { handleUserSelectMenu } from "./handler/userSelectHandler";
import { handleStringSelectMenu } from "./handler/stringSelectHandler";
import { handleModalSubmit } from "./handler/modalHandler";
import { handlePanelButton } from "./handler/panelButtonHandler";
import { handleSchedule } from "./handler/scheduleHandler";
import { handleRoleChange } from "./handler/roleHandler";

import { PanelService } from "./service/panelService";
import { DiaryPanelService } from "./service/diaryPanelService";
import { AdminPanelService } from "./service/adminPanelService";
import { HotelVcPanelService } from "./service/hotelPanelService";
import { HotelVcService } from "./service/hotelVcService";
import { CasinoPanelService } from "./service/casinoPanel";
import { TeleportVcService } from "./service/teleportVcService";
import { GamePanelService } from "./service/gamePanelService";
import { AccountService } from "./service/accountService";
import { VcService } from "./service/vcService";
import { DiaryService } from "./service/diaryService";
import { ShopPanelService } from "./service/shopPanelService";
import { RedeployPanelService } from "./service/redeployPanelService";

import { COMMAND_NAMES, PANEL_COMMAND_NAMES } from "./constant/command";
import {
  CATEGORY_IDS,
  FORUM_IDS,
  TEST_CATEGORY_IDS,
  TEST_FORUM_IDS,
  VC_IDS,
} from "./constant/id";

// テスト用
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// bot起動時
client.once("clientReady", async () => {
  try {
    await registerCommands();
    await PanelService.createPanel(client);
    await DiaryPanelService.createDiaryPanel(client);
    await AdminPanelService.createAdminPanel(client);
    await CasinoPanelService.createCasinoPanel(client);
    await GamePanelService.createGamePanel(client);
    await ShopPanelService.createShopPanel(client);
    await handleSchedule(client);
    await HotelVcPanelService.createNormalHotelVcPanel(client);
    await HotelVcPanelService.createSpecialHotelVcPanel(client);
    await RedeployPanelService.createRedeployPanel(client);
    await HotelVcService.startExpiredVcChecker(client); // 期限切れVCの自動削除チェックを開始
    // await RemindToMadoromiService.startRemindToMadoromi(client);
  } catch (error) {
    console.error(error);
  }
});

// コマンドの実行権限をチェックするための配列
const DEFAULT_PUBLIC_COMMAND = [
  COMMAND_NAMES.RETURN_MEMBER,
  COMMAND_NAMES.INTERVIEW_PASS,
  COMMAND_NAMES.EVALUATION_SHEET,
  COMMAND_NAMES.SEND,
  COMMAND_NAMES.VIEW,
  COMMAND_NAMES.LINK_ACCOUNT,
  COMMAND_NAMES.RANKING,
  COMMAND_NAMES.OPEN_ACCOUNT,
  COMMAND_NAMES.CHANGE_NAME,
  COMMAND_NAMES.CHECK_NAME,
];

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const cmd = interaction.commandName;

    // 3秒以内に応答しないとタイムアウトするため、最初に応答を遅延させる
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // コマンド実行できるかvalidationかける
      // 凍結とかアカウント存在確認とか

      // コマンドの実行
      await exeCommand(interaction, cmd);
    } catch (error: any) {
      console.error(error);
      if (interaction.deferred) {
        if (DEFAULT_PUBLIC_COMMAND.includes(cmd)) {
          await sendEphemeralMessage(interaction, error.message);
        } else {
          await interaction.editReply({
            content: error.message,
          });
        }
      }
    }
  } else if (interaction.isButton()) {
    try {
      // モーダルを表示するボタンの場合はdeferReplyをスキップ
      if (
        interaction.customId !== PANEL_COMMAND_NAMES.SHOP_SEND &&
        interaction.customId !== PANEL_COMMAND_NAMES.CHANGE_VC_NAME &&
        interaction.customId !== PANEL_COMMAND_NAMES.DIARY_PRIVATE &&
        interaction.customId !== PANEL_COMMAND_NAMES.DIARY_PUBLIC &&
        interaction.customId !== PANEL_COMMAND_NAMES.DIARY_UPDATE &&
        interaction.customId !== PANEL_COMMAND_NAMES.REDEPLOY
      ) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }
      await handlePanelButton(interaction);
    } catch (error: any) {
      console.error(error);
      if (interaction.deferred) {
        await interaction.editReply({
          content: error.message,
        });
      } else {
        await interaction.reply({
          content: error.message,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } else if (interaction.isUserSelectMenu()) {
    try {
      await validateSelectUserMenu(interaction);
      await handleUserSelectMenu(interaction);
    } catch (error: any) {
      console.error(error);
      if (interaction.deferred) {
        await interaction.editReply({
          content: error.message,
        });
      } else {
        await interaction.reply({
          content: error.message,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } else if (interaction.isStringSelectMenu()) {
    try {
      await handleStringSelectMenu(interaction);
    } catch (error: any) {
      console.error(error);
      if (interaction.deferred) {
        await interaction.editReply({
          content: error.message,
        });
      } else {
        await interaction.reply({
          content: error.message,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } else if (interaction.isModalSubmit()) {
    try {
      await handleModalSubmit(interaction);
    } catch (error: any) {
      console.error(error);
      if (interaction.deferred) {
        await interaction.editReply({
          content: error.message,
        });
      } else {
        await interaction.reply({
          content: error.message,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  }
});

client.on("messageCreate", async (message) => {
  try {
    if (!message.inGuild() || !message.channel.isThread()) {
      return;
    }

    const diaryForumIds = [FORUM_IDS.DIARY, TEST_FORUM_IDS.DIARY];
    if (!diaryForumIds.includes(message.channel.parentId ?? "")) {
      return;
    }

    await DiaryService.handleDiaryMessage(message);
  } catch (error) {
    console.error(error);
  }
});

client.on(
  "guildMemberRemove",
  async (member: GuildMember | PartialGuildMember) => {
    if (member.user.bot) {
      return;
    }

    try {
      if (!(await AccountService.hasAccount(member.id))) {
        return;
      }

      await AccountService.handleMemberLeft(member);
    } catch (error) {
      console.error(error);
    }
  },
);

// VCの状態変更を監視
client.on(
  "voiceStateUpdate",
  async (oldState: VoiceState, newState: VoiceState) => {
    try {
      const oldChannel = oldState.channel;
      const newChannel = newState.channel;
      const monitoredHotelCategoryIds = [CATEGORY_IDS.HOTEL, CATEGORY_IDS.SPECIAL_HOTEL];
      const isInMonitoredHotelCategory = (
        channel: typeof oldChannel | typeof newChannel,
      ) =>
        !!channel &&
        channel.type === ChannelType.GuildVoice &&
        channel.parentId !== null &&
        monitoredHotelCategoryIds.includes(channel.parentId);

      // ミュート変更などは無視
      if (oldChannel?.id === newChannel?.id) {
        return;
      }

      // ホテルVC内のbot出入り時だけ人数制限を自動調整する
      if (newState.member?.user.bot || oldState.member?.user.bot) {
        if (
          oldChannel &&
          oldChannel.type === ChannelType.GuildVoice &&
          isInMonitoredHotelCategory(oldChannel)
        ) {
          await VcService.adjustVcLimitByDelta(oldChannel, -1);
        }

        if (
          newChannel &&
          newChannel.type === ChannelType.GuildVoice &&
          isInMonitoredHotelCategory(newChannel)
        ) {
          await VcService.adjustVcLimitByDelta(newChannel, 1);
        }
        return;
      }

      const oldInHotel = oldChannel?.parentId === CATEGORY_IDS.HOTEL;
      const newInHotel = newChannel?.parentId === CATEGORY_IDS.HOTEL;
      const oldInTeleportVc = oldChannel?.parentId === CATEGORY_IDS.GAME;
      const newInTeleportVc = newChannel?.parentId === CATEGORY_IDS.GAME;

      // ホテルカテゴリーの処理
      if (oldInHotel || newInHotel) {
        if (oldChannel && oldChannel.type === ChannelType.GuildVoice) {
          const membersCount = getVcMembersCount(oldChannel);

          if (membersCount === 0) {
            await HotelVcService.setLastEmptyAtForBonusVc(oldChannel.id);
          }
        }

        if (newChannel && newChannel.type === ChannelType.GuildVoice) {
          const membersCount = getVcMembersCount(newChannel);
          if (membersCount > 0) {
            await HotelVcService.resetLastEmptyAtForBonusVc(newChannel.id);
          }
        }
      }

      // 転送用VCカテゴリーの処理
      if (oldInTeleportVc || newInTeleportVc) {
        if (
          newChannel &&
          newChannel.type === ChannelType.GuildVoice &&
          newChannel.id === VC_IDS.TELEPORT &&
          newState.member
        ) {
          await TeleportVcService.createTeleportVc(newState.member);
        }

        if (
          oldChannel &&
          oldChannel.type === ChannelType.GuildVoice &&
          oldChannel.id !== VC_IDS.TELEPORT
        ) {
          await TeleportVcService.deleteEmptyTeleportVc(oldChannel);
        }
        return;
      }
    } catch (error: any) {
      console.error("voiceStateUpdateエラー:", error.message);
    }
  },
);

client.on(
  "guildMemberUpdate",
  async (
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
  ) => {
    try {
      await handleRoleChange(client, oldMember, newMember);
    } catch (error: any) {
      console.error("guildMemberUpdateエラー:", error.message);
    }
  },
);

client.login(process.env.DISCORD_TOKEN);
