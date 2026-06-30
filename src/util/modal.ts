import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuInteraction,
  ButtonInteraction,
} from "discord.js";

import { PANEL_COMMAND_NAMES } from "../constant/command";

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
