/** Share the guard with the existing create/reopen/upgrade paths. */
const busyUsers = new Set<string>();
export async function withDiaryMutation<T>(userId: string, action: () => Promise<T>): Promise<T> {
  if (busyUsers.has(userId)) throw new Error("日記の処理中です。完了してから操作してください。");
  busyUsers.add(userId);
  try { return await action(); }
  finally { busyUsers.delete(userId); }
}
