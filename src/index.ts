import { PRIVATE_HOTEL_PREFIX } from "./constant/hotel/privateHotel";
import { DEFAULT_PUBLIC_COMMAND } from "./constant/shared/command";
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

import { exeCommand } from "./util/interaction/exeCommand";
import { sendEphemeralMessage } from "./util/shared/channelMessage";
import { validateSelectUserMenu } from "./util/interaction/select";
import { getVcMembersCount } from "./util/vc/vc";
import {
  isRuntimeFeatureEnabled,
  shouldRegisterCommandsOnBoot,
} from "./util/system/runtimeConfig";

import { handleUserSelectMenu } from "./handler/interaction/userSelectHandler";
import { handleStringSelectMenu } from "./handler/interaction/stringSelectHandler";
import { handleModalSubmit } from "./handler/interaction/modalHandler";
import { handlePanelButton } from "./handler/interaction/panelButtonHandler";
import { handleSchedule } from "./handler/system/scheduleHandler";
import { handleRoleChange } from "./handler/member/roleHandler";

import { HotelVcService } from "./service/hotel/hotelVcService";
import {
  isTeleportCategory,
  isTeleportTriggerVc,
  TeleportVcService,
} from "./service/vc/teleportVcService";
import { AccountService } from "./service/account/accountService";
import { VcService } from "./service/vc/vcService";
import { DiaryService } from "./service/diary/diaryService";
import { BotHealthMonitor } from "./service/system/botHealthMonitor";
import { getEvaluationCommandHandlerTimeoutMs } from "./util/interaction/interactionHealth";
import { shouldDeferButtonUpdate } from "./util/interaction/interactionAck";

import { COMMAND_NAMES, PANEL_COMMAND_NAMES } from "./constant/shared/command";
import {
  CATEGORY_IDS,
  FORUM_IDS,
  TEST_CATEGORY_IDS,
  TEST_FORUM_IDS,
} from "./constant/shared/id";

// テスト用
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
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
  } catch (error) {
    console.error(error);
  }
});

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

  const handlerTimeoutMs = interaction.isChatInputCommand()
    ? getEvaluationCommandHandlerTimeoutMs(
        interaction.commandName,
        Boolean(interaction.options.getUser("user")),
      )
    : undefined;
  BotHealthMonitor.recordInteractionReceived(
    interactionContext,
    handlerTimeoutMs ? { handlerTimeoutMs } : {},
  );

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
        interaction.customId !== PANEL_COMMAND_NAMES.DARK_SHOP_SEND &&
        interaction.customId !== PANEL_COMMAND_NAMES.COURT_SHOP_SEND &&
        interaction.customId !== PANEL_COMMAND_NAMES.CHANGE_VC_NAME &&
        interaction.customId !== PANEL_COMMAND_NAMES.CHANGE_VC_STATUS &&
        interaction.customId !== PANEL_COMMAND_NAMES.DIARY_PRIVATE &&
        interaction.customId !== PANEL_COMMAND_NAMES.DIARY_PUBLIC &&
        interaction.customId !== PANEL_COMMAND_NAMES.DIARY_UPDATE &&
        interaction.customId !== PANEL_COMMAND_NAMES.REDEPLOY
      ) {
        const shouldDeferUpdate = shouldDeferButtonUpdate(interaction.customId);
        try {
          if (shouldDeferUpdate) {
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
          const acknowledgement = shouldDeferUpdate
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
      if (interaction.customId.startsWith(PRIVATE_HOTEL_PREFIX)) {
        await interaction.deferUpdate();
      }
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
