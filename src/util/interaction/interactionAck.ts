import { CREATOR_EMBLEM_CANCEL_ID, CREATOR_EMBLEM_CONFIRM_PREFIX } from "../../constant/market/creatorEmblem";

/** ボタンが付いているメッセージを更新して応答するかどうかを判定する。 */
export function shouldDeferButtonUpdate(customId: string): boolean {
  return (
    customId.startsWith("history_page_") ||
    customId.startsWith(`${CREATOR_EMBLEM_CONFIRM_PREFIX}:`) ||
    customId === CREATOR_EMBLEM_CANCEL_ID
  );
}
