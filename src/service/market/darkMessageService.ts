import { randomBytes } from "node:crypto";
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  FileUploadBuilder, LabelBuilder, MessageFlags, ModalBuilder, OverwriteType,
  PermissionFlagsBits, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder,
  type Attachment, type ButtonInteraction, type ChatInputCommandInteraction,
  type ModalSubmitInteraction, type OverwriteData, type UserSelectMenuInteraction,
} from "discord.js";
import {
  DARK_MESSAGE_MAX_AUDIO_BYTES, DARK_MESSAGE_OPERATOR_ROLES, DARK_MESSAGE_PREFIX,
  DARK_MESSAGE_PRICE, DARK_MESSAGE_PRODUCTS, type DarkMessageKind,
} from "../../constant/market/darkMessage";
import { CATEGORY_IDS } from "../../constant/shared/id";
import { hasOperatorRole } from "../../util/shared/operatorPermission";
import { DarkMessageStore, type DarkMessageRequest } from "./darkMessageStore";

type BuyerInteraction = ButtonInteraction | UserSelectMenuInteraction | ModalSubmitInteraction;

export function canIssueDarkMessage(member: unknown): boolean {
  return hasOperatorRole(member, DARK_MESSAGE_OPERATOR_ROLES);
}

export function assertDarkMessageBuyer(request: DarkMessageRequest | undefined, interaction: {
  user: { id: string }; guildId: string | null; channelId: string | null;
}): asserts request is DarkMessageRequest {
  if (!request || request.buyer_id !== interaction.user.id || request.guild_id !== interaction.guildId ||
      request.source_channel_id !== interaction.channelId) {
    throw new Error("このパネルは指定された購入者本人だけが使用できます。");
  }
  if (request.status !== "issued") throw new Error("このパネルは送信済み、または処理中です。エラーの場合は運営へお問い合わせください。");
}

export function createDarkMessageOverwrites(guildId: string, botId: string): OverwriteData[] {
  const read = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
  return [
    { id: guildId, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    ...DARK_MESSAGE_OPERATOR_ROLES.map(id => ({
      id, type: OverwriteType.Role, allow: [...read, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
    })),
    { id: botId, type: OverwriteType.Member, allow: [...read, PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles] },
  ];
}

export function createDarkMessageModal(kind: DarkMessageKind, requestId: string, recipientId: string, recipientName: string) {
  const modal = new ModalBuilder()
    .setCustomId(`${DARK_MESSAGE_PREFIX}:submit:${requestId}:${recipientId}`)
    .setTitle(`${DARK_MESSAGE_PRODUCTS[kind].title} → ${recipientName}`.slice(0, 45));
  if (kind === "letter") {
    modal.addLabelComponents(new LabelBuilder().setLabel("送信するメッセージ")
      .setTextInputComponent(new TextInputBuilder().setCustomId("body")
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000)));
  } else {
    modal.addLabelComponents(new LabelBuilder().setLabel("送信する音声ファイル")
      .setDescription("音声1個・10MiBまで。MP3 / M4A / OGG / WAV / WEBM / FLAC / AAC")
      .setFileUploadComponent(new FileUploadBuilder().setCustomId("audio")
        .setMinValues(1).setMaxValues(1).setRequired(true)));
  }
  return modal;
}

export function anonymousAudioName(attachment: Pick<Attachment, "name" | "contentType" | "size" | "url">): string {
  const extension = attachment.name.split(".").pop()?.toLowerCase();
  const allowed = new Set(["mp3", "m4a", "ogg", "oga", "opus", "wav", "webm", "flac", "aac"]);
  if (!extension || !allowed.has(extension) ||
      (attachment.contentType && !attachment.contentType.startsWith("audio/") &&
        !["application/ogg", "application/octet-stream", "video/webm", "video/mp4"].includes(attachment.contentType))) {
    throw new Error("対応する音声ファイルを1個添付してください。");
  }
  if (attachment.size <= 0 || attachment.size > DARK_MESSAGE_MAX_AUDIO_BYTES)
    throw new Error("音声ファイルは10MiB以下にしてください。");
  const url = new URL(attachment.url);
  if (url.protocol !== "https:" || url.hostname !== "cdn.discordapp.com" ||
      !/^\/(?:ephemeral-)?attachments\//.test(url.pathname)) throw new Error("音声の添付URLが無効です。");
  return `voice-message.${extension}`;
}

async function downloadAudio(attachment: Attachment): Promise<{ attachment: Buffer; name: string }> {
  const name = anonymousAudioName(attachment);
  const response = await fetch(attachment.url, { signal: AbortSignal.timeout(30_000), redirect: "error" });
  if (!response.ok || !response.body) throw new Error("音声を取得できませんでした。もう一度添付してください。");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > DARK_MESSAGE_MAX_AUDIO_BYTES) throw new Error("音声ファイルは10MiB以下にしてください。");
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel(); }
  if (!size) throw new Error("音声ファイルが空です。");
  // 元ファイル名や添付元URLを公開せず、Botの新しい添付として送る。
  return { attachment: Buffer.concat(chunks), name };
}

export function createDarkMessagePayload(kind: DarkMessageKind, body?: string, file?: { attachment: Buffer; name: string }) {
  const embed = new EmbedBuilder().setTitle(DARK_MESSAGE_PRODUCTS[kind].title).setColor(0x392247);
  if (kind === "letter") embed.setDescription(body!);
  return { embeds: [embed], files: file ? [file] : [], allowedMentions: { parse: [] as never[] } };
}

export class DarkMessageService {
  static async issue(interaction: ChatInputCommandInteraction, kind: DarkMessageKind) {
    const guild = interaction.guild;
    const channel = interaction.channel;
    if (!guild || !channel || !channel.isSendable()) throw new Error("サーバーのチケット内で実行してください。");
    const operator = await guild.members.fetch({ user: interaction.user.id, force: true });
    if (!canIssueDarkMessage(operator)) throw new Error("闇市場支配人・英傑・皇帝・システム支配人のみ実行できます。");
    const buyer = interaction.options.getUser("購入者", true);
    const member = await guild.members.fetch(buyer.id).catch(() => null);
    if (!member || buyer.bot) throw new Error("サーバーにいる購入者を指定してください。");
    if (!channel.isDMBased() && !channel.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel))
      throw new Error("購入者がこのチケットを閲覧できません。チケットの権限を確認してください。");
    const category = await guild.channels.fetch(CATEGORY_IDS.DARK_MARKET);
    if (!category || category.type !== ChannelType.GuildCategory) throw new Error("闇市の街カテゴリーが見つかりません。");
    await DarkMessageStore.create(interaction.id, guild.id, channel.id, buyer.id, operator.id, kind);
    try {
      await channel.send({
        embeds: [new EmbedBuilder().setTitle(`${DARK_MESSAGE_PRODUCTS[kind].title} 送信パネル`)
          .setDescription(`入金確認済み（${DARK_MESSAGE_PRICE.toLocaleString("ja-JP")} LIA）。指定された購入者本人だけが1回送信できます。\n宛先と内容を入力すると、相手専用のTCに匿名で届きます。\n送信者情報は運営が記録します。`)
          .setColor(0x392247)],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
          .setCustomId(`${DARK_MESSAGE_PREFIX}:start:${interaction.id}`).setLabel("宛先を選んで送信する").setStyle(ButtonStyle.Secondary))],
        allowedMentions: { parse: [] },
      });
    } catch {
      await DarkMessageStore.fail(interaction.id);
      throw new Error("パネルを送信できませんでした。チケットのBot権限を確認してください。");
    }
    await interaction.editReply({ content: "購入者専用の送信パネルを設置しました。" });
  }

  private static async request(interaction: BuyerInteraction, action: string) {
    const parts = interaction.customId.split(":");
    if (parts[0] !== DARK_MESSAGE_PREFIX || parts[1] !== action || !/^\d{17,20}$/.test(parts[2] ?? ""))
      throw new Error("無効なパネルです。");
    const request = await DarkMessageStore.get(parts[2]);
    assertDarkMessageBuyer(request, interaction);
    return request;
  }

  static async start(interaction: ButtonInteraction) {
    const request = await this.request(interaction, "start");
    await interaction.editReply({
      content: "届ける相手を1人選んでください。続く入力画面の送信で確定します。",
      components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(new UserSelectMenuBuilder()
        .setCustomId(`${DARK_MESSAGE_PREFIX}:target:${request.request_id}`).setPlaceholder("送信先を選択")
        .setMinValues(1).setMaxValues(1))],
    });
  }

  static async select(interaction: UserSelectMenuInteraction) {
    const request = await this.request(interaction, "target");
    const targetId = interaction.values[0];
    const target = interaction.users.get(targetId);
    if (!target || target.bot) throw new Error("送信先にはユーザーを指定してください。");
    await interaction.showModal(createDarkMessageModal(request.product, request.request_id, targetId, target.username));
  }

  static async submit(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const request = await this.request(interaction, "submit");
    const guild = interaction.guild;
    if (!guild) throw new Error("サーバー内で操作してください。");
    const recipientId = interaction.customId.split(":")[3];
    if (!/^\d{17,20}$/.test(recipientId ?? "")) throw new Error("送信先が無効です。");
    const recipient = await guild.members.fetch({ user: recipientId, force: true }).catch(() => null);
    if (!recipient || recipient.user.bot) throw new Error("送信先がサーバーにいません。宛先を選び直してください。");
    let body: string | undefined;
    let file: { attachment: Buffer; name: string } | undefined;
    if (request.product === "letter") {
      body = interaction.fields.getTextInputValue("body").trim();
      if (!body || body.length > 4000) throw new Error("メッセージは1〜4000文字で入力してください。");
    } else {
      const attachments = interaction.fields.getUploadedFiles("audio", true);
      if (attachments.size !== 1) throw new Error("音声ファイルを1個添付してください。");
      try { file = await downloadAudio(attachments.first()!); }
      catch (error) {
        // URLや音声の元ファイル名を含むfetchエラーを共通ログへ渡さない。
        throw new Error(error instanceof Error && /ファイル|音声|添付/.test(error.message)
          ? error.message : "音声を取得できませんでした。もう一度添付してください。");
      }
    }
    const category = await guild.channels.fetch(CATEGORY_IDS.DARK_MARKET);
    if (!category || category.type !== ChannelType.GuildCategory) throw new Error("闇市の街カテゴリーが見つかりません。");
    if (!await DarkMessageStore.claim(request.request_id, interaction.user.id, guild.id, interaction.channelId!, recipientId))
      throw new Error("このパネルはすでに使用されています。");

    let deliveryChannelId: string | undefined;
    let deliveryMessageId: string | undefined;
    try {
      // 親カテゴリーの公開権限は継承しない。記録・投稿が済むまでは受取人にも非公開。
      const channel = await guild.channels.create({
        name: `${DARK_MESSAGE_PRODUCTS[request.product].title}-${randomBytes(4).toString("hex")}`,
        type: ChannelType.GuildText, parent: category.id,
        permissionOverwrites: createDarkMessageOverwrites(guild.id, interaction.client.user.id),
        reason: "闇市場商品の匿名配送",
      });
      deliveryChannelId = channel.id;
      await DarkMessageStore.recordChannel(request.request_id, channel.id);
      const message = await channel.send(createDarkMessagePayload(request.product, body, file));
      deliveryMessageId = message.id;
      await DarkMessageStore.recordMessage(request.request_id, message.id);
      await channel.permissionOverwrites.edit(recipientId, {
        ViewChannel: true, ReadMessageHistory: true, SendMessages: true, AttachFiles: true,
      }, { type: OverwriteType.Member, reason: "闇市場商品の受取人" });
      await DarkMessageStore.complete(request.request_id);
    } catch {
      // Discord APIの送信結果が不明な場合も再送しない。運営が配送記録とTCを確認する。
      await DarkMessageStore.fail(request.request_id).catch(() => undefined);
      console.error("[DarkMessage] delivery requires review", { requestId: request.request_id, deliveryChannelId, deliveryMessageId });
      throw new Error("送信の完了を確認できませんでした。再送せず、運営へお問い合わせください。");
    }
    await interaction.editReply({ content: "専用TCに送信しました。", components: [] });
  }
}
