export type CompetitionTeam = "red" | "blue";

export type CompetitionAvailability =
  | "available"
  | "conditional"
  | "unavailable";

export type CompetitionRoleRank = {
  tier: string;
  division: string;
};

export type CompetitionRankDetails = Record<string, CompetitionRoleRank>;

export type CompetitionGameDetails = {
  minecraftRoles?: string[];
};

export type CompetitionEntry = {
  userId: string;
  displayName: string;
  team: CompetitionTeam;
  discipline: string;
  availability: CompetitionAvailability;
  rankName: string;
  rankDivision: string;
  rankDetails?: CompetitionRankDetails;
  gameDetails?: CompetitionGameDetails;
  gameName: string;
  gameId: string;
  notes: string;
  updatedAt?: Date | string;
};

export type CompetitionEntryProfile = {
  userId: string;
  displayName: string;
  team: CompetitionTeam;
  day1Availability: CompetitionAvailability;
  day2Availability: CompetitionAvailability;
  day3Availability: CompetitionAvailability;
  overallNotes: string;
  updatedAt?: Date | string;
};
