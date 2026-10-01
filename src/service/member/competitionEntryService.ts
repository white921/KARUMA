import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { COLOR } from "../../constant/shared/color";
import {
  COMPETITION_DISCIPLINES,
  COMPETITION_ENTRY_ACTIONS,
  COMPETITION_ENTRY_INPUT_IDS,
  COMPETITION_ENTRY_PREFIX,
  competitionEntryCustomId,
  isCompetitionDisciplineKey,
  type CompetitionDisciplineKey,
} from "../../constant/member/competitionEntry";
import { TEAM_ASSIGNMENTS } from "../../constant/member/teamAssignment";
import type {
  CompetitionAvailability,
  CompetitionEntry,
  CompetitionTeam,
} from "../../type/member/competitionEntry";
import { CompetitionEntryStore } from "./competitionEntryStore";

const AVAILABILITY_LABELS: Record<CompetitionAvailability, string> = {
  available: "出場できる",
  conditional: "条件付き・要相談",
  unavailable: "出場できない",
};

type RoleHolder = {
  roles: { cache: { has(roleId: string): boolean } };
};

function getTeam(member: RoleHolder): CompetitionTeam {
  const red = member.roles.cache.has(TEAM_ASSIGNMENTS.red.roleId);
  const blue = member.roles.cache.has(TEAM_ASSIGNMENTS.blue.roleId);
  if (red === blue) {
    throw new Error(
      red
        ? "所属チームを1つに決めてから回答してください。"
        : "先に対抗戦の所属チームを決めてから回答してください。",
    );
  }
  return red ? "red" : "blue";
}

export function parseCompetitionAvailability(
  rawValue: string,
): CompetitionAvailability {
  const value = rawValue.normalize("NFKC").trim().toLowerCase();
  const available = new Set([
    "出場できる", "出れる", "出場可", "参加可能", "可能", "可", "○", "o",
  ]);
  const conditional = new Set([
    "条件付き", "条件付き・要相談", "要相談", "相談", "△",
  ]);
  const unavailable = new Set([
    "出場できない", "出れない", "出場不可", "参加不可", "不可", "×", "x",
  ]);

  if (available.has(value)) return "available";
  if (conditional.has(value)) return "conditional";
  if (unavailable.has(value)) return "unavailable";
  throw new Error(
    "出場可否は「出場できる」「条件付き」「出場できない」のいずれかで入力してください。",
  );
}

function parseDisciplineCustomId(
  customId: string,
  expectedAction: "edit" | "modal",
): CompetitionDisciplineKey {
  const [prefix, action, discipline, extra] = customId.split(":");
  if (
    prefix !== COMPETITION_ENTRY_PREFIX ||
    action !== expectedAction ||
    extra !== undefined ||
    !isCompetitionDisciplineKey(discipline)
  ) {
    throw new Error("競技の回答情報が不正です。パネルからやり直してください。");
  }
  return discipline;
}

function optionalField(
  interaction: ModalSubmitInteraction,
  fieldId: string,
): string {
  return interaction.fields.fields.has(fieldId)
    ? interaction.fields.getTextInputValue(fieldId).normalize("NFC").trim()
    : "";
}

function textInput(
  customId: string,
  label: string,
  options: {
    value?: string;
    placeholder?: string;
    required?: boolean;
    maxLength?: number;
    style?: TextInputStyle;
  } = {},
): ActionRowBuilder<TextInputBuilder> {
  const input = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(options.style ?? TextInputStyle.Short)
    .setRequired(options.required ?? false)
    .setMaxLength(options.maxLength ?? 100);
  if (options.value) input.setValue(options.value);
  if (options.placeholder) input.setPlaceholder(options.placeholder);
  return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
}

function formatEntry(entry: CompetitionEntry | undefined): string {
  if (!entry) return "**未回答**";
  const lines = [`出場可否：**${AVAILABILITY_LABELS[entry.availability]}**`];
  if (entry.rankName) lines.push(`ランク・段位：${entry.rankName}`);
  if (entry.gameName) lines.push(`ゲーム内ネーム等：${entry.gameName}`);
  if (entry.gameId) lines.push(`ID：${entry.gameId}`);
  if (entry.notes) lines.push(`備考：${entry.notes}`);
  return lines.join("\n");
}

function csvCell(value: unknown): string {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

export function createCompetitionEntriesCsv(entries: CompetitionEntry[]): Buffer {
  const header = [
    "チーム", "表示名", "DiscordユーザーID", "競技", "出場可否",
    "ランク・段位", "ゲーム内ネーム等", "ゲームID", "備考", "最終更新",
  ];
  const rows = entries.map((entry) => {
    const discipline = isCompetitionDisciplineKey(entry.discipline)
      ? COMPETITION_DISCIPLINES[entry.discipline].label
      : entry.discipline;
    const updatedAt = entry.updatedAt
      ? new Date(entry.updatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
      : "";
    return [
      entry.team === "red" ? "紅組" : "蒼組",
      entry.displayName,
      entry.userId,
      discipline,
      AVAILABILITY_LABELS[entry.availability],
      entry.rankName,
      entry.gameName,
      entry.gameId,
      entry.notes,
      updatedAt,
    ];
  });
  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  return Buffer.from(`\uFEFF${csv}`, "utf8");
}

export class CompetitionEntryService {
  static isButton(customId: string): boolean {
    return customId.startsWith(`${COMPETITION_ENTRY_PREFIX}:`);
  }

  static isModal(customId: string): boolean {
    return customId.startsWith(`${COMPETITION_ENTRY_PREFIX}:modal:`);
  }

  static isModalOpeningButton(customId: string): boolean {
    return customId.startsWith(`${COMPETITION_ENTRY_PREFIX}:edit:`);
  }

  static async handleButton(interaction: ButtonInteraction): Promise<void> {
    if (interaction.customId === COMPETITION_ENTRY_ACTIONS.OPEN) {
      await this.showEditor(interaction);
      return;
    }
    if (interaction.customId === COMPETITION_ENTRY_ACTIONS.REVIEW) {
      await this.showReview(interaction);
      return;
    }
    if (this.isModalOpeningButton(interaction.customId)) {
      await this.showDisciplineModal(interaction);
      return;
    }
    throw new Error("この競技エントリー操作は利用できません。");
  }

  static async showEditor(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) throw new Error("サーバー内でのみ回答できます。");
    const [member, entries] = await Promise.all([
      interaction.guild.members.fetch(interaction.user.id),
      CompetitionEntryStore.findByUser(interaction.user.id),
    ]);
    getTeam(member);
    const answered = new Set(entries.map((entry) => entry.discipline));
    const buttons = Object.entries(COMPETITION_DISCIPLINES).map(
      ([key, discipline]) =>
        new ButtonBuilder()
          .setCustomId(
            competitionEntryCustomId("edit", key as CompetitionDisciplineKey),
          )
          .setLabel(`${answered.has(key) ? "✓ " : ""}${discipline.label}`)
          .setStyle(answered.has(key) ? ButtonStyle.Success : ButtonStyle.Secondary),
    );
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let index = 0; index < buttons.length; index += 3) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          buttons.slice(index, index + 3),
        ),
      );
    }
    await interaction.editReply({
      content:
        "回答・編集する競技を選んでください。回答済みの競技には ✓ が付きます。\n" +
        "出場可否だけでも保存でき、同じ競技は何度でも編集できます。",
      components: rows,
      embeds: [],
    });
  }

  static async showDisciplineModal(
    interaction: ButtonInteraction,
  ): Promise<void> {
    const disciplineKey = parseDisciplineCustomId(interaction.customId, "edit");
    if (!interaction.guild) throw new Error("サーバー内でのみ回答できます。");
    const [member, entries] = await Promise.all([
      interaction.guild.members.fetch(interaction.user.id),
      CompetitionEntryStore.findByUser(interaction.user.id),
    ]);
    getTeam(member);
    const existing = entries.find((entry) => entry.discipline === disciplineKey);
    const discipline = COMPETITION_DISCIPLINES[disciplineKey];
    const rows: ActionRowBuilder<TextInputBuilder>[] = [
      textInput(
        COMPETITION_ENTRY_INPUT_IDS.AVAILABILITY,
        "出場可否",
        {
          value: existing ? AVAILABILITY_LABELS[existing.availability] : undefined,
          placeholder: "出場できる / 条件付き / 出場できない",
          required: true,
          maxLength: 20,
        },
      ),
    ];
    if (discipline.rankLabel) {
      rows.push(
        textInput(COMPETITION_ENTRY_INPUT_IDS.RANK, discipline.rankLabel, {
          value: existing?.rankName,
          placeholder:
            "rankPlaceholder" in discipline
              ? discipline.rankPlaceholder
              : "例：ゴールド、マスター",
          maxLength: 64,
        }),
      );
    }
    if (discipline.gameNameLabel) {
      rows.push(
        textInput(
          COMPETITION_ENTRY_INPUT_IDS.GAME_NAME,
          discipline.gameNameLabel,
          {
            value: existing?.gameName,
            placeholder: discipline.gameNamePlaceholder,
            maxLength: 64,
          },
        ),
      );
    }
    if (discipline.gameIdLabel) {
      rows.push(
        textInput(
          COMPETITION_ENTRY_INPUT_IDS.GAME_ID,
          discipline.gameIdLabel,
          { value: existing?.gameId, maxLength: 100 },
        ),
      );
    }
    if (rows.length < 5) {
      rows.push(
        textInput(COMPETITION_ENTRY_INPUT_IDS.NOTES, discipline.notesLabel, {
          value: existing?.notes,
          maxLength: 200,
          style: TextInputStyle.Paragraph,
        }),
      );
    }

    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(competitionEntryCustomId("modal", disciplineKey))
        .setTitle(`${discipline.label}の回答`)
        .addComponents(rows),
    );
  }

  static async submit(interaction: ModalSubmitInteraction): Promise<void> {
    const discipline = parseDisciplineCustomId(interaction.customId, "modal");
    if (!interaction.guild) throw new Error("サーバー内でのみ回答できます。");
    const availability = parseCompetitionAvailability(
      interaction.fields.getTextInputValue(COMPETITION_ENTRY_INPUT_IDS.AVAILABILITY),
    );
    let gameName = optionalField(
      interaction,
      COMPETITION_ENTRY_INPUT_IDS.GAME_NAME,
    );
    if (discipline === "singing" && gameName) {
      const normalizedCategory = gameName.normalize("NFKC").trim();
      if (["男", "男性", "♂"].includes(normalizedCategory)) gameName = "♂";
      else if (["女", "女性", "♀"].includes(normalizedCategory)) gameName = "♀";
      else throw new Error("歌の出場区分は「♂」または「♀」で入力してください。");
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const entry: CompetitionEntry = {
      userId: interaction.user.id,
      displayName: member.displayName,
      team: getTeam(member),
      discipline,
      availability,
      rankName: optionalField(interaction, COMPETITION_ENTRY_INPUT_IDS.RANK),
      gameName,
      gameId: optionalField(interaction, COMPETITION_ENTRY_INPUT_IDS.GAME_ID),
      notes: optionalField(interaction, COMPETITION_ENTRY_INPUT_IDS.NOTES),
    };
    await CompetitionEntryStore.upsert(entry);
    await interaction.editReply({
      content:
        `✅ **${COMPETITION_DISCIPLINES[discipline].label}**の回答を保存しました。\n` +
        `出場可否：**${AVAILABILITY_LABELS[availability]}**`,
    });
  }

  static async showReview(interaction: ButtonInteraction): Promise<void> {
    const entries = await CompetitionEntryStore.findByUser(interaction.user.id);
    const byDiscipline = new Map(
      entries.map((entry) => [entry.discipline, entry]),
    );
    const embed = new EmbedBuilder()
      .setTitle("競技エントリー回答確認")
      .setColor(COLOR.COBALT_GREEN)
      .setDescription(
        "現在保存されているあなたの回答です。変更する場合は「回答・編集」から競技を選んでください。",
      )
      .addFields(
        Object.entries(COMPETITION_DISCIPLINES).map(([key, discipline]) => ({
          name: `${discipline.label}｜${discipline.capacity}`,
          value: formatEntry(byDiscipline.get(key)),
          inline: false,
        })),
      );
    await interaction.editReply({ content: "", embeds: [embed], components: [] });
  }

  static async exportForLeader(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    if (!interaction.guild) throw new Error("サーバー内でのみ使用できます。");
    const leaderTeam = (Object.entries(TEAM_ASSIGNMENTS) as Array<
      [CompetitionTeam, (typeof TEAM_ASSIGNMENTS)[CompetitionTeam]]
    >).find(([, assignment]) =>
      assignment.captainUserId === interaction.user.id ||
      assignment.viceCaptainUserId === interaction.user.id,
    )?.[0];
    if (!leaderTeam) {
      throw new Error("このコマンドは紅組・蒼組の大将または副大将のみ使用できます。");
    }
    const entries = await CompetitionEntryStore.findByTeam(leaderTeam);
    const teamLabel = leaderTeam === "red" ? "紅組" : "蒼組";
    const file = new AttachmentBuilder(createCompetitionEntriesCsv(entries), {
      name: `双璧戦_競技回答_${teamLabel}.csv`,
      description: `${teamLabel}のGoogleスプレッドシート取込用回答一覧`,
    });
    await interaction.editReply({
      content:
        `**${teamLabel}**の回答を出力しました（${entries.length}件）。\n` +
        "Googleスプレッドシートで「ファイル → インポート → アップロード」から読み込めます。",
      files: [file],
    });
  }
}
