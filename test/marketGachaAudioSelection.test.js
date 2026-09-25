const test = require('node:test');
const assert = require('node:assert/strict');
const { marketGachaAudioWeight: weight, selectWeightedAudioAsset: select, RECENT_AUDIO_WINDOW_SECONDS: windowSeconds } = require('../dist/service/market/marketGachaAudioSelection');
const now = Date.parse('2026-09-26T00:00:00+09:00') / 1000;

test('追加後7日未満は1.5倍、7日経過後と未来日は通常の重み', () => {
  assert.equal(weight(now, now), 1.5);
  assert.equal(weight(now - windowSeconds + 1, now), 1.5);
  assert.equal(weight(now - windowSeconds, now), 1);
  assert.equal(weight(now - windowSeconds - 1, now), 1);
  assert.equal(weight(now + 1, now), 1);
  assert.throws(() => weight(NaN, now));
});

test('古い音源1本と新しい音源1本は40%対60%、境界も正しく選択', () => {
  const old = { id: 'old', created_at_epoch: now - windowSeconds };
  const recent = { id: 'recent', created_at_epoch: String(now - 1) };
  const assets = [old, recent], count = { old: 0, recent: 0 };
  for (let i = 0; i < 10000; i++) count[select(assets, now, (i + 0.5) / 10000).id]++;
  assert.deepEqual(count, { old: 4000, recent: 6000 });
  assert.equal(select(assets, now, 0), old);
  assert.equal(select(assets, now, 0.4 - 1e-10), old);
  assert.equal(select(assets, now, 0.4), recent);
  assert.equal(select(assets, now, 1 - Number.EPSILON), recent);
});

test('同じ重みなら均等、7日経過で新旧の優遇が消える', () => {
  const assets = [{ created_at_epoch: now - windowSeconds }, { created_at_epoch: now }];
  assert.equal(select(assets, now + windowSeconds, 0.49), assets[0]);
  assert.equal(select(assets, now + windowSeconds, 0.5), assets[1]);
  assert.equal(select([], now, 0), undefined);
  for (const random of [-0.1, 1, NaN, Infinity]) assert.throws(() => select(assets, now, random));
});
