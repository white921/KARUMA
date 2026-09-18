/** 公開メッセージを更新して応答するボタンかどうかを判定する。 */
export function shouldDeferButtonUpdate(customId: string): boolean {
  return (
    customId.startsWith("history_page_") ||
    customId.startsWith("creatorEmblemConfirm:")
  );
}
