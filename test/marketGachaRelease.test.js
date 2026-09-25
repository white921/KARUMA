const test = require('node:test');
const assert = require('node:assert/strict');
const { assertReleaseTime, assertReviewedCode, RELEASE_AT } = require('../scripts/release-market-gacha-20260926.cjs');
test('本番変更用スクリプトは日本時間9/26 0時より前の実行を拒否する', () => {
  assert.equal(RELEASE_AT, Date.parse('2026-09-26T00:00:00+09:00'));
  assert.throws(() => assertReleaseTime(RELEASE_AT - 1), /本番を変更できません/);
  assert.throws(() => assertReleaseTime(NaN));
  assert.doesNotThrow(() => assertReleaseTime(RELEASE_AT));
});
test('レビュー済みコードとの差分・未コミット変更・未レビューの状態を拒否する', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gacha-release-review-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.com');
    fs.writeFileSync(path.join(root, 'code.js'), 'original'); git('add', '.'); git('commit', '-m', 'code');
    const hash = git('rev-parse', 'HEAD');
    const review = `REVIEW: PASS\nREVIEWED_CODE_COMMIT: ${hash}`;
    assert.throws(() => assertReviewedCode(root, 'REVIEW: PENDING'), /not marked PASS/);
    assert.throws(() => assertReviewedCode(root, 'REVIEW: PASS'), /commit is missing/);
    assert.doesNotThrow(() => assertReviewedCode(root, review));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs/market-gacha-20260926-release.md'), review);
    assert.throws(() => assertReviewedCode(root, review), /clean checkout/);
    git('add', '.'); git('commit', '-m', 'review');
    assert.doesNotThrow(() => assertReviewedCode(root, review));
    fs.writeFileSync(path.join(root, 'code.js'), 'changed'); git('add', '.'); git('commit', '-m', 'changed');
    assert.throws(() => assertReviewedCode(root, review), /Code changed after review/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
