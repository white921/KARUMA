import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

import { BOT_ID, ROLE_IDS } from "../constant/id";
import {
  ROULETTE_ACTION_NAMES,
  getRouletteEventKey,
  ROULETTE_MESSAGES,
  ROULETTE_PARTICIPATION_BONUS,
} from "../constant/roulette";
import { CURRENCY_NAMES } from "../constant/currency";
import { DbService } from "./dbService";
import {
  calculateRoulettePayout,
  getAllowedBetKinds,
  getBetLabel,
  getRouletteResultColor,
  normalizeRouletteResultColor,
  ROULETTE_BET_LABELS,
  validateRouletteBet,
} from "./rouletteRules";
import { RouletteBet, RouletteBetKind, RouletteStage } from "../type/roulette";

type RouletteRoundRow = RowDataPacket & {
  id: number;
  stage: RouletteStage;
  status: "open" | "closed" | "settled";
};

type RouletteBetRow = RowDataPacket & {
  id: number;
  user_id: string;
  bet_kind: RouletteBetKind;
  selection: string;
  amount: number;
};

type AccountRow = RowDataPacket & { wallet: number };

export type RouletteSettlement = {
  roundId: number;
  stage: RouletteStage;
  result: number;
  winners: Array<{ userId: string; payout: number; bet: RouletteBet }>;
  betCount: number;
};

function parseStage(value: string): RouletteStage {
  const stage = Number(value);
  if (stage !== 1 && stage !== 2 && stage !== 3) {
    throw new Error("部は1・2・3のいずれかを指定してください。");
  }
  return stage;
}

function parseConfirmId(customId: string): {
  stage: RouletteStage;
  kind: RouletteBetKind;
  selection: string;
  amount: number;
} {
  const [, stageValue, kindValue, selection, amountValue] = customId.split("_");
  const stage = parseStage(stageValue);
  const kinds: RouletteBetKind[] = [
    "red", "black", "even", "odd", "dozen", "straight", "split",
  ];
  if (!kinds.includes(kindValue as RouletteBetKind)) {
    throw new Error("賭け方の情報が不正です。最初からやり直してください。");
  }
  return { stage, kind: kindValue as RouletteBetKind, selection, amount: Number(amountValue) };
}

async function getMember(interaction: ChatInputCommandInteraction): Promise<GuildMember> {
  if (!interaction.guild) throw new Error("このコマンドはサーバー内でのみ使用できます。");
  return interaction.member instanceof GuildMember
    ? interaction.member
    : interaction.guild.members.fetch(interaction.user.id);
}

export class RouletteService {
  static validateResultColor(result: number, color: string): void {
    const selectedColor = normalizeRouletteResultColor(color);
    const actualColor = getRouletteResultColor(result);
    if (selectedColor !== actualColor) {
      const actualLabel = actualColor === "red" ? "赤" : actualColor === "black" ? "黒" : "緑";
      throw new Error(`数字 ${result} の色は ${actualLabel} です。結果を確認してからもう一度実行してください。`);
    }
  }

  static async assertOperator(interaction: ChatInputCommandInteraction): Promise<void> {
    const member = await getMember(interaction);
    const operatorRoles = [
      ROLE_IDS.EVENT_LEADER,
      ROLE_IDS.EVENT_STAFF,
    ];
    if (!operatorRoles.some((roleId) => member.roles.cache.has(roleId))) {
      throw new Error(ROULETTE_MESSAGES.OPERATOR_ONLY);
    }
  }

  static async openRound(stage: RouletteStage): Promise<string> {
    const eventKey = getRouletteEventKey();
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [activeRounds] = await connection.execute<RouletteRoundRow[]>(
        `SELECT id FROM roulette_rounds
         WHERE event_key = ? AND status IN ('open', 'closed')
         FOR UPDATE`,
        [eventKey],
      );
      if (activeRounds.length > 0) {
        throw new Error("前のラウンドが未精算です。先に `/結果` で結果を確定してください。");
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO roulette_rounds (event_key, stage, status)
         VALUES (?, ?, 'open')`,
        [eventKey, stage],
      );
      await connection.commit();
      return `🎲 第${stage}部・第${result.insertId}ラウンドのベット受付を開始しました。`;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async closeRound(): Promise<string> {
    const eventKey = getRouletteEventKey();
    const connection = await DbService.getConnection();
    try {
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE roulette_rounds
         SET status = 'closed', closed_at = CURRENT_TIMESTAMP
         WHERE event_key = ? AND status = 'open'`,
        [eventKey],
      );
      if (result.affectedRows === 0) throw new Error("現在、締め切れる受付中のラウンドはありません。");
      return "🔒 ベット受付を締め切りました。結果は `/結果` で確定してください。";
    } finally {
      connection.release();
    }
  }

  static async getStatus(): Promise<string> {
    const eventKey = getRouletteEventKey();
    const connection = await DbService.getConnection();
    try {
      const [rounds] = await connection.execute<RouletteRoundRow[]>(
        `SELECT id, stage, status FROM roulette_rounds
         WHERE event_key = ? ORDER BY id DESC LIMIT 1`,
        [eventKey],
      );
      const round = rounds[0];
      if (!round) return "このイベントのルーレットラウンドはまだありません。";
      const [countRows] = await connection.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM roulette_bets WHERE round_id = ?",
        [round.id],
      );
      const statusLabel = round.status === "open" ? "受付中" : round.status === "closed" ? "締切済み" : "精算済み";
      return `第${round.stage}部・第${round.id}ラウンド：${statusLabel}（ベット ${countRows[0].count} 件）`;
    } finally {
      connection.release();
    }
  }

  static async showBetTypeSelect(interaction: ButtonInteraction, stage: RouletteStage): Promise<void> {
    await this.assertBettingOpen(stage);
    const options = getAllowedBetKinds(stage).map((kind) => ({
      label: ROULETTE_BET_LABELS[kind],
      value: kind,
      description:
        kind === "dozen" ? "1〜12・13〜24・25〜36（3倍）" :
        kind === "straight" ? "数字を1つ指定（36倍）" :
        kind === "split" ? "数字を2つ指定（18倍）" : "当たれば2倍",
    }));
    const select = new StringSelectMenuBuilder()
      .setCustomId(`rouletteBetSelect_${stage}`)
      .setPlaceholder("賭け方を選択してください")
      .addOptions(options);
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.editReply({
      content: `第${stage}部の賭け方を選択してください。確定後の賭け直しはできません。`,
      components: [row],
    });
  }

  private static async assertBettingOpen(stage: RouletteStage): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      const [rounds] = await connection.execute<RouletteRoundRow[]>(
        `SELECT id FROM roulette_rounds
         WHERE event_key = ? AND stage = ? AND status = 'open'
         ORDER BY id DESC LIMIT 1`,
        [getRouletteEventKey(), stage],
      );
      if (rounds.length === 0) {
        throw new Error(ROULETTE_MESSAGES.BETTING_NOT_OPEN_FOR_STAGE(stage));
      }
    } finally {
      connection.release();
    }
  }

  static async showBetAmountModal(
    interaction: StringSelectMenuInteraction,
    stage: RouletteStage,
    kind: RouletteBetKind,
  ): Promise<void> {
    if (!getAllowedBetKinds(stage).includes(kind)) {
      throw new Error("この部では選択できない賭け方です。");
    }
    const modal = new ModalBuilder()
      .setCustomId(`rouletteBetModal_${stage}_${kind}`)
      .setTitle(`第${stage}部：${ROULETTE_BET_LABELS[kind]}`);

    if (kind === "dozen") {
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("selection").setLabel("範囲（1-12 / 13-24 / 25-36）")
          .setStyle(TextInputStyle.Short).setPlaceholder("例: 13-24").setRequired(true).setMaxLength(5),
      ));
    } else if (kind === "straight") {
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("selection").setLabel("数字（1〜36）")
          .setStyle(TextInputStyle.Short).setPlaceholder("例: 13").setRequired(true).setMaxLength(2),
      ));
    } else if (kind === "split") {
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("selection").setLabel("二つの数字（1-36）")
          .setStyle(TextInputStyle.Short).setPlaceholder("例: 13-14").setRequired(true).setMaxLength(5),
      ));
    }
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("amount").setLabel(`賭け金（${CURRENCY_NAMES}）`)
        .setStyle(TextInputStyle.Short).setPlaceholder("例: 500").setRequired(true).setMaxLength(10),
    ));
    await interaction.showModal(modal);
  }

  static async showBetConfirmation(interaction: ModalSubmitInteraction): Promise<void> {
    const [, stageValue, kindValue] = interaction.customId.split("_");
    const stage = parseStage(stageValue);
    const kind = kindValue as RouletteBetKind;
    const selection = ["red", "black", "even", "odd"].includes(kind)
      ? kind
      : interaction.fields.getTextInputValue("selection").trim();
    const amount = Number(interaction.fields.getTextInputValue("amount").trim());
    validateRouletteBet(stage, kind, selection, amount);
    const bet: RouletteBet = { kind, selection, amount };
    const confirmId = `rouletteConfirm_${stage}_${kind}_${selection}_${amount}`;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("rouletteCancel").setLabel("キャンセル").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(confirmId).setLabel("この内容で確定").setStyle(ButtonStyle.Success),
    );
    const embed = new EmbedBuilder()
      .setTitle("ベット内容の確認")
      .setDescription(`賭け方：**${getBetLabel(bet)}**\n賭け金：**${amount.toLocaleString()}${CURRENCY_NAMES}**\n\n確定後の変更・取消はできません。`)
      .setColor(0xf0b90b);
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  static async placeBet(interaction: ButtonInteraction): Promise<string> {
    const eventKey = getRouletteEventKey();
    const { stage, kind, selection, amount } = parseConfirmId(interaction.customId);
    validateRouletteBet(stage, kind, selection, amount);
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [rounds] = await connection.execute<RouletteRoundRow[]>(
        `SELECT id, stage, status FROM roulette_rounds
         WHERE event_key = ? AND status = 'open'
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [eventKey],
      );
      const round = rounds[0];
      if (!round || round.stage !== stage) throw new Error(ROULETTE_MESSAGES.BETTING_CLOSED);

      const [existing] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM roulette_bets WHERE round_id = ? AND user_id = ? FOR UPDATE",
        [round.id, interaction.user.id],
      );
      if (existing.length > 0) throw new Error(ROULETTE_MESSAGES.ALREADY_BET);

      const [accounts] = await connection.execute<AccountRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE",
        [interaction.user.id],
      );
      const account = accounts[0];
      if (!account) throw new Error("口座が見つかりません。先に口座を開設してください。");
      if (account.wallet < amount) throw new Error("残高が不足しています。");

      const [botRows] = await connection.execute<AccountRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE",
        [BOT_ID],
      );
      if (!botRows[0]) throw new Error("Bot口座が見つかりません。DB初期化を確認してください。");
      const userAfterWallet = account.wallet - amount;
      const botAfterWallet = botRows[0].wallet + amount;
      await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [userAfterWallet, interaction.user.id]);
      await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [botAfterWallet, BOT_ID]);
      await connection.execute(
        `INSERT INTO roulette_bets (round_id, user_id, bet_kind, selection, amount)
         VALUES (?, ?, ?, ?, ?)`,
        [round.id, interaction.user.id, kind, selection, amount],
      );
      await this.insertActionLog(connection, ROULETTE_ACTION_NAMES.BET, amount, interaction.user.id, BOT_ID, userAfterWallet, botAfterWallet, `イベント:${eventKey} 第${stage}部 #${round.id} ${getBetLabel({ kind, selection })}`);
      await connection.commit();
      return `✅ 第${stage}部・第${round.id}ラウンドに **${getBetLabel({ kind, selection })}** へ **${amount.toLocaleString()}${CURRENCY_NAMES}** をベットしました。`;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async settleRound(result: number): Promise<RouletteSettlement> {
    const eventKey = getRouletteEventKey();
    if (!Number.isInteger(result) || result < 0 || result > 36) throw new Error("結果は0〜36の整数で指定してください。");
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [rounds] = await connection.execute<RouletteRoundRow[]>(
        `SELECT id, stage, status FROM roulette_rounds
         WHERE event_key = ? AND status IN ('open', 'closed')
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [eventKey],
      );
      const round = rounds[0];
      if (!round) throw new Error(ROULETTE_MESSAGES.NO_OPEN_ROUND);
      const [bets] = await connection.execute<RouletteBetRow[]>(
        "SELECT id, user_id, bet_kind, selection, amount FROM roulette_bets WHERE round_id = ? FOR UPDATE",
        [round.id],
      );
      const [botRows] = await connection.execute<AccountRow[]>("SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE", [BOT_ID]);
      if (!botRows[0]) throw new Error("Bot口座が見つかりません。DB初期化を確認してください。");
      let botWallet = botRows[0].wallet;
      const winners: RouletteSettlement["winners"] = [];
      for (const row of bets) {
        const bet: RouletteBet = { kind: row.bet_kind, selection: row.selection, amount: row.amount };
        const payout = calculateRoulettePayout(bet, result);
        await connection.execute(
          "UPDATE roulette_bets SET payout = ?, settled_at = CURRENT_TIMESTAMP WHERE id = ?",
          [payout, row.id],
        );
        if (payout === 0) continue;
        const [users] = await connection.execute<AccountRow[]>("SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE", [row.user_id]);
        if (!users[0]) throw new Error("参加者の口座が見つかりません。");
        const userAfterWallet = users[0].wallet + payout;
        botWallet -= payout;
        await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [userAfterWallet, row.user_id]);
        await this.insertActionLog(connection, ROULETTE_ACTION_NAMES.PAYOUT, payout, BOT_ID, row.user_id, botWallet, userAfterWallet, `イベント:${eventKey} 第${round.stage}部 #${round.id} 結果:${result} ${getBetLabel(bet)}`);
        winners.push({ userId: row.user_id, payout, bet });
      }
      await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [botWallet, BOT_ID]);
      await connection.execute(
        `UPDATE roulette_rounds
         SET status = 'settled', result_number = ?, closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP), settled_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [result, round.id],
      );
      await connection.commit();
      return { roundId: round.id, stage: round.stage, result, winners, betCount: bets.length };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async grantParticipationBonus(): Promise<number> {
    const eventKey = getRouletteEventKey();
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [participants] = await connection.execute<RowDataPacket[]>(
        `SELECT DISTINCT b.user_id
         FROM roulette_bets b
         INNER JOIN roulette_rounds r ON r.id = b.round_id
         WHERE r.event_key = ?`,
        [eventKey],
      );
      const [botRows] = await connection.execute<AccountRow[]>("SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE", [BOT_ID]);
      if (!botRows[0]) throw new Error("Bot口座が見つかりません。DB初期化を確認してください。");
      let botWallet = botRows[0].wallet;
      let paidCount = 0;
      for (const participant of participants) {
        const userId = String(participant.user_id);
        const [reward] = await connection.execute<ResultSetHeader>(
          "INSERT IGNORE INTO roulette_participation_rewards (event_key, user_id, amount) VALUES (?, ?, ?)",
          [eventKey, userId, ROULETTE_PARTICIPATION_BONUS],
        );
        if (reward.affectedRows === 0) continue;
        const [users] = await connection.execute<AccountRow[]>("SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE", [userId]);
        if (!users[0]) throw new Error("参加者の口座が見つかりません。");
        const userAfterWallet = users[0].wallet + ROULETTE_PARTICIPATION_BONUS;
        botWallet -= ROULETTE_PARTICIPATION_BONUS;
        await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [userAfterWallet, userId]);
        await this.insertActionLog(connection, ROULETTE_ACTION_NAMES.BONUS, ROULETTE_PARTICIPATION_BONUS, BOT_ID, userId, botWallet, userAfterWallet, `イベント:${eventKey} 参加ボーナス`);
        paidCount += 1;
      }
      await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [botWallet, BOT_ID]);
      await connection.commit();
      return paidCount;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static createSettlementEmbed(settlement: RouletteSettlement): EmbedBuilder {
    const winnerLines = settlement.winners.length === 0
      ? "当選者はいません。"
      : settlement.winners.map((winner) => `<@${winner.userId}>：${getBetLabel(winner.bet)} → **${winner.payout.toLocaleString()}${CURRENCY_NAMES}**`).join("\n");
    return new EmbedBuilder()
      .setTitle(`🎰 第${settlement.stage}部・第${settlement.roundId}ラウンド 結果`)
      .setDescription(`結果：**${settlement.result}**${settlement.result === 0 ? "（緑の0：全ベット没収）" : ""}\nベット数：${settlement.betCount}件\n\n**当選・配当**\n${winnerLines}`)
      .setColor(settlement.result === 0 ? 0x168c4a : 0xf0b90b);
  }

  private static async insertActionLog(
    connection: Awaited<ReturnType<typeof DbService.getConnection>>,
    commandName: string,
    amount: number,
    fromUserId: string,
    toUserId: string,
    fromAfterWallet: number,
    toAfterWallet: number,
    comment: string,
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO actions
       (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [commandName, amount, fromUserId, toUserId, fromAfterWallet, toAfterWallet, comment],
    );
  }
}
