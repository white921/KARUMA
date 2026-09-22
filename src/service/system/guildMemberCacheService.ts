import { Client, Collection, Guild, GuildMember } from "discord.js";
import {
  GUILD_MEMBER_FETCH_INTERVAL_MS,
  GUILD_MEMBER_FETCH_MAX_ATTEMPTS,
  GUILD_MEMBER_FETCH_RETRY_MARGIN_MS,
} from "../../constant/system/guildMemberCache";
import type { GuildMemberCacheState } from "../../type/system/guildMemberCache";

/** 全件取得は初回・復旧時だけ。通常の更新は discord.js のメンバーキャッシュに任せる。 */
export class GuildMemberCacheService {
  private static states = new WeakMap<Guild, GuildMemberCacheState>();
  private static blockedShards = new WeakMap<Client, Set<number>>();

  private static state(guild: Guild): GuildMemberCacheState {
    let state = this.states.get(guild);
    if (!state) {
      state = { ready: false, generation: 0, nextFetchAt: 0, added: new Set(), removed: new Set() };
      this.states.set(guild, state);
    }
    return state;
  }

  private static invalidate(guild: Guild): void {
    const state = this.state(guild);
    state.ready = false;
    state.generation++;
  }

  private static assertAvailable(guild: Guild): void {
    if (!guild.available || this.blockedShards.get(guild.client)?.has(guild.shardId)) {
      throw new Error("メンバー情報を再接続中です。少し待ってからもう一度お試しください。");
    }
  }

  static async getMembers(guild: Guild): Promise<Collection<string, GuildMember>> {
    this.assertAvailable(guild);
    const state = this.state(guild);
    if (state.ready) return guild.members.cache.clone();
    if (state.pending) {
      const generation = state.pendingGeneration;
      try {
        await state.pending;
      } catch (error) {
        if (generation === state.generation) throw error;
      }
      return this.getMembers(guild);
    }

    const generation = state.generation;
    state.pendingGeneration = generation;
    state.pending = this.fetchMembers(guild, state, generation);
    try {
      await state.pending;
    } finally {
      state.pending = undefined;
      state.pendingGeneration = undefined;
    }
    return this.getMembers(guild);
  }

  private static async fetchMembers(guild: Guild, state: GuildMemberCacheState, generation: number): Promise<void> {
    // デプロイ直後に旧プロセスの取得と重なった場合も、Discord の待機時間を守って再試行する。
    for (let attempt = 0; attempt < GUILD_MEMBER_FETCH_MAX_ATTEMPTS; attempt++) {
      const delay = state.nextFetchAt - Date.now();
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      this.assertAvailable(guild);
      if (generation !== state.generation) return;
      state.added.clear();
      state.removed.clear();
      state.nextFetchAt = Date.now() + GUILD_MEMBER_FETCH_INTERVAL_MS;
      try {
        const fetched = await guild.members.fetch();
        this.assertAvailable(guild);
        if (generation !== state.generation) return;
        // 全件取得は既存キャッシュの退会者を消さないため、取得中の参加・退出も考慮して照合する。
        for (const id of guild.members.cache.keys()) {
          if (state.removed.has(id) || (!fetched.has(id) && !state.added.has(id))) {
            guild.members.cache.delete(id);
          }
        }
        state.ready = true;
        console.log(`[MemberCache] ready guild=${guild.id} members=${guild.members.cache.size}`);
        return;
      } catch (error) {
        const data = (error as { data?: { opcode?: number; retry_after?: number } })?.data;
        if (data?.opcode !== 8 || typeof data.retry_after !== "number" || !Number.isFinite(data.retry_after) || data.retry_after < 0) {
          throw error;
        }
        state.nextFetchAt = Math.max(state.nextFetchAt,
          Date.now() + Math.ceil(data.retry_after * 1000) + GUILD_MEMBER_FETCH_RETRY_MARGIN_MS);
        if (attempt === GUILD_MEMBER_FETCH_MAX_ATTEMPTS - 1) throw error;
        console.warn(`[MemberCache] rate limited guild=${guild.id}; waiting before retry`);
      }
    }
  }

  static install(client: Client): void {
    if (this.blockedShards.has(client)) return;
    const blocked = new Set<number>();
    this.blockedShards.set(client, blocked);
    const guilds = (shardId: number) => client.guilds.cache.filter(guild => guild.shardId === shardId);
    const warm = (guild: Guild) => {
      if (!guild.available || blocked.has(guild.shardId)) return;
      void this.getMembers(guild).catch(error => console.error(`[MemberCache] initialization failed guild=${guild.id}`, error));
    };
    const disconnect = (shardId: number) => {
      blocked.add(shardId);
      for (const guild of guilds(shardId).values()) {
        // 完了済みのキャッシュは RESUMED のイベント再送で復元できる。取得途中だけやり直す。
        if (this.state(guild).pending) this.invalidate(guild);
      }
    };
    client.on("shardDisconnect", (_, shardId) => disconnect(shardId));
    client.on("shardReconnecting", disconnect);
    client.on("raw", (packet, shardId) => {
      if (packet.t === "READY") {
        blocked.add(shardId);
        for (const guild of guilds(shardId).values()) this.invalidate(guild);
      } else if (packet.t === "GUILD_MEMBER_ADD" || packet.t === "GUILD_MEMBER_REMOVE") {
        const guild = client.guilds.cache.get(packet.d.guild_id);
        if (!guild) return;
        const state = this.state(guild);
        if (!state.pending) return;
        // 未取得メンバーの退出では guildMemberRemove が発火しないため、生の通知で追跡する。
        const id = packet.d.user.id;
        if (packet.t === "GUILD_MEMBER_ADD") {
          state.added.add(id);
          state.removed.delete(id);
        } else {
          state.removed.add(id);
          state.added.delete(id);
        }
      }
    });
    const connected = (shardId: number) => {
      blocked.delete(shardId);
      for (const guild of guilds(shardId).values()) warm(guild);
    };
    client.on("shardReady", connected);
    client.on("shardResume", connected);
    client.once("clientReady", () => client.guilds.cache.forEach(warm));
    client.on("guildCreate", warm);
    client.on("guildUnavailable", guild => this.invalidate(guild));
    client.on("guildAvailable", guild => { this.invalidate(guild); warm(guild); });
    client.on("guildDelete", guild => this.invalidate(guild));
  }
}
