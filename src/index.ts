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
import {
  isRuntimeFeatureEnabled,
  shouldRegisterCommandsOnBoot,
} from "./util/runtimeConfig";

import { handleUserSelectMenu } from "./handler/userSelectHandler";
import { handleStringSelectMenu } from "./handler/stringSelectHandler";
import { handleModalSubmit } from "./handler/modalHandler";
import { handlePanelButton } from "./handler/panelButtonHandler";
import { handleSchedule } from "./handler/scheduleHandler";
import { handleRoleChange } from "./handler/roleHandler";

import { HotelVcService } from "./service/hotelVcService";
import {
  isTeleportCategory,
  isTeleportTriggerVc,
  TeleportVcService,
} from "./service/teleportVcService";
import { AccountService } from "./service/accountService";
import { VcService } from "./service/vcService";
import { BotHealthMonitor } from "./service/botHealthMonitor";

import { COMMAND_NAMES, PANEL_COMMAND_NAMES } from "./constant/command";
import {
  CATEGORY_IDS,
  TEST_CATEGORY_IDS,
} from "./constant/id";

// テスト用
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    // 日記本文の受信機能を停止中のため、Message Content Intent は要求しない。
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// bot起動時
client.once("clientReady", async () => {
  try {
    BotHealthMonitor.recordGatewayReady("clientReady");
    BotHealthMonitor.startWatchdog();
    if (shouldRegisterCommandsOnBoot(process.env.REGISTER_COMMANDS_ON_BOOT)) {
      await registerCommands();
    }
    if (isRuntimeFeatureEnabled(process.env.ENABLE_SCHEDULES, true)) {
      await handleSchedule(client);
    } else {
      console.log("[Runtime] schedules disabled by ENABLE_SCHEDULES");
    }
    if (isRuntimeFeatureEnabled(process.env.ENABLE_EXPIRED_VC_CHECKER, true)) {
      await HotelVcService.startExpiredVcChecker(client); // 期限切れVCの自動削除チェックを開始
    } else {
      console.log(
        "[Runtime] expired VC checker disabled by ENABLE_EXPIRED_VC_CHECKER",
      );
    }
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
  const interactionContext = interaction.isChatInputCommand()
    ? `command:${interaction.commandName}:${interaction.id}`
    : interaction.isButton()
      ? `button:${interaction.customId}:${interaction.id}`
    : interaction.isUserSelectMenu()
        ? `user-select:${interaction.customId}:${interaction.id}`
      : interaction.isStringSelectMenu()
          ? `string-select:${interaction.customId}:${interaction.id}`
        : interaction.isModalSubmit()
            ? `modal:${interaction.customId}:${interaction.id}`
            : null;

  if (!interactionContext) {
    return;
  }

  BotHealthMonitor.recordInteractionReceived(interactionContext);

  try {
  if (interaction.isChatInputCommand()) {
    const cmd = interaction.commandName;

    // 3秒以内に応答しないとタイムアウトするため、最初に応答を遅延させる
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      BotHealthMonitor.recordAckSuccess(`${interactionContext}:deferReply`);
    } catch (error) {
      BotHealthMonitor.recordAckFailure(`${interactionContext}:deferReply`, error);
      return;
    }

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
        try {
          if (interaction.customId.startsWith("history_page_")) {
            // ページ送りは、現在表示中の取引履歴メッセージを更新する。
            await interaction.deferUpdate();
            BotHealthMonitor.recordAckSuccess(
              `${interactionContext}:deferUpdate`,
            );
          } else {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            BotHealthMonitor.recordAckSuccess(
              `${interactionContext}:deferReply`,
            );
          }
        } catch (error) {
          const acknowledgement = interaction.customId.startsWith("history_page_")
            ? "deferUpdate"
            : "deferReply";
          BotHealthMonitor.recordAckFailure(
            `${interactionContext}:${acknowledgement}`,
            error,
          );
          return;
        }
      }
      await handlePanelButton(interaction);
      if (!interaction.deferred) {
        BotHealthMonitor.recordAckSuccess(`${interactionContext}:handler`);
      }
    } catch (error: any) {
      console.error(error);
      if (interaction.deferred) {
        await interaction.editReply({
          content: error.message,
        });
      } else {
        try {
          await interaction.reply({
            content: error.message,
            flags: MessageFlags.Ephemeral,
          });
          BotHealthMonitor.recordAckSuccess(`${interactionContext}:errorReply`);
        } catch (replyError) {
          BotHealthMonitor.recordAckFailure(
            `${interactionContext}:errorReply`,
            replyError,
          );
        }
      }
    }
  } else if (interaction.isUserSelectMenu()) {
    try {
      await validateSelectUserMenu(interaction);
      await handleUserSelectMenu(interaction);
      BotHealthMonitor.recordAckSuccess(`${interactionContext}:handler`);
    } catch (error: any) {
      console.error(error);
      if (interaction.deferred) {
        await interaction.editReply({
          content: error.message,
        });
      } else {
        try {
          await interaction.reply({
            content: error.message,
            flags: MessageFlags.Ephemeral,
          });
          BotHealthMonitor.recordAckSuccess(`${interactionContext}:errorReply`);
        } catch (replyError) {
          BotHealthMonitor.recordAckFailure(
            `${interactionContext}:errorReply`,
            replyError,
          );
        }
      }
    }
  } else if (interaction.isStringSelectMenu()) {
    try {
      await handleStringSelectMenu(interaction);
      BotHealthMonitor.recordAckSuccess(`${interactionContext}:handler`);
    } catch (error: any) {
      console.error(error);
      if (interaction.deferred) {
        await interaction.editReply({
          content: error.message,
        });
      } else {
        try {
          await interaction.reply({
            content: error.message,
            flags: MessageFlags.Ephemeral,
          });
          BotHealthMonitor.recordAckSuccess(`${interactionContext}:errorReply`);
        } catch (replyError) {
          BotHealthMonitor.recordAckFailure(
            `${interactionContext}:errorReply`,
            replyError,
          );
        }
      }
    }
  } else if (interaction.isModalSubmit()) {
    try {
      await handleModalSubmit(interaction);
      BotHealthMonitor.recordAckSuccess(`${interactionContext}:handler`);
    } catch (error: any) {
      console.error(error);
      if (interaction.deferred) {
        await interaction.editReply({
          content: error.message,
        });
      } else {
        try {
          await interaction.reply({
            content: error.message,
            flags: MessageFlags.Ephemeral,
          });
          BotHealthMonitor.recordAckSuccess(`${interactionContext}:errorReply`);
        } catch (replyError) {
          BotHealthMonitor.recordAckFailure(
            `${interactionContext}:errorReply`,
            replyError,
          );
        }
      }
    }
  }
  } finally {
    BotHealthMonitor.recordInteractionCompleted(interactionContext);
  }
});

client.on("shardDisconnect", (event, shardId) => {
  BotHealthMonitor.recordGatewayDisconnect(`shard:${shardId}`, event);
});

client.on("shardReconnecting", (shardId) => {
  BotHealthMonitor.recordGatewayReconnect(`shard:${shardId}`);
});

client.on("shardResume", (shardId, replayedEvents) => {
  BotHealthMonitor.recordGatewayResume(
    `shard:${shardId}:replayed:${replayedEvents}`,
  );
});

client.on("error", (error) => {
  console.error("discord client error:", error);
});

// 日記機能を停止中のため、日記フォーラムのメッセージ本文は受信・保存しない。
// client.on("messageCreate", async (message) => {
//   if (!message.inGuild() || !message.channel.isThread()) return;
//   const diaryForumIds = [FORUM_IDS.DIARY, TEST_FORUM_IDS.DIARY];
//   if (!diaryForumIds.includes(message.channel.parentId ?? "")) return;
//   await DiaryService.handleDiaryMessage(message);
// });

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
      const oldInTeleportVc = isTeleportCategory(oldChannel?.parentId ?? null);
      const newInTeleportVc = isTeleportCategory(newChannel?.parentId ?? null);

      // ホテルカテゴリーの処理
      if (oldInHotel || newInHotel) {
        if (oldChannel && oldChannel.type === ChannelType.GuildVoice) {
          const membersCount = getVcMembersCount(oldChannel);

          if (membersCount === 0) {
            const deleted = await HotelVcService.deleteEmptyBonusVcNow(oldChannel);
            if (!deleted) {
              await HotelVcService.disconnectBotsFromEmptyPaidHotelVc(oldChannel);
            }
          }
        }
      }

      // 転送用VCカテゴリーの処理
      if (oldInTeleportVc || newInTeleportVc) {
        if (
          newChannel &&
          newChannel.type === ChannelType.GuildVoice &&
          isTeleportTriggerVc(newChannel.id) &&
          newState.member
        ) {
          await TeleportVcService.createTeleportVc(
            newState.member,
            newChannel.id,
          );
        }

        if (
          oldChannel &&
          oldChannel.type === ChannelType.GuildVoice &&
          !isTeleportTriggerVc(oldChannel.id)
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
