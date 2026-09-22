import { ReceiptDmService } from "../currency/receiptDmService";
import { ACTION_TYPES } from "../../constant/currency/action";
import {
  ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, MessageFlags,
  ModalSubmitInteraction, StringSelectMenuBuilder, StringSelectMenuInteraction,
} from "discord.js";
import {
  getTicketExchangeRate, parseTicketExchangeQuantity, TICKET_EXCHANGE_PREFIX, TICKET_EXCHANGE_RATES,
  TICKET_EXCHANGE_STEP_PREFIX, TICKET_EXCHANGE_DRAFT_TTL_MS, TICKET_EXCHANGE_BATCH_SIZE, TICKET_EXCHANGE_MAX_QUANTITY,
} from "../../constant/inventory/ticketExchange";
import { COLOR } from "../../constant/shared/color";
import { TEXT_CHANNEL_IDS } from "../../constant/shared/id";
import { ItemService } from "./itemService";
import { TicketExchangeService } from "./ticketExchangeService";
import { TicketExchangeLogService } from "./ticketExchangeLogService";
import type { TicketExchangeDraft, TicketExchangeResult } from "../../type/inventory/ticketExchange";

const drafts = new Map<string, TicketExchangeDraft>();

function assertChannel(interaction: { channelId: string | null; guildId: string | null }) {
  if (!interaction.guildId || interaction.channelId !== TEXT_CHANNEL_IDS.TICKET_EXCHANGE_PANEL) {
    throw new Error("チケット換金パネルから操作してください。");
  }
}

export async function handleTicketExchangeButton(interaction: ButtonInteraction) {
  assertChannel(interaction);
  if (interaction.customId.startsWith(TICKET_EXCHANGE_STEP_PREFIX)) {
    await handleQuantityButton(interaction);
    return;
  }
  const [, action, requestId] = interaction.customId.split(":");
  if (action === "start") {
    const quantities = await ItemService.getQuantities(interaction.user.id, TICKET_EXCHANGE_RATES.map((rate) => rate.itemKey));
    const eligible = TICKET_EXCHANGE_RATES.filter((rate) => (quantities.get(rate.itemKey) ?? 0) >= 5);
    if (!eligible.length) {
      await interaction.editReply({ content: "換金できるチケットがありません。同じ種類を5枚以上集めてください。", embeds: [], components: [] });
      return;
    }
    await interaction.editReply({
      content: "換金するチケットを選んでください。所持数が5枚以上の種類を表示しています。",
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(`${TICKET_EXCHANGE_PREFIX}:select`).setPlaceholder("チケットの種類")
          .addOptions(eligible.map((rate) => ({ label: rate.label, value: rate.itemKey,
            description: `所持 ${quantities.get(rate.itemKey)}枚 / 5枚 → ${(rate.unitPrice * 5).toLocaleString()} LIA` }))),
      )],
    });
    return;
  }
  if (!requestId || !/^\d{17,20}$/.test(requestId)) throw new Error("換金の確認情報が不正です。");
  if (action === "cancel") {
    await TicketExchangeService.cancel(requestId, interaction.user.id);
    await interaction.editReply({ content: "換金をキャンセルしました。チケットは消費していません。", embeds: [], components: [] });
    return;
  }
  if (action !== "confirm") throw new Error("換金操作が不正です。");
  const result = await TicketExchangeService.redeem(requestId, interaction.user.id);
  await notifyExchange(interaction, result);
  // 利用者への応答に失敗しても、確定した換金のログを先に記録する。
  await TicketExchangeLogService.send(interaction.client, interaction.guildId!, interaction.user.id, requestId, result);
  await showExchangeResult(interaction, result);
}

async function notifyExchange(interaction: ButtonInteraction, result: TicketExchangeResult) {
  if (result.alreadyCompleted) return;
  await ReceiptDmService.send(interaction, {
    actionType: ACTION_TYPES.TICKET_EXCHANGE, recipientId: interaction.user.id,
    amount: result.amount, afterWallet: result.afterWallet,
    fields: [{ name: "換金チケット", value: `${result.label} ×${result.quantity}枚` }],
  });
}

async function showExchangeResult(interaction: ButtonInteraction, result: TicketExchangeResult) {
  await interaction.editReply({
    content: [result.alreadyCompleted ? "✅ この換金は既に完了しています。追加の消費・入金はしていません。" : "✅ チケットを換金しました。",
      `${result.label}: ${result.quantity.toLocaleString()}枚 → **${result.amount.toLocaleString()} LIA**`,
      `換金完了時の所持数: ${result.afterQuantity.toLocaleString()}枚`,
      `換金完了時の残高: ${result.afterWallet.toLocaleString()} LIA`].join("\n"),
    embeds: [], components: [],
  });
}

function quantityPayload(draft: TicketExchangeDraft, notice?: string) {
  const button = (action: string, label: string, style: ButtonStyle, disabled = false) => new ButtonBuilder()
    .setCustomId(`${TICKET_EXCHANGE_STEP_PREFIX}${action}:${draft.id}:${draft.revision}`)
    .setLabel(label).setStyle(style).setDisabled(disabled);
  return {
    content: "",
    embeds: [new EmbedBuilder()
      .setTitle("チケット換金")
      .setColor(COLOR.LIGFT_PINK)
      .setDescription([notice, `**${draft.label}**`, "「−5枚」「＋5枚」で調整できます。", "確定するとチケットは戻せません。"].filter(Boolean).join("\n"))
      .addFields(
        { name: "所持数", value: `${draft.owned.toLocaleString()}枚`, inline: true },
        { name: "換金枚数", value: `**${draft.quantity.toLocaleString()}枚**`, inline: true },
        { name: "受取額", value: `**${(draft.quantity * draft.unitPrice).toLocaleString()} LIA**`, inline: true },
      )
      .setFooter({ text: "操作の有効期限は10分です。" })],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button("minus", "−5枚", ButtonStyle.Secondary, draft.requestCreated || draft.quantity <= TICKET_EXCHANGE_BATCH_SIZE),
        button("plus", "＋5枚", ButtonStyle.Primary, draft.requestCreated || draft.quantity >= draft.maximum),
        button("max", "最大枚数", ButtonStyle.Secondary, draft.requestCreated || draft.quantity >= draft.maximum),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button("submit", "換金を確定", ButtonStyle.Success),
        button("dismiss", "キャンセル", ButtonStyle.Secondary),
      ),
    ],
  };
}

export async function showTicketExchangeQuantity(interaction: StringSelectMenuInteraction) {
  assertChannel(interaction);
  const rate = getTicketExchangeRate(interaction.values[0]);
  await interaction.deferUpdate();
  const owned = (await ItemService.getQuantities(interaction.user.id, [rate.itemKey])).get(rate.itemKey) ?? 0;
  if (owned < TICKET_EXCHANGE_BATCH_SIZE) {
    await interaction.editReply({ content: "チケットが不足しています。同じ種類を5枚以上集めてください。", embeds: [], components: [] });
    return;
  }
  const draft: TicketExchangeDraft = {
    id: interaction.id, userId: interaction.user.id, itemKey: rate.itemKey, label: rate.label,
    unitPrice: rate.unitPrice, owned, quantity: TICKET_EXCHANGE_BATCH_SIZE,
    maximum: Math.min(TICKET_EXCHANGE_MAX_QUANTITY, Math.floor(owned / TICKET_EXCHANGE_BATCH_SIZE) * TICKET_EXCHANGE_BATCH_SIZE),
    revision: 0, expiresAt: Date.now() + TICKET_EXCHANGE_DRAFT_TTL_MS,
    requestCreated: false, cancelled: false, seenInteractions: new Set(), tail: Promise.resolve(),
  };
  drafts.set(draft.id, draft);
  // 再起動後の下書きは失効させる。確定した換金の重複防止は引き続きDBで行う。
  setTimeout(() => drafts.delete(draft.id), TICKET_EXCHANGE_DRAFT_TTL_MS).unref();
  await interaction.editReply(quantityPayload(draft));
}

async function handleQuantityButton(interaction: ButtonInteraction) {
  const [action, draftId, revisionText, ...extra] = interaction.customId.slice(TICKET_EXCHANGE_STEP_PREFIX.length).split(":");
  if (extra.length || !["plus", "minus", "max", "submit", "dismiss"].includes(action) || !/^\d+$/.test(revisionText ?? "")) {
    throw new Error("換金操作が不正です。");
  }
  const draft = drafts.get(draftId);
  if (!draft || draft.expiresAt <= Date.now()) {
    await interaction.editReply({ content: "操作の有効期限が切れたか、Botが再起動しました。換金パネルからやり直してください。", embeds: [], components: [] });
    return;
  }
  if (draft.userId !== interaction.user.id) throw new Error("この換金画面は操作できません。");

  // DB照会を挟まず、同じ下書きへの操作と画面更新を受信順に処理する。
  const operation = draft.tail.catch(() => {}).then(async () => {
    if (draft.expiresAt <= Date.now()) {
      await interaction.editReply({ content: "操作の有効期限が切れました。換金パネルからやり直してください。", embeds: [], components: [] });
      return;
    }
    if (draft.result) {
      await showExchangeResult(interaction, { ...draft.result, alreadyCompleted: true });
      return;
    }
    if (draft.cancelled) {
      await interaction.editReply({ content: "換金をキャンセルしました。チケットは消費していません。", embeds: [], components: [] });
      return;
    }
    if (draft.seenInteractions.has(interaction.id)) return;
    if (action === "dismiss") {
      if (draft.requestCreated) await TicketExchangeService.cancel(draft.id, draft.userId);
      draft.cancelled = true;
      await interaction.editReply({ content: "換金をキャンセルしました。チケットは消費していません。", embeds: [], components: [] });
      return;
    }
    if (action === "submit") {
      // 連打による未表示の増減を、古い確定ボタンで承認したことにしない。
      if (Number(revisionText) !== draft.revision) {
        await interaction.editReply(quantityPayload(draft, "枚数が更新されています。現在の枚数と受取額を確認して、もう一度確定してください。"));
        return;
      }
      if (!draft.requestCreated) {
        const request = await TicketExchangeService.createRequest(draft.id, draft.userId, draft.itemKey, draft.quantity);
        draft.requestCreated = true;
        // デプロイをまたいだ料金変更などで表示額と確定額が違えば、新しい額を再確認する。
        if (request.rate.unitPrice !== draft.unitPrice) {
          draft.unitPrice = request.rate.unitPrice;
          draft.revision += 1;
          await interaction.editReply(quantityPayload(draft, "換金レートが更新されました。受取額を確認して、もう一度確定してください。"));
          return;
        }
      }
      const result = await TicketExchangeService.redeem(draft.id, draft.userId);
      draft.result = result;
      await notifyExchange(interaction, result);
      await TicketExchangeLogService.send(interaction.client, interaction.guildId!, draft.userId, draft.id, result);
      await showExchangeResult(interaction, result);
      return;
    }
    if (draft.requestCreated) {
      await interaction.editReply(quantityPayload(draft, "確定処理を開始したため、枚数は変更できません。再度確定するかキャンセルしてください。"));
      return;
    }
    draft.seenInteractions.add(interaction.id);
    const next = action === "max" ? draft.maximum : draft.quantity + (action === "plus" ? TICKET_EXCHANGE_BATCH_SIZE : -TICKET_EXCHANGE_BATCH_SIZE);
    const quantity = Math.max(TICKET_EXCHANGE_BATCH_SIZE, Math.min(draft.maximum, next));
    if (quantity !== draft.quantity) {
      draft.quantity = quantity;
      draft.revision += 1;
    }
    await interaction.editReply(quantityPayload(draft));
  });
  draft.tail = operation.catch(() => {});
  await operation;
}

export async function confirmTicketExchangeModal(interaction: ModalSubmitInteraction) {
  assertChannel(interaction);
  const itemKey = interaction.customId.split(":")[2];
  const quantity = parseTicketExchangeQuantity(interaction.fields.getTextInputValue("quantity"));
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const request = await TicketExchangeService.createRequest(interaction.id, interaction.user.id, itemKey, quantity);
  await interaction.editReply({
    content: ["**チケット換金の確認**", request.rate.label,
      `消費枚数: **${quantity.toLocaleString()}枚**（所持 ${request.owned.toLocaleString()}枚）`,
      `受取額: **${request.amount.toLocaleString()} LIA**`,
      "確定するとチケットは戻せません。確認の有効期限は10分です。"].join("\n"),
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${TICKET_EXCHANGE_PREFIX}:confirm:${interaction.id}`).setLabel("換金を確定").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${TICKET_EXCHANGE_PREFIX}:cancel:${interaction.id}`).setLabel("キャンセル").setStyle(ButtonStyle.Secondary),
    )],
  });
}
