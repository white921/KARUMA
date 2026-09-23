import { GuildMemberCacheService } from "../system/guildMemberCacheService";
import { randomUUID } from "node:crypto";
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, GuildMember,
  MessageFlags, ModalBuilder, PermissionsBitField, StringSelectMenuBuilder,
  TextInputBuilder, TextInputStyle,
} from "discord.js";
import type { RowDataPacket } from "mysql2";
import { CAST_MAX_AMOUNT, CAST_MAX_SELECTION, CAST_MENUS, CAST_PAGE_SIZE, CAST_PAYMENT_PREFIX, CAST_SESSION_TTL_MS } from "../../constant/cast/castPayment";
import { ACTION_TYPES } from "../../constant/currency/action";
import { BOT_ID, ROLE_IDS, TEXT_CHANNEL_IDS } from "../../constant/shared/id";
import { COLOR } from "../../constant/shared/color";
import type { Account } from "../../type/account/account";
import type { CastInteraction, CastMenu, CastSession } from "../../type/cast/castPayment";
import { SendService } from "../currency/sendService";
import { DbService } from "../system/dbService";

export function isCastMenu(value: string): value is CastMenu {
  return Object.prototype.hasOwnProperty.call(CAST_MENUS, value);
}
export function isEligibleCast(member: GuildMember, menu: CastMenu): boolean {
  if (member.user.bot) return false;
  const roles = menu === "maid" ? [ROLE_IDS.CAST_MAID] : menu === "butler"
    ? [ROLE_IDS.CAST_BUTLER] : [ROLE_IDS.CAST_MAID, ROLE_IDS.CAST_BUTLER];
  return roles.some(role => member.roles.cache.has(role));
}
export function calculateCastAmount(menu: CastMenu, count: number, hours: number, optionAmount = 0): number {
  if (!Number.isSafeInteger(count) || (menu === "free"
    ? count !== 0
    : count < 1 || count > CAST_MAX_SELECTION || (menu !== "group" && count !== 1))) {
    throw new Error("指名するキャストを選択してください。");
  }
  if (!Number.isSafeInteger(hours) || hours < 1) throw new Error("時間は1時間単位で指定してください。");
  const amount = CAST_MENUS[menu].rate ? CAST_MENUS[menu].rate * hours * (menu === "group" ? count : 1) : optionAmount;
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > CAST_MAX_AMOUNT) throw new Error("支払い金額が不正、または上限を超えています。");
  return amount;
}
function customId(s: CastSession, action: string): string {
  return `${CAST_PAYMENT_PREFIX}:${action}:${s.id}:${s.revision}`;
}
function button(s: CastSession, action: string, label: string, disabled = false, style = ButtonStyle.Secondary) {
  return new ButtonBuilder().setCustomId(customId(s, action)).setLabel(label).setStyle(style).setDisabled(disabled);
}
function selectedEmbed(s: CastSession, title: string): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle(title).setColor(COLOR.PINK)
    .setDescription(`メニュー：**${CAST_MENUS[s.menu].label}**`)
    .setFooter({ text: "操作開始から30分以内に確定してください。" });
  if (s.menu === "free") return embed;
  if (!s.castIds.length) embed.addFields({ name: "指名中のキャスト", value: "まだ選択されていません。" });
  for (let i = 0; i < s.castIds.length; i += 25) {
    embed.addFields({ name: i ? "指名中のキャスト（続き）" : `指名中のキャスト（${s.castIds.length}人）`,
      value: s.castIds.slice(i, i + 25).map(id => `<@${id}>`).join("\n") });
  }
  return embed;
}
export function createCastConfirmationEmbed(s: CastSession): EmbedBuilder {
  const amount = calculateCastAmount(s.menu, s.castIds.length, s.hours, s.amount);
  const embed = selectedEmbed(s, "支払い内容の確認");
  if (CAST_MENUS[s.menu].rate) embed.addFields(
    { name: "利用時間", value: `${s.hours}時間`, inline: true },
    { name: "料金", value: `${CAST_MENUS[s.menu].rate.toLocaleString()} LIA × ${s.hours}時間${s.menu === "group" ? ` × ${s.castIds.length}人` : ""}`, inline: true },
  );
  else embed.addFields({ name: "オプション", value: s.option });
  return embed.addFields({ name: "合計金額", value: `**${amount.toLocaleString()} LIA**` }, { name: "支払先", value: `<@${BOT_ID}>` });
}

export class CastPaymentService {
  private static sessions = new Map<string, CastSession>();

  private static async start(interaction: CastInteraction, menu: string): Promise<void> {
    if (!interaction.isButton() || !interaction.guild || interaction.channelId !== TEXT_CHANNEL_IDS.CAST_PAYMENT_PANEL || !isCastMenu(menu)) {
      throw new Error("指定の支払いパネルから操作してください。");
    }
    if (!interaction.deferred) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    let candidates: CastSession["candidates"] = [];
    if (menu !== "free") {
      const members = await GuildMemberCacheService.getMembers(interaction.guild);
      candidates = members.filter(m => isEligibleCast(m, menu))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"))
        .map(m => ({ id: m.id, name: m.displayName }));
      if (!candidates.length) throw new Error("選択できるキャストがいません。");
    }
    const s: CastSession = {
      id: randomUUID(), userId: interaction.user.id, guildId: interaction.guildId!, channelId: interaction.channelId,
      menu, candidates, castIds: [], page: 0, hours: 1, amount: 0, option: "", stage: menu === "free" ? "time" : "cast",
      revision: 0, expiresAt: Date.now() + CAST_SESSION_TTL_MS, busy: false,
    };
    this.sessions.set(s.id, s);
    setTimeout(() => this.sessions.delete(s.id), CAST_SESSION_TTL_MS).unref();
    await this.render(interaction, s);
  }

  private static async render(interaction: CastInteraction, s: CastSession): Promise<void> {
    const components: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[] = [];
    let embed: EmbedBuilder;
    if (s.stage === "cast") {
      const pages = Math.ceil(s.candidates.length / CAST_PAGE_SIZE);
      s.page = Math.max(0, Math.min(s.page, pages - 1));
      const page = s.candidates.slice(s.page * CAST_PAGE_SIZE, (s.page + 1) * CAST_PAGE_SIZE);
      embed = selectedEmbed(s, s.menu === "group" ? "指名中パネル" : "キャストを選択")
        .setDescription(`メニュー：**${CAST_MENUS[s.menu].label}**\n${s.menu === "group" ? "セレクトで追加できます。選択済みの人をもう一度選ぶと取り消せます。" : "指名するキャストをセレクトから選んでください。"}\n${s.page + 1} / ${pages}ページ`);
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder()
        .setCustomId(customId(s, "cast")).setPlaceholder("キャストを選択")
        .setMinValues(1).setMaxValues(s.menu === "group" ? page.length : 1)
        .addOptions(page.map(c => ({ label: `${s.castIds.includes(c.id) ? "【指名中】" : ""}${c.name}`.slice(0, 100), value: c.id })))));
      const controls = new ActionRowBuilder<ButtonBuilder>();
      if (pages > 1) controls.addComponents(button(s, "prev", "前のページ", s.page === 0), button(s, "next", "次のページ", s.page === pages - 1));
      if (s.menu === "group") controls.addComponents(button(s, "chosen", "指名確定", !s.castIds.length, ButtonStyle.Success));
      controls.addComponents(button(s, "cancel", "キャンセル"));
      components.push(controls);
    } else if (s.stage === "time") {
      embed = selectedEmbed(s, "利用時間を選択").addFields(
        { name: "利用時間", value: `**${s.hours}時間**` },
        { name: "合計金額", value: `${calculateCastAmount(s.menu, s.castIds.length, s.hours).toLocaleString()} LIA` });
      const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
        button(s, "minus", "−1時間", s.hours === 1), button(s, "plus", "＋1時間"),
        button(s, "review", "確認へ進む", false, ButtonStyle.Success));
      if (s.menu !== "free") controls.addComponents(button(s, "back", "キャストを選び直す"));
      controls.addComponents(button(s, "cancel", "キャンセル"));
      components.push(controls);
    } else if (s.stage === "option") {
      embed = selectedEmbed(s, "オプション内容を入力");
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
        button(s, "option", "金額・オプションを入力", false, ButtonStyle.Primary),
        button(s, "back", "キャストを選び直す"), button(s, "cancel", "キャンセル")));
    } else {
      embed = createCastConfirmationEmbed(s);
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
        button(s, "pay", "確定して支払う", false, ButtonStyle.Success),
        button(s, "revise", "内容を変更"), button(s, "cancel", "キャンセル")));
    }
    await interaction.editReply({ content: "", embeds: [embed], components, allowedMentions: { parse: [] } });
  }

  private static async showOptionModal(interaction: CastInteraction, s: CastSession): Promise<void> {
    if (interaction.isModalSubmit()) throw new Error("無効な操作です。");
    const amount = new TextInputBuilder().setCustomId("amount").setLabel("送金額（LIA・整数）")
      .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10);
    const option = new TextInputBuilder().setCustomId("option").setLabel("オプション内容")
      .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
    if (s.amount) amount.setValue(String(s.amount));
    if (s.option) option.setValue(s.option);
    await interaction.showModal(new ModalBuilder().setCustomId(customId(s, "details"))
      .setTitle(`${CAST_MENUS[s.menu].label} オプション送金`)
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(amount), new ActionRowBuilder<TextInputBuilder>().addComponents(option)));
  }

  static async handle(interaction: CastInteraction): Promise<void> {
    const [prefix, action, id, revision, extra] = interaction.customId.split(":");
    if (prefix !== CAST_PAYMENT_PREFIX || extra) throw new Error("無効な操作です。");
    if (action === "start" && revision === undefined) return this.start(interaction, id);
    const s = this.sessions.get(id);
    if (!s || s.expiresAt <= Date.now()) throw new Error("この操作は期限切れ、または処理済みです。パネルからやり直してください。");
    if (s.userId !== interaction.user.id || s.guildId !== interaction.guildId || s.channelId !== interaction.channelId) throw new Error("このパネルは操作できません。");
    if (s.busy || String(s.revision) !== revision) throw new Error("操作が重複しています。最新の画面から操作してください。");
    // awaitより前に操作権を取得。古い画面からの更新・支払いとの競合を防ぐ。
    s.busy = true;
    try {
      if (action === "cast" && s.stage === "cast" && interaction.isStringSelectMenu()) {
        const pageIds = s.candidates.slice(s.page * CAST_PAGE_SIZE, (s.page + 1) * CAST_PAGE_SIZE).map(c => c.id);
        const values = [...new Set(interaction.values)];
        if (!values.length || values.some(v => !pageIds.includes(v)) || (s.menu !== "group" && values.length !== 1)) throw new Error("無効なキャストの選択です。");
        const ids = s.menu === "group" ? [...s.castIds.filter(c => !values.includes(c)), ...values.filter(c => !s.castIds.includes(c))] : values;
        if (ids.length > CAST_MAX_SELECTION) throw new Error(`一度の指名は${CAST_MAX_SELECTION}人までです。`);
        s.castIds = ids;
        s.revision++;
        if (!CAST_MENUS[s.menu].rate) {
          s.stage = "option";
          await this.showOptionModal(interaction, s);
          // モーダルを閉じた場合も、この画面から再入力・キャンセルできる。
          await this.render(interaction, s);
          return;
        }
        if (!interaction.deferred) await interaction.deferUpdate();
        if (s.menu !== "group") s.stage = "time";
      } else if (action === "details" && s.stage === "option" && interaction.isModalSubmit()) {
        const rawAmount = interaction.fields.getTextInputValue("amount").trim();
        const option = interaction.fields.getTextInputValue("option").trim();
        if (!/^[0-9]+$/.test(rawAmount) || !option || option.length > 500) throw new Error("送金額は整数、オプション内容は1〜500文字で入力してください。");
        const amount = calculateCastAmount(s.menu, s.castIds.length, 1, Number(rawAmount));
        if (!interaction.isFromMessage()) throw new Error("パネルから入力し直してください。");
        if (!interaction.deferred) await interaction.deferUpdate();
        s.amount = amount; s.option = option; s.stage = "confirm"; s.revision++;
      } else if (interaction.isButton()) {
        if (action === "option" && s.stage === "option") {
          await this.showOptionModal(interaction, s);
          return;
        }
        if (!interaction.deferred) await interaction.deferUpdate();
        if (action === "cancel") {
          this.sessions.delete(s.id);
          await interaction.editReply({ content: "キャンセルしました。支払いは発生していません。", embeds: [], components: [] });
          return;
        }
        if (action === "pay" && s.stage === "confirm") {
          this.sessions.delete(s.id);
          await interaction.editReply({ content: "支払いを処理しています…", embeds: [], components: [] });
          await this.pay(interaction, s);
          return;
        }
        if ((action === "prev" || action === "next") && s.stage === "cast") s.page += action === "next" ? 1 : -1;
        else if (action === "chosen" && s.stage === "cast" && s.menu === "group" && s.castIds.length) s.stage = "time";
        else if ((action === "minus" || action === "plus") && s.stage === "time") {
          const hours = s.hours + (action === "plus" ? 1 : -1);
          calculateCastAmount(s.menu, s.castIds.length, hours);
          s.hours = hours;
        } else if (action === "review" && s.stage === "time") s.stage = "confirm";
        else if (action === "back" && s.menu !== "free" && (s.stage === "time" || s.stage === "option")) s.stage = "cast";
        else if (action === "revise" && s.stage === "confirm") s.stage = CAST_MENUS[s.menu].rate ? "time" : "option";
        else throw new Error("最新の画面から操作してください。");
        s.revision++;
      } else throw new Error("無効な操作です。");
      await this.render(interaction, s);
    } finally { s.busy = false; }
  }

  /** 口座を決まった順でロックし、決済IDの記録と残高・履歴を一括確定する。 */
  static async transfer(s: CastSession): Promise<boolean> {
    const amount = calculateCastAmount(s.menu, s.castIds.length, s.hours, s.amount);
    if (new Set(s.castIds).size !== s.castIds.length) throw new Error("キャストが重複しています。");
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [accounts] = await connection.execute<Account[] & RowDataPacket[]>(
        "SELECT * FROM accounts WHERE user_id IN (?, ?) ORDER BY user_id FOR UPDATE", [s.userId, BOT_ID]);
      const [previous] = await connection.execute<RowDataPacket[]>("SELECT id FROM cast_payments WHERE id = ? FOR UPDATE", [s.id]);
      if (previous.length) { await connection.rollback(); return false; }
      const payer = accounts.find(a => String(a.user_id) === s.userId);
      const recipient = accounts.find(a => String(a.user_id) === BOT_ID);
      await SendService.validateSend(payer!, recipient!, amount);
      if (Number(recipient!.wallet) + amount > CAST_MAX_AMOUNT) throw new Error("受取口座の残高上限のため支払いできません。運営へお問い合わせください。");
      await connection.execute("UPDATE accounts SET wallet = wallet - ? WHERE user_id = ?", [amount, s.userId]);
      await connection.execute("UPDATE accounts SET wallet = wallet + ? WHERE user_id = ?", [amount, BOT_ID]);
      const detail = CAST_MENUS[s.menu].rate
        ? `${s.hours}時間${s.menu === "free" ? "" : ` / ${s.castIds.length}人指名`}` : s.option;
      const comment = `キャスト支払い [${s.id}] ${CAST_MENUS[s.menu].label} / ${detail}`;
      await connection.execute(
        "INSERT INTO actions (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [ACTION_TYPES.CAST_PAYMENT, amount, s.userId, BOT_ID, Number(payer!.wallet) - amount, Number(recipient!.wallet) + amount, [...comment].slice(0, 256).join("")]);
      await connection.execute(
        "INSERT INTO cast_payments (id, user_id, menu, cast_ids, hours, amount, option_text, log_thread_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [s.id, s.userId, s.menu, JSON.stringify(s.castIds), CAST_MENUS[s.menu].rate ? s.hours : 0, amount, s.option, CAST_MENUS[s.menu].threadId]);
      await connection.commit();
      return true;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  private static async pay(interaction: CastInteraction, s: CastSession): Promise<void> {
    if (!interaction.guild) throw new Error("サーバー内で操作してください。");
    for (const id of s.castIds) {
      const member = await interaction.guild.members.fetch({ user: id, force: true }).catch(() => null);
      if (!member || !isEligibleCast(member, s.menu)) throw new Error("指名したキャストが退会、または対象ロールを失っています。選び直してください。");
    }
    const thread = await interaction.client.channels.fetch(CAST_MENUS[s.menu].threadId);
    const bot = await interaction.guild.members.fetchMe();
    if (!thread?.isThread() || thread.guildId !== s.guildId || thread.locked || !thread.permissionsFor(bot)?.has([
      PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessagesInThreads, PermissionsBitField.Flags.EmbedLinks,
    ])) throw new Error("ログスレッドに送信できないため支払いを中止しました。運営へお問い合わせください。");
    const paid = await this.transfer(s);
    if (!paid) {
      await interaction.editReply({ content: "この支払いは処理済みです。追加の引き落としはありません。", embeds: [], components: [] });
      return;
    }
    let logFailed = false;
    try {
      const log = createCastConfirmationEmbed(s).setTitle("執事・メイド 支払い完了").setColor(COLOR.GREEN)
        .addFields({ name: "利用者", value: `<@${s.userId}>` }).setTimestamp().setFooter({ text: `決済ID: ${s.id}` });
      const message = await thread.send({ embeds: [log], allowedMentions: { parse: [] } });
      const connection = await DbService.getConnection();
      try { await connection.execute("UPDATE cast_payments SET log_message_id = ? WHERE id = ?", [message.id, s.id]); }
      finally { connection.release(); }
    } catch (error) {
      logFailed = true;
      console.error(`[CastPayment] Payment committed, log delivery/receipt failed. payment=${s.id}`, error);
    }
    await interaction.editReply({
      content: `✅ ${CAST_MENUS[s.menu].label}の支払いが完了しました。**${calculateCastAmount(s.menu, s.castIds.length, s.hours, s.amount).toLocaleString()} LIA** をLEVELIA Botへ送金しました。` +
        (logFailed ? `\n支払いは完了していますが、ログの送信・記録に失敗しました。再度支払わず、運営へ決済ID「${s.id}」をお知らせください。` : ""),
      embeds: [], components: [], allowedMentions: { parse: [] },
    });
  }
}
