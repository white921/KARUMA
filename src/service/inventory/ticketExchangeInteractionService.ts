import {
  ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, MessageFlags,
  ModalBuilder, ModalSubmitInteraction, StringSelectMenuBuilder, StringSelectMenuInteraction,
  TextInputBuilder, TextInputStyle,
} from "discord.js";
import {
  getTicketExchangeRate, parseTicketExchangeQuantity, TICKET_EXCHANGE_PREFIX, TICKET_EXCHANGE_RATES,
} from "../../constant/inventory/ticketExchange";
import { TEXT_CHANNEL_IDS } from "../../constant/shared/id";
import { ItemService } from "./itemService";
import { TicketExchangeService } from "./ticketExchangeService";

function assertChannel(interaction: { channelId: string | null; guildId: string | null }) {
  if (!interaction.guildId || interaction.channelId !== TEXT_CHANNEL_IDS.TICKET_EXCHANGE_PANEL) {
    throw new Error("チケット換金パネルから操作してください。");
  }
}

export async function handleTicketExchangeButton(interaction: ButtonInteraction) {
  assertChannel(interaction);
  const [, action, requestId] = interaction.customId.split(":");
  if (action === "start") {
    const quantities = await ItemService.getQuantities(interaction.user.id, TICKET_EXCHANGE_RATES.map((rate) => rate.itemKey));
    const eligible = TICKET_EXCHANGE_RATES.filter((rate) => (quantities.get(rate.itemKey) ?? 0) >= 5);
    if (!eligible.length) {
      await interaction.editReply({ content: "換金できるチケットがありません。同じ種類を5枚以上集めてください。", components: [] });
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
  await interaction.editReply({
    content: [result.alreadyCompleted ? "✅ この換金は既に完了しています。追加の消費・入金はしていません。" : "✅ チケットを換金しました。",
      `${result.label}: ${result.quantity.toLocaleString()}枚 → **${result.amount.toLocaleString()} LIA**`,
      `換金完了時の所持数: ${result.afterQuantity.toLocaleString()}枚`,
      `換金完了時の残高: ${result.afterWallet.toLocaleString()} LIA`].join("\n"),
    embeds: [], components: [],
  });
}

export async function showTicketExchangeModal(interaction: StringSelectMenuInteraction) {
  assertChannel(interaction);
  const rate = getTicketExchangeRate(interaction.values[0]);
  await interaction.showModal(new ModalBuilder()
    .setCustomId(`${TICKET_EXCHANGE_PREFIX}:quantity:${rate.itemKey}`).setTitle("チケット換金枚数")
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("quantity").setLabel("換金する枚数（5枚単位）")
        .setPlaceholder("例: 5、10、15").setValue("5").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(6),
    )));
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
