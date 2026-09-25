import type { GuildMember } from "discord.js";
import { ROLE_IDS } from "../../constant/shared/id";
import { ITEM_KEY } from "../../constant/inventory/item";
import { AUDIO_PRIZE_PROHIBITION_NOTICE, GENERAL_INQUIRY_CHANNEL_MENTION, MARKET_TICKET_GUIDANCE } from "../../constant/market/marketGacha";
import type { MarketGachaAudioAsset, MarketGachaPrize } from "../../type/market/marketGacha";

type MemberRoles = Pick<GuildMember, "roles">;

export function isSageOrHigherPerformer(member: MemberRoles): boolean {
  return [ROLE_IDS.CORE_MEMBER_ROLES.HONMEN, ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN,
    ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN, ROLE_IDS.SABANUSI, ROLE_IDS.KANRISYA]
    .some(id => member.roles.cache.has(id));
}

/** 当選した5%枠だけを身分に応じて置き換える。罪人は他の身分ロールより優先。 */
export function resolveMarketGachaPrize(prize: MarketGachaPrize, member: MemberRoles): MarketGachaPrize {
  if (prize.key !== "detention_pass_3_days") return prize;
  const has = (id: string) => member.roles.cache.has(id);
  if ([ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI, ...Object.values(ROLE_IDS.DETENTION_ROLES)].some(has)) {
    return { ...prize, key: "solitary_cell_free_1", label: "独房無料チケット1枚", itemKey: ITEM_KEY.SOLITARY_CELL_FREE, quantity: 1 };
  }
  if ([ROLE_IDS.CORE_MEMBER_ROLES.HONMEN, ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN, ROLE_IDS.SABANUSI, ROLE_IDS.KANRISYA].some(has)) return prize;
  if ([ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN, ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN].some(has)) {
    return { ...prize, key: "normal_hotel_free_1", label: "通常ホテル無料券1枚", itemKey: ITEM_KEY.HOTEL_NORMAL_FREE, quantity: 1 };
  }
  if (has(ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN)) {
    return { ...prize, key: "hazama_free_3", label: "辺境の狭間無料チケット3枚", itemKey: ITEM_KEY.HAZAMA_FREE, quantity: 3 };
  }
  throw new Error("身分ロールを確認できません。運営へお問い合わせください。料金は消費していません。");
}

export function performerMention(asset: MarketGachaAudioAsset): string {
  return asset.performerUserId ? `<@${asset.performerUserId}>` : `**${asset.performerName}**`;
}

export function marketGachaInstructions(prize: MarketGachaPrize, audioAsset?: MarketGachaAudioAsset): string {
  const guidance = `ご利用の際は${MARKET_TICKET_GUIDANCE}`;
  const nominees = `<@&${ROLE_IDS.CORE_MEMBER_ROLES.HONMEN}> <@&${ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN}> <@&${ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN}>`;
  if (audioAsset) {
    return `${performerMention(audioAsset)}の${prize.audioCategory === "superchat" ? "サプボ" : "歌みた"}です！\nファイルURLをDMにて送信したのでご確認ください。\n\n${AUDIO_PRIZE_PROHIBITION_NOTICE}`;
  }
  switch (prize.key) {
    case "superchat": case "song_cover": throw new Error("当選音源がありません。");
    case "idol_collab": return `<@&${ROLE_IDS.SINGER_CROWN}> と歌コラボすることができます！\n\n${guidance}`;
    case "superchat_nomination": return `${nominees} の誰か1人にサンプルボイスを録ってもらうことができます。\nできたサンプルボイスは市場ガチャに追加されます。\n\n${guidance}`;
    case "voice_message_nomination": return `${nominees} の誰か1人にボイスメッセージを録ってもらうことができます。\n\n${guidance}`;
    case "letter": return `${nominees} の誰か1人にお手紙を書いてもらうことができます。\n\n${guidance}`;
    case "private_call": return `${nominees} の誰か1人と15分ツーショすることができます。\n\n${guidance}`;
    case "game_free_1": case "game_free_3": return "次回遊戯24hを使用時に、優先的にチケットが消費されるようになります。";
    case "secret_free_1": case "secret_free_3": return "次回シークレットを使用時に、優先的にチケットが消費されるようになります。";
    case "freedom_free_1": return "次回フリーダムを使用時に、優先的にチケットが消費されるようになります。";
    case "normal_hotel_free_1": return "次回通常ホテルを使用時に、優先的にチケットが消費されるようになります。";
    case "hazama_free_3": return "次回辺境の狭間を使用時に、優先的にチケットが消費されるようになります。";
    case "solitary_cell_free_1": return "次回独房を使用時に、優先的にチケットが消費されるようになります。";
    case "discount_5": case "discount_10": return `${GENERAL_INQUIRY_CHANNEL_MENTION}にて市場チケットを切り、割引券を使用したい旨と商品を商人にお伝えください。\n割引後の支払額を確認したら、市場パネルからその金額を送金してください。\n\n※100万LIA以上の商品には利用できません。`;
    case "detention_pass_3_days": return guidance;
    case "custom_role_week": return `1週間限定のカスタムロールを作ることができます。\n\n${guidance}`;
    case "soundboard_week": return `1週間限定でサウンドボードに追加することができます。\n\n${guidance}`;
    case "one_more_chance": return "ガチャ上限突破⁉️\n今日のガチャ上限が1回増えたよ♩\n\n招待ポイントを1pt付与したから、それで引いてね！\n※追加された回数は今日だけ有効です。";
    case "miss": return "何も出せなくてごめんね(> <｡)\nガチャコインだけだよ:( ;˙꒳˙;):";
    case "gacha_coin_2": case "gacha_coin_4": case "gacha_coin_6": return "ガチャコインボーナス✨️✨️\nたくさんガチャコインを集めて、好きな商品と交換してね！\n\n※毎回もらえる1枚を含みます。";
  }
}

export function formatMarketGachaResult(prize: MarketGachaPrize, coins: number, remainingDraws: number, audioAsset?: MarketGachaAudioAsset, dmDelivered = true): string {
  const title = prize.key === "miss" ? "ハズレ！" : `🎉 ${prize.label}が当たりました！`;
  const body = audioAsset && !dmDelivered
    ? `${performerMention(audioAsset)}の${prize.audioCategory === "superchat" ? "サプボ" : "歌みた"}です！\nファイルURLをDMに送信できませんでした。DMの受信設定を確認後、総合お問い合わせへご連絡ください。\n\n${AUDIO_PRIZE_PROHIBITION_NOTICE}`
    : marketGachaInstructions(prize, audioAsset);
  return `${title}\n\n${body}\n\n本日の残り回数：${remainingDraws}回\n\nガチャコイン：＋${prize.coins ?? 1}枚\n現在の所持数：${coins}枚`;
}
