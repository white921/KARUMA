const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const mysql=require('mysql2/promise');
const {Collection}=require('discord.js');
const {DbService}=require('../dist/service/system/dbService');
const {MarketGachaService: Service}=require('../dist/service/market/marketGachaService');
const {GuildMemberCacheService}=require('../dist/service/system/guildMemberCacheService');
const {BOT_ID,ROLE_IDS:R}=require('../dist/constant/shared/id');
const {ITEM_DEFINITIONS}=require('../dist/constant/inventory/item');
const {MARKET_GACHA_PRIZES:prizes}=require('../dist/constant/market/marketGacha');
const {GACHA_COIN_ACTIVATION_EPOCH}=require('../dist/constant/market/gachaCoinActivation');

// 専用ローカルMySQLのみ。実運用の抽選・課金は一切実行しない。
test('市場ガチャ更新 MySQL統合テスト',{skip:!process.env.MARKET_GACHA_TEST_SOCKET},async t=>{
 const database=`market_gacha_test_${process.pid}_${Date.now()}`;
 const config={socketPath:process.env.MARKET_GACHA_TEST_SOCKET,user:'root',supportBigNumbers:true,bigNumberStrings:true,timezone:'Z',multipleStatements:true};
 const admin=await mysql.createConnection(config);await admin.query(`CREATE DATABASE ${database}`);
 const pool=mysql.createPool({...config,database,connectionLimit:8});
 t.after(async()=>{await pool.end();await admin.query(`DROP DATABASE ${database}`);await admin.end();});
 const ddl=fs.readFileSync('src/sql/createTable.sql','utf8');
 const tables=['accounts','items','item_users','actions','market_gacha_draws','market_gacha_daily_locks','market_gacha_audio_assets','market_gacha_audio_deliveries','invite_point_balances','invite_point_transactions','gacha_coin_balances','gacha_coin_transactions','gacha_coin_rollouts'];
 for(const table of tables)await pool.query(ddl.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?;`))[0]);
 // 旧DBからの列追加と再実行、新規DBとの一致。
 await pool.query('ALTER TABLE market_gacha_draws DROP COLUMN bonus_draws_awarded');
 const migration=fs.readFileSync('src/sql/20260926_market_gacha.sql','utf8');
 await pool.query(migration);await pool.query(migration);
 let now=Date.parse('2026-09-25T15:05:00Z')/1000;
 let selected='miss',roles,replies,dms,failDm,failReply;
 t.mock.method(DbService,'getConnection',async()=>{
  const c=await pool.getConnection();await c.query("SET time_zone='+00:00'");await c.query('SET timestamp=?',[now]);return c;
 });
 t.mock.method(Math,'random',()=>{let sum=0;for(const p of prizes){if(p.key===selected)return (sum+p.probability/2)/100;sum+=p.probability;}throw Error('unknown selected prize');});
 t.mock.method(Service,'sendDrawLog',async()=>{});
 t.mock.method(GuildMemberCacheService,'getMembers',async()=>new Collection([
  ['1002',{id:'1002',roles:{cache:new Set([R.CORE_MEMBER_ROLES.JUNJUNHONMEN])}}],
  ['1003',{id:'1003',roles:{cache:new Set([R.CORE_MEMBER_ROLES.KARIMEN])}}],
 ]));
 async function reset(){
  for(const table of ['market_gacha_audio_deliveries','gacha_coin_transactions','gacha_coin_balances','gacha_coin_rollouts','invite_point_transactions','invite_point_balances','market_gacha_daily_locks','market_gacha_draws','actions','item_users','market_gacha_audio_assets','items','accounts'])await pool.query(`DELETE FROM ${table}`);
  await pool.execute('INSERT INTO accounts(user_id,user_name,wallet) VALUES (?,?,?),(?,?,?)',['1001','test',1000000,BOT_ID,'bot',100000]);
  for(const item of ITEM_DEFINITIONS)await pool.execute('INSERT INTO items(item_key,name,description) VALUES (?,?,?)',[item.key,item.name,item.description]);
  await pool.query('INSERT INTO invite_point_balances(user_id,points) VALUES (1001,10)');
  await pool.execute("INSERT INTO gacha_coin_rollouts(rollout_key,activation_epoch,status) VALUES ('20260922',?,'completed')",[GACHA_COIN_ACTIVATION_EPOCH]);
  for(const category of ['superchat','song_cover'])for(const id of ['1002','1003'])await pool.execute('INSERT INTO market_gacha_audio_assets(category,performer_name,performer_user_id,file_name,object_key,public_url,is_active) VALUES (?,?,?,?,?,?,1)',[category,'演者',id,`${category}-${id}`,`${category}/${id}`,`https://example.com/${category}-${id}`]);
  now=Date.parse('2026-09-25T15:05:00Z')/1000;selected='miss';roles=new Set([R.CORE_MEMBER_ROLES.HONMEN]);replies=[];dms=[];failDm=false;failReply=false;
 }
 const interaction=()=>({user:{id:'1001',send:async text=>{if(failDm)throw Error('DM blocked');dms.push(text);}},guild:{members:{fetch:async()=>({id:'1001',roles:{cache:roles}})}},editReply:async p=>{if(failReply)throw Error('reply failed');replies.push(p);}});
 async function draw(key='miss',payment='currency'){selected=key;return Service.draw(interaction(),payment);}
 async function state(){
  const [[wallet]]=await pool.query('SELECT wallet FROM accounts WHERE user_id=1001');
  const [[points]]=await pool.query('SELECT points FROM invite_point_balances WHERE user_id=1001');
  const [coins]=await pool.query('SELECT coins FROM gacha_coin_balances WHERE user_id=1001');
  const [draws]=await pool.query('SELECT * FROM market_gacha_draws ORDER BY id');
  const [items]=await pool.query('SELECT item_key,quantity FROM item_users JOIN items ON item_users.item_id=items.id WHERE user_id=1001');
  const [logs]=await pool.query('SELECT amount FROM gacha_coin_transactions');
  return {wallet:wallet.wallet,points:points.points,coins:coins[0]?.coins??0,draws,items:Object.fromEntries(items.map(i=>[i.item_key,i.quantity])),logs};
 }
 await t.test('全22景品で正しい付与枚数・残高・メッセージ・台帳',async()=>{
  for(const p of prizes){
   await reset();await draw(p.key);const s=await state();
   assert.equal(s.wallet,995000,p.key);assert.equal(s.coins,p.coins??1,p.key);
   assert.equal(s.draws.length,1);assert.equal(s.draws[0].prize_key,p.key);
   assert.equal(s.logs.length,1);assert.equal(s.logs[0].amount,p.coins??1);
   if(p.itemKey)assert.equal(s.items[p.itemKey],p.quantity);
   assert.match(replies[0].content,new RegExp(`現在の所持数：${p.coins??1}枚$`));
   assert.equal(s.points,p.key==='one_more_chance'?11:10);
   assert.equal(s.draws[0].bonus_draws_awarded,p.key==='one_more_chance'?1:0);
   if(p.audioCategory){assert.equal(dms.length,1);assert.match(dms[0],/<@1002>/);assert.doesNotMatch(dms[0],/1003/);}
  }
 });
 await t.test('身分別5%枠を実際に所持品へ付与する',async()=>{
  for(const [role,key,quantity] of [[R.CORE_MEMBER_ROLES.JUNJUNHONMEN,'HOTEL_NORMAL_FREE',1],[R.CORE_MEMBER_ROLES.KARIMEN,'HOTEL_NORMAL_FREE',1],[R.CORE_MEMBER_ROLES.JUNMEN,'HAZAMA_FREE',3],[R.CORE_MEMBER_ROLES.HYOKAOTI,'SOLITARY_CELL_FREE',1]]){
   await reset();roles=new Set([role]);await draw('detention_pass_3_days');assert.equal((await state()).items[key],quantity);
  }
 });
 await t.test('基本5回、5回目の当選で6回目、再当選で7回目が可能',async()=>{
  await reset();for(let i=0;i<4;i++)await draw();await draw('one_more_chance');
  assert.match(replies.at(-1).content,/本日の残り回数：1回/);
  await draw('one_more_chance','invite_point');await draw('gacha_coin_6','invite_point');
  const s=await state();assert.equal(s.draws.length,7);assert.equal(s.coins,12);assert.equal(s.points,10);
  assert.match(replies.at(-1).content,/本日の残り回数：0回/);
  await assert.rejects(draw(),/本日7回まで/);assert.deepEqual(await state(),s);
 });
 await t.test('日本時間0時に追加枠と基本回数がリセット、未使用ポイントは残る',async()=>{
  await reset();now=Date.parse('2026-09-26T14:59:59Z')/1000;await draw('one_more_chance');
  now=Date.parse('2026-09-26T15:00:00Z')/1000;
  for(let i=0;i<5;i++)await draw();await assert.rejects(draw(),/本日5回まで/);
  assert.equal((await state()).points,11);
 });
 await t.test('同時に6回抽選しても5回しか課金・付与されない',async()=>{
  await reset();const results=await Promise.allSettled(Array.from({length:6},()=>draw()));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,5);
  const s=await state();assert.equal(s.draws.length,5);assert.equal(s.wallet,975000);assert.equal(s.coins,5);
 });
 await t.test('ハズレは基本1枚だけで、過去の1日休み状態も新仕様では抽選を止めない',async()=>{
  await reset();await pool.execute("INSERT INTO market_gacha_daily_locks(user_id,lock_date) VALUES (1001,'2026-09-26')");
  await draw();await draw();assert.equal((await state()).coins,2);
 });
 await t.test('招待ポイント払いでもボーナスを合計枚数で付与',async()=>{
  for(const [key,expected] of [['gacha_coin_2',2],['gacha_coin_4',4],['gacha_coin_6',6]]){
   await reset();await draw(key,'invite_point');const s=await state();assert.equal(s.wallet,1000000);assert.equal(s.points,9);assert.equal(s.coins,expected);
  }
 });
 await t.test('支払い不足・音源未登録は抽選記録とコインを残さない',async()=>{
  for(const fail of ['money','point','audio']){
   await reset();if(fail==='money')await pool.query('UPDATE accounts SET wallet=0 WHERE user_id=1001');
   if(fail==='point')await pool.query('UPDATE invite_point_balances SET points=0 WHERE user_id=1001');
   if(fail==='audio')await pool.query('UPDATE market_gacha_audio_assets SET is_active=0');
   const before=await state();await assert.rejects(draw(fail==='audio'?'superchat':'miss',fail==='point'?'invite_point':'currency'));
   assert.deepEqual(await state(),before);
  }
 });
 await t.test('コイン履歴保存失敗ならチケット・追加枠・ポイント・料金をすべて戻す',async()=>{
  for(const key of ['game_free_3','one_more_chance','gacha_coin_6']){
   await reset();const before=await state();
   await pool.query("CREATE TRIGGER fail_coin BEFORE INSERT ON gacha_coin_transactions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='coin failure'");
   try{await assert.rejects(draw(key),/coin failure/);assert.deepEqual(await state(),before);}finally{await pool.query('DROP TRIGGER fail_coin');}
  }
 });
 await t.test('DM・結果返信失敗は確定済みの抽選を戻さない',async()=>{
  await reset();failDm=true;await draw('song_cover');assert.equal((await state()).draws.length,1);assert.match(replies.at(-1).content,/DMに送信できません/);
  await reset();failReply=true;await assert.rejects(draw('gacha_coin_4'),/reply failed/);const s=await state();assert.equal(s.coins,4);assert.equal(s.draws.length,1);
 });
});
