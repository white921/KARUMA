export type CompetitionTeam = "red" | "blue";

export type CompetitionAvailability =
  | "available"
  | "conditional"
  | "unavailable";

export type CompetitionEntry = {
  userId: string;
  displayName: string;
  team: CompetitionTeam;
  discipline: string;
  availability: CompetitionAvailability;
  rankName: string;
  gameName: string;
  gameId: string;
  notes: string;
  updatedAt?: Date | string;
};
