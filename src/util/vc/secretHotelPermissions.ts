import { OverwriteType, PermissionsBitField } from "discord.js";
import type { PermissionResolvable } from "discord.js";
import { HOTEL_PARTICIPANT_PERMISSIONS } from "../../constant/hotel/hotel";
import { ROLE_IDS } from "../../constant/shared/id";

export const SECRET_HOTEL_HIDDEN_ROLE_IDS = [
  ROLE_IDS.CORE_MEMBER_ROLES.HONMEN,
  ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN,
  ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN,
  ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN,
  ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN,
  ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI,
  ROLE_IDS.DETENTION_ROLES.SUMMONED_CRIME,
] as const;

type SourceOverwrite = {
  id: string;
  type: OverwriteType;
  allow: PermissionResolvable;
  deny: PermissionResolvable;
};

/** カテゴリ由来の閲覧許可を除き、参加者だけを個別に許可する。管理者権限はDiscord側の例外。 */
export function createSecretHotelPermissionOverwrites(
  guildId: string,
  botId: string,
  participantIds: readonly string[],
  sourceOverwrites: Iterable<SourceOverwrite> = [],
) {
  const view = PermissionsBitField.Flags.ViewChannel;
  const overwrites = new Map<string, { id: string; type: OverwriteType; allow: bigint; deny: bigint }>();
  for (const source of sourceOverwrites) {
    overwrites.set(source.id, {
      id: source.id,
      type: source.type,
      allow: PermissionsBitField.resolve(source.allow) & ~view,
      deny: PermissionsBitField.resolve(source.deny) | view,
    });
  }
  for (const id of [guildId, ...SECRET_HOTEL_HIDDEN_ROLE_IDS]) {
    const existing = overwrites.get(id);
    overwrites.set(id, { id, type: OverwriteType.Role, allow: (existing?.allow ?? 0n) & ~view, deny: (existing?.deny ?? 0n) | view });
  }
  const participantAllow = PermissionsBitField.resolve(HOTEL_PARTICIPANT_PERMISSIONS);
  const participantDeny = PermissionsBitField.Flags.UseExternalEmojis |
    PermissionsBitField.Flags.UseExternalStickers | PermissionsBitField.Flags.UseExternalSounds;
  for (const id of new Set(participantIds)) {
    const existing = overwrites.get(id);
    overwrites.set(id, {
      id, type: OverwriteType.Member,
      allow: ((existing?.allow ?? 0n) | participantAllow) & ~participantDeny,
      deny: ((existing?.deny ?? 0n) & ~participantAllow) | participantDeny,
    });
  }
  // VCへの案内送信・期限切れ削除を行うBot自身のアクセスを確保する。
  const bot = overwrites.get(botId);
  overwrites.set(botId, { id: botId, type: OverwriteType.Member, allow: (bot?.allow ?? 0n) | view, deny: (bot?.deny ?? 0n) & ~view });
  return [...overwrites.values()];
}
