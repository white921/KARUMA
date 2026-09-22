export type GuildMemberCacheState = {
  ready: boolean;
  generation: number;
  nextFetchAt: number;
  pending?: Promise<void>;
  pendingGeneration?: number;
  added: Set<string>;
  removed: Set<string>;
};
