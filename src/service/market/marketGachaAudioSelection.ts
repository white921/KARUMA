export const RECENT_AUDIO_WINDOW_SECONDS = 7 * 24 * 60 * 60;
export const RECENT_AUDIO_WEIGHT = 1.5;

export function marketGachaAudioWeight(createdAtEpoch: number, nowEpoch: number): number {
  if (!Number.isFinite(createdAtEpoch) || !Number.isFinite(nowEpoch)) throw new Error("音源の登録日時が不正です。");
  const age = nowEpoch - createdAtEpoch;
  return age >= 0 && age < RECENT_AUDIO_WINDOW_SECONDS ? RECENT_AUDIO_WEIGHT : 1;
}

/** 音源1本ごとの重みで抽選する。景品カテゴリの当選確率は変更しない。 */
export function selectWeightedAudioAsset<T extends { created_at_epoch: number | string }>(
  assets: readonly T[], nowEpoch: number, randomValue: number,
): T | undefined {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) throw new Error("音源抽選の乱数が不正です。");
  if (!assets.length) return undefined;
  const weights = assets.map(asset => marketGachaAudioWeight(Number(asset.created_at_epoch), nowEpoch));
  const threshold = randomValue * weights.reduce((sum, weight) => sum + weight, 0);
  let cumulative = 0;
  for (let i = 0; i < assets.length; i++) {
    cumulative += weights[i];
    if (threshold < cumulative) return assets[i];
  }
  return assets[assets.length - 1];
}
