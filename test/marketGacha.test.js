const test = require('node:test');
const assert = require('node:assert/strict');
const { MARKET_GACHA_DAILY_LIMIT, MARKET_GACHA_PRICE, MARKET_GACHA_PRIZES: prizes, selectMarketGachaPrize, MARKET_GACHA_CONFIRMATION_PREFIX: prefix } = require('../dist/constant/market/marketGacha');
const { MarketGachaService: Service, createMarketGachaPaymentSelectionRow, formatMarketGachaDrawLog } = require('../dist/service/market/marketGachaService');
const { resolveMarketGachaPrize, formatMarketGachaResult, marketGachaInstructions, isSageOrHigherPerformer } = require('../dist/service/market/marketGachaResult');
const { ROLE_IDS: R, TEXT_CHANNEL_IDS, THREAD_IDS } = require('../dist/constant/shared/id');
const { PANEL_COMMAND_NAMES: C } = require('../dist/constant/shared/command');
const { shouldDeferButtonUpdate } = require('../dist/util/interaction/interactionAck');
const { AccountService } = require('../dist/service/account/accountService');
const { handlePanelButton } = require('../dist/handler/interaction/panelButtonHandler');
const { ITEM_KEY: K } = require('../dist/constant/inventory/item');
const member = (...roles) => ({roles:{cache:new Set(roles)}});
const prize = key => {const p=prizes.find(p=>p.key===key); assert.ok(p,key);return p;};

test('承認済み22景品と確率、基本料金・回数', () => {
  assert.equal(MARKET_GACHA_PRICE,5000); assert.equal(MARKET_GACHA_DAILY_LIMIT,5);
  assert.deepEqual(Object.fromEntries(prizes.map(p=>[p.key,p.probability])),{
    superchat:15,song_cover:15,idol_collab:3,superchat_nomination:4,voice_message_nomination:4,letter:3,private_call:3,
    game_free_1:6,game_free_3:3,secret_free_1:5,secret_free_3:3,freedom_free_1:3,discount_5:5,discount_10:2.5,
    detention_pass_3_days:5,custom_role_week:0.5,soundboard_week:0.5,one_more_chance:6,miss:2,gacha_coin_2:7,gacha_coin_4:3,gacha_coin_6:1.5,
  });
  assert.equal(prizes.reduce((sum,p)=>sum+p.probability,0),100);
  assert.equal(new Set(prizes.map(p=>p.key)).size,22);
});

test('0.5%刻みの全抽選区間と境界を検証', () => {
  const counts = new Map();
  for(let i=0;i<10000;i++){const p=selectMarketGachaPrize((i+0.5)/10000);counts.set(p.key,(counts.get(p.key)||0)+1);}
  let cumulative=0;
  for(const p of prizes){
    assert.equal(counts.get(p.key),p.probability*100);
    assert.equal(selectMarketGachaPrize(cumulative/100+1e-10).key,p.key);
    cumulative+=p.probability;
    assert.equal(selectMarketGachaPrize(cumulative/100-1e-10).key,p.key);
  }
  for(const v of [-1,1,NaN,Infinity])assert.throws(()=>selectMarketGachaPrize(v));
});

test('5%枠は身分に応じて置換、罪人優先', () => {
  const pass=prize('detention_pass_3_days');
  for(const role of [R.CORE_MEMBER_ROLES.HONMEN,R.CORE_MEMBER_ROLES.JUNHONMEN,R.SABANUSI,R.KANRISYA])assert.equal(resolveMarketGachaPrize(pass,member(role)),pass);
  for(const role of [R.CORE_MEMBER_ROLES.JUNJUNHONMEN,R.CORE_MEMBER_ROLES.KARIMEN])assert.equal(resolveMarketGachaPrize(pass,member(role)).itemKey,K.HOTEL_NORMAL_FREE);
  assert.equal(resolveMarketGachaPrize(pass,member(R.CORE_MEMBER_ROLES.JUNMEN)).quantity,3);
  assert.equal(resolveMarketGachaPrize(pass,member(R.CORE_MEMBER_ROLES.JUNMEN)).itemKey,K.HAZAMA_FREE);
  for(const role of [R.CORE_MEMBER_ROLES.HYOKAOTI,...Object.values(R.DETENTION_ROLES)]){
    const p=resolveMarketGachaPrize(pass,member(role,R.CORE_MEMBER_ROLES.HONMEN));
    assert.equal(p.itemKey,K.SOLITARY_CELL_FREE);assert.equal(p.quantity,1);
  }
  assert.throws(()=>resolveMarketGachaPrize(pass,member()),/身分ロール/);
});

test('サプボ・歌みたの演者条件は賢者以上', () => {
  for(const role of [R.CORE_MEMBER_ROLES.JUNJUNHONMEN,R.CORE_MEMBER_ROLES.JUNHONMEN,R.CORE_MEMBER_ROLES.HONMEN,R.SABANUSI,R.KANRISYA])assert.equal(isSageOrHigherPerformer(member(role)),true);
  for(const role of [R.CORE_MEMBER_ROLES.KARIMEN,R.CORE_MEMBER_ROLES.JUNMEN,R.CORE_MEMBER_ROLES.HYOKAOTI])assert.equal(isSageOrHigherPerformer(member(role)),false);
});

test('全景品と身分別代替に当選文・コイン増分・付与後所持数を表示', () => {
  const replacements=[R.CORE_MEMBER_ROLES.JUNJUNHONMEN,R.CORE_MEMBER_ROLES.JUNMEN,R.CORE_MEMBER_ROLES.HYOKAOTI].map(r=>resolveMarketGachaPrize(prize('detention_pass_3_days'),member(r)));
  for(const p of [...prizes,...replacements]) {
    const audio=p.audioCategory?{performerName:'演者',performerUserId:'123',publicUrl:'https://example.com/audio'}:undefined;
    const text=formatMarketGachaResult(p,42,3,audio);
    assert.ok(text.includes(p.label));assert.match(text,/現在の所持数：42枚$/);
    assert.ok(text.includes(`ガチャコイン：＋${p.coins??1}枚`));assert.match(text,/本日の残り回数：3回/);
    assert.ok(text.length<2000);
  }
});

test('音源メンション・DM失敗・禁止事項の出力', () => {
  const asset={performerName:'演者',performerUserId:'123',publicUrl:'https://example.com/audio'};
  for(const key of ['superchat','song_cover']){
    assert.match(formatMarketGachaResult(prize(key),1,4,asset),/<@123>の/);
    assert.match(formatMarketGachaResult(prize(key),1,4,asset),/転載・転送・保存・画面録画等は禁止/);
    const failed=formatMarketGachaResult(prize(key),1,4,asset,false);
    assert.match(failed,/DMに送信できませんでした/);assert.doesNotMatch(failed,/送信したので/);
  }
});

test('手動景品の案内・指定ロール・期間を保持', () => {
  for(const key of ['idol_collab','superchat_nomination','voice_message_nomination','letter','private_call','detention_pass_3_days','custom_role_week','soundboard_week']){
    const text=marketGachaInstructions(prize(key));
    assert.match(text,new RegExp(`<#${TEXT_CHANNEL_IDS.GENERAL_INQUIRY}>`));assert.match(text,/当選メッセージをスクショ/);
  }
  for(const key of ['superchat_nomination','voice_message_nomination','letter','private_call']){
    const text=marketGachaInstructions(prize(key));
    for(const role of [R.CORE_MEMBER_ROLES.HONMEN,R.CORE_MEMBER_ROLES.JUNHONMEN,R.CORE_MEMBER_ROLES.JUNJUNHONMEN])assert.ok(text.includes(`<@&${role}>`));
  }
  assert.match(marketGachaInstructions(prize('private_call')),/15分/);
  assert.match(marketGachaInstructions(prize('soundboard_week')),/1週間限定/);
  assert.match(marketGachaInstructions(prize('one_more_chance')),/今日のガチャ上限が1回増えた/);
  assert.match(marketGachaInstructions(prize('one_more_chance')),/招待ポイントを1pt付与/);
  assert.doesNotMatch(marketGachaInstructions(prize('miss')),/おしまい|また明日/);
  for(const key of ['discount_5','discount_10'])assert.match(marketGachaInstructions(prize(key)),/100万LIA以上の商品には利用できません/);
});

function fixture(t) {
  t.mock.method(AccountService,'hasAccount',async()=>true);
  const replies=[],draws=[];
  t.mock.method(Service,'draw',async (i,p)=>draws.push(p));
  const source={customId:C.MARKET_GACHA_PAYMENT_CURRENCY,user:{id:'u'},guildId:'g',channelId:'c',editReply:async p=>replies.push(p)};
  return {source,replies,draws,button(index=0){return {...source,customId:replies.find(p=>p.components?.[0]?.toJSON().components[0].custom_id.startsWith(prefix)).components[0].toJSON().components[index].custom_id};}};
}

test('支払確認は選択方法を保持し同時連打・再実行で二重抽選しない',async t=>{
  for(const payment of ['currency','invite_point']){
    const f=fixture(t);await Service.showDrawConfirmation(f.source,payment);const confirm=f.button();
    assert.equal(shouldDeferButtonUpdate(confirm.customId),true);
    const result=await Promise.allSettled([handlePanelButton(confirm),handlePanelButton(confirm)]);
    assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.deepEqual(f.draws,[payment]);
    await assert.rejects(handlePanelButton(confirm),/処理済み/);
  }
});

for(const index of [1,2])test(`選び直し・キャンセル ${index} は元の確認を無効化`,async t=>{
  const f=fixture(t);await Service.showDrawConfirmation(f.source,'currency');
  const confirm=f.button();await handlePanelButton(f.button(index));
  await assert.rejects(handlePanelButton(confirm),/処理済み/);assert.equal(f.draws.length,0);
});

test('他人・別サーバー・別チャンネルでは確認を消費できない',async t=>{
  const f=fixture(t);await Service.showDrawConfirmation(f.source,'currency');
  for(const overrides of [{user:{id:'other'}},{guildId:'other'},{channelId:'other'}])await assert.rejects(handlePanelButton({...f.button(),...overrides}),/操作できません/);
  await handlePanelButton(f.button());assert.equal(f.draws.length,1);
});

test('期限切れ・旧形式の確認は抽選しない',async t=>{
  const f=fixture(t);await Service.showDrawConfirmation(f.source,'currency');
  const now=Date.now();t.mock.method(Date,'now',()=>now+600001);
  await assert.rejects(handlePanelButton(f.button()),/期限切れ/);
  for(const id of [C.MARKET_GACHA_CONFIRM_CURRENCY,C.MARKET_GACHA_CONFIRM_INVITE_POINT])await assert.rejects(handlePanelButton({...f.source,customId:id}),/期限切れ/);
  assert.equal(f.draws.length,0);
});

test('支払い選択とログ',()=>{
  assert.deepEqual(createMarketGachaPaymentSelectionRow().toJSON().components.map(b=>b.custom_id),[C.MARKET_GACHA_PAYMENT_CURRENCY,C.MARKET_GACHA_PAYMENT_INVITE_POINT,C.MARKET_GACHA_CANCEL]);
  const log=formatMarketGachaDrawLog('123',prize('idol_collab'),'invite_point');
  assert.match(log,/<@123>/);assert.match(log,/招待ポイント1pt/);assert.equal(THREAD_IDS.MARKET_GACHA_LOG_THREAD,'1536708822725427301');
});
