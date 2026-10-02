import type { RowDataPacket } from "mysql2";
import { DbService } from "../system/dbService";
import type {
  CompetitionEntry,
  CompetitionGameDetails,
  CompetitionEntryProfile,
  CompetitionRankDetails,
  CompetitionTeam,
} from "../../type/member/competitionEntry";

type CompetitionEntryRow = RowDataPacket & {
  user_id: string;
  display_name: string;
  team_key: CompetitionTeam;
  discipline: string;
  availability: CompetitionEntry["availability"];
  rank_name: string | null;
  rank_division: string | null;
  rank_details: CompetitionRankDetails | string | null;
  game_details: CompetitionGameDetails | string | null;
  game_name: string | null;
  game_id: string | null;
  notes: string | null;
  updated_at: Date;
};

function parseRankDetails(
  value: CompetitionEntryRow["rank_details"],
): CompetitionRankDetails {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseGameDetails(
  value: CompetitionEntryRow["game_details"],
): CompetitionGameDetails {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

type CompetitionEntryProfileRow = RowDataPacket & {
  user_id: string;
  display_name: string;
  team_key: CompetitionTeam;
  day1_availability: CompetitionEntryProfile["day1Availability"];
  day2_availability: CompetitionEntryProfile["day2Availability"];
  day3_availability: CompetitionEntryProfile["day3Availability"];
  overall_notes: string | null;
  updated_at: Date;
};

function fromRow(row: CompetitionEntryRow): CompetitionEntry {
  return {
    userId: String(row.user_id),
    displayName: row.display_name,
    team: row.team_key,
    discipline: row.discipline,
    availability: row.availability,
    rankName: row.rank_name ?? "",
    rankDivision: row.rank_division ?? "",
    rankDetails: parseRankDetails(row.rank_details),
    gameDetails: parseGameDetails(row.game_details),
    gameName: row.game_name ?? "",
    gameId: row.game_id ?? "",
    notes: row.notes ?? "",
    updatedAt: row.updated_at,
  };
}

function profileFromRow(row: CompetitionEntryProfileRow): CompetitionEntryProfile {
  return {
    userId: String(row.user_id),
    displayName: row.display_name,
    team: row.team_key,
    day1Availability: row.day1_availability,
    day2Availability: row.day2_availability,
    day3Availability: row.day3_availability,
    overallNotes: row.overall_notes ?? "",
    updatedAt: row.updated_at,
  };
}

export class CompetitionEntryStore {
  static async findProfileByUser(
    userId: string,
  ): Promise<CompetitionEntryProfile | undefined> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.query<CompetitionEntryProfileRow[]>(
        `SELECT user_id, display_name, team_key, day1_availability,
                day2_availability, day3_availability, overall_notes, updated_at
           FROM competition_entry_profiles
          WHERE user_id = ?`,
        [userId],
      );
      return rows[0] ? profileFromRow(rows[0]) : undefined;
    } finally {
      connection.release();
    }
  }

  static async upsertProfile(profile: CompetitionEntryProfile): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `INSERT INTO competition_entry_profiles
          (user_id, display_name, team_key, day1_availability,
           day2_availability, day3_availability, overall_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           team_key = VALUES(team_key),
           day1_availability = VALUES(day1_availability),
           day2_availability = VALUES(day2_availability),
           day3_availability = VALUES(day3_availability),
           overall_notes = VALUES(overall_notes)`,
        [
          profile.userId,
          profile.displayName,
          profile.team,
          profile.day1Availability,
          profile.day2Availability,
          profile.day3Availability,
          profile.overallNotes || null,
        ],
      );
    } finally {
      connection.release();
    }
  }

  static async findByUser(userId: string): Promise<CompetitionEntry[]> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.query<CompetitionEntryRow[]>(
        `SELECT user_id, display_name, team_key, discipline, availability,
                rank_name, rank_division, rank_details, game_details,
                game_name, game_id, notes, updated_at
           FROM competition_entries
          WHERE user_id = ?`,
        [userId],
      );
      return rows.map(fromRow);
    } finally {
      connection.release();
    }
  }

  static async upsert(entry: CompetitionEntry): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `INSERT INTO competition_entries
          (user_id, display_name, team_key, discipline, availability,
           rank_name, rank_division, rank_details, game_details,
           game_name, game_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           team_key = VALUES(team_key),
           availability = VALUES(availability),
           rank_name = VALUES(rank_name),
           rank_division = VALUES(rank_division),
           rank_details = VALUES(rank_details),
           game_details = VALUES(game_details),
           game_name = VALUES(game_name),
           game_id = VALUES(game_id),
           notes = VALUES(notes)`,
        [
          entry.userId,
          entry.displayName,
          entry.team,
          entry.discipline,
          entry.availability,
          entry.rankName || null,
          entry.rankDivision || null,
          entry.rankDetails && Object.keys(entry.rankDetails).length > 0
            ? JSON.stringify(entry.rankDetails)
            : null,
          entry.gameDetails && Object.keys(entry.gameDetails).length > 0
            ? JSON.stringify(entry.gameDetails)
            : null,
          entry.gameName || null,
          entry.gameId || null,
          entry.notes || null,
        ],
      );
    } finally {
      connection.release();
    }
  }

  static async findByTeam(team: CompetitionTeam): Promise<CompetitionEntry[]> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.query<CompetitionEntryRow[]>(
        `SELECT user_id, display_name, team_key, discipline, availability,
                rank_name, rank_division, rank_details, game_details,
                game_name, game_id, notes, updated_at
           FROM competition_entries
          WHERE team_key = ?
          ORDER BY display_name ASC, discipline ASC`,
        [team],
      );
      return rows.map(fromRow);
    } finally {
      connection.release();
    }
  }

  static async findProfilesByTeam(
    team: CompetitionTeam,
  ): Promise<CompetitionEntryProfile[]> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.query<CompetitionEntryProfileRow[]>(
        `SELECT user_id, display_name, team_key, day1_availability,
                day2_availability, day3_availability, overall_notes, updated_at
           FROM competition_entry_profiles
          WHERE team_key = ?
          ORDER BY display_name ASC`,
        [team],
      );
      return rows.map(profileFromRow);
    } finally {
      connection.release();
    }
  }
}
