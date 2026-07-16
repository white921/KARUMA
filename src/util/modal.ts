import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
} from "discord.js";

import { PANEL_COMMAND_NAMES } from "../constant/command";
import { SHOP_TICKET_NONE, ShopTicketType } from "../constant/shopTicket";

/**
 * 数値入力モーダルを表示
 * @param interaction ユーザー選択メニューインタラクション
 * @param toUserId 送金先ユーザーID
 * @param fromUserId 送金元ユーザーID
 * @param commandDescription コマンド説明
 * @param commandId コマンドID
 */
export async function showAmountModal(
  interaction: UserSelectMenuInteraction | ButtonInteraction,
  fromUserId: string,
  toUserId: string,
  commandDescription: string,
  commandId: string,
) {
  try {
    const guild = interaction.guild;
    if (!guild) return;

    // 金額入力用のモーダルを作成
    const modal = new ModalBuilder()
      .setCustomId(`${commandId}_${fromUserId}_${toUserId}`)
      .setTitle(`${commandDescription}`);

    // 金額入力フィールド
    const amountInput = new TextInputBuilder()
      .setCustomId("amount")
      .setLabel("金額")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("金額を入力してください")
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(10);

    // コメント入力フィールド
    const commentInput = new TextInputBuilder()
      .setCustomId("comment")
      .setLabel("備考")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("備考を入力してください " + (commandId === PANEL_COMMAND_NAMES.SHOP_SEND ? "（商品名）" : "（省略可）"))
      .setRequired(commandId === PANEL_COMMAND_NAMES.SHOP_SEND ? true : false)
      .setMaxLength(200);

    const amountRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      amountInput,
    );
    const commentRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      commentInput,
    );

    modal.addComponents(amountRow, commentRow);

    await interaction.showModal(modal);
  } catch (error: any) {
    throw error;
  }
}

/** ショップ用の支払いモーダルを表示する。チケット選択はモーダル直前のプルダウンで行う。 */
export async function showShopAmountModal(
  interaction: StringSelectMenuInteraction,
  ticketType: ShopTicketType | typeof SHOP_TICKET_NONE,
) {
  const modal = new ModalBuilder()
    .setCustomId(`${PANEL_COMMAND_NAMES.SHOP_SEND}_${ticketType}`)
    .setTitle("ショップ支払い");

  const amountInput = new TextInputBuilder()
    .setCustomId("amount")
    .setLabel("支払い金額（割引後）")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("割引適用後の金額を入力してください")
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);
  const commentInput = new TextInputBuilder()
    .setCustomId("comment")
    .setLabel("商品名")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("購入する商品名を入力してください")
    .setRequired(true)
    .setMaxLength(200);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput),
  );
  await interaction.showModal(modal);
}

/**
 * 文字入力モーダルを表示
 * @param interaction
 * @param commandDescription
 * @param commandId changeVcName
 * @returns
 */
export async function showStringModal(
  interaction: ButtonInteraction,
  commandDescription: string,
  commandId: string,
  isDiaryModal = false,
) {
  try {
    const guild = interaction.guild;
    if (!guild) return;

    // 文字入力用のモーダルを作成
    const modal = new ModalBuilder()
      .setCustomId(`${commandId}`)
      .setTitle(`${commandDescription}`);

    if (isDiaryModal) {
      const titleInput = new TextInputBuilder()
        .setCustomId("title")
        .setLabel("日記タイトル")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("日記のタイトルを入力してください")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(100);

      const bodyInput = new TextInputBuilder()
        .setCustomId("body")
        .setLabel("最初の本文")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("最初に投稿したい内容を入力してください（省略可）")
        .setRequired(false)
        .setMaxLength(200);

      const titleRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
        titleInput,
      );
      const bodyRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
        bodyInput,
      );

      modal.addComponents(titleRow, bodyRow);
    } else {
      // 文字入力フィールド
      const stringInput = new TextInputBuilder()
        .setCustomId("new_name")
        .setLabel("新しいVC名")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("新しいVC名を入力してください")
        .setRequired(true)
        .setMinLength(1);

      const stringRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
        stringInput,
      );

      modal.addComponents(stringRow);
    }

    await interaction.showModal(modal);
  } catch (error: any) {
    throw error;
  }
}
