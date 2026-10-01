import type { RowDataPacket } from "mysql2";
import { DbService } from "../system/dbService";
import type {
  CompetitionEntry,
  CompetitionTeam,
} from "../../type/member/competitionEntry";

type CompetitionEntryRow = RowDataPacket & {
  user_id: string;
  display_name: string;
  team_key: CompetitionTeam;
  discipline: string;
  availability: CompetitionEntry["availability"];
  rank_name: string | null;
  game_name: string | null;
  game_id: string | null;
  notes: string | null;
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
    gameName: row.game_name ?? "",
    gameId: row.game_id ?? "",
    notes: row.notes ?? "",
    updatedAt: row.updated_at,
  };
}

export class CompetitionEntryStore {
  static async findByUser(userId: string): Promise<CompetitionEntry[]> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.query<CompetitionEntryRow[]>(
        `SELECT user_id, display_name, team_key, discipline, availability,
                rank_name, game_name, game_id, notes, updated_at
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
           rank_name, game_name, game_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           team_key = VALUES(team_key),
           availability = VALUES(availability),
           rank_name = VALUES(rank_name),
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
                rank_name, game_name, game_id, notes, updated_at
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
}
