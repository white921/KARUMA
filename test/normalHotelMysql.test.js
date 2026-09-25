const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const mysql=require('mysql2/promise');
const {ButtonInteraction}=require('discord.js');
const {DbService}=require('../dist/service/system/dbService');
const {AccountService}=require('../dist/service/account/accountService');
const {HotelVcService}=require('../dist/service/hotel/hotelVcService');
const {handlePanelButton}=require('../dist/handler/interaction/panelButtonHandler');
const {shouldDeferButtonUpdate}=require('../dist/util/interaction/interactionAck');
const {BOT_ID,ROLE_IDS:R,TEXT_CHANNEL_IDS}=require('../dist/constant/shared/id');
const {PANEL_COMMAND_NAMES:C}=require('../dist/constant/shared/command');

test('通常ホテル無料券 MySQL統合テスト',{skip:!process.env.MARKET_GACHA_TEST_SOCKET},async t=>{
 const database=`normal_hotel_test_${process.pid}_${Date.now()}`;
 const config={socketPath:process.env.MARKET_GACHA_TEST_SOCKET,user:'root',supportBigNumbers:true,bigNumberStrings:true,timezone:'Z'};
 const admin=await mysql.createConnection(config);await admin.query(`CREATE DATABASE ${database}`);
 const pool=mysql.createPool({...config,database,connectionLimit:6});
 t.after(async()=>{await pool.end();await admin.query(`DROP DATABASE ${database}`);await admin.end();});
 const ddl=fs.readFileSync('src/sql/createTable.sql','utf8');
 for(const name of ['accounts','actions','items','item_users','vcs'])await pool.query(ddl.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${name} \\([\\s\\S]*?;`))[0]);
 await pool.query("INSERT INTO items(item_key,name) VALUES ('HOTEL_NORMAL_FREE','通常ホテル無料券')");
 t.mock.method(DbService,'getConnection',()=>pool.getConnection());
 t.mock.method(AccountService,'hasAccount',async()=>true);
 let roles,replies,created,deleted,failCreate,failReply;let nextId=8000;
 t.mock.method(HotelVcService,'createHotelVc',async(i,type,bonus,guest,notify)=>{
  assert.equal(type,'通常ホテル');assert.equal(notify,false);assert.equal(i.member.id,'1001');
  if(failCreate)throw Error('create failed');const id=String(++nextId);created.push({id,bonus});return id;
 });
 async function reset(tickets=1,wallet=10000,role=R.CORE_MEMBER_ROLES.KARIMEN){
  for(const table of ['actions','item_users','vcs','accounts'])await pool.query(`DELETE FROM ${table}`);
  await pool.execute('INSERT INTO accounts(user_id,user_name,wallet) VALUES (?,?,?),(?,?,?)',['1001','test',wallet,BOT_ID,'bot',1000]);
  await pool.execute('INSERT INTO item_users(user_id,item_id,quantity) SELECT 1001,id,? FROM items',[tickets]);
  roles=new Set([role]);replies=[];created=[];deleted=[];failCreate=false;failReply=false;
 }
 const member=()=>({id:'1001',roles:{cache:roles}});
 const interaction=customId=>({customId,user:{id:'1001'},guildId:'2001',channelId:TEXT_CHANNEL_IDS.NORMAL_HOTEL_VC_PANEL,member:member(),deferred:true,replied:false,
  reply:ButtonInteraction.prototype.reply,update:ButtonInteraction.prototype.update,
  editReply:async p=>{if(failReply&&p.content?.startsWith('✅'))throw Error('reply failed');replies.push(p);},
  guild:{members:{fetch:async()=>member()},channels:{fetch:async id=>({delete:async()=>deleted.push(id)})}},
  client:{channels:{fetch:async()=>({isTextBased:()=>true,send:async()=>{}})}},
 });
 async function show(){await handlePanelButton(interaction(C.HOTEL_VC_NORMAL));const buttons=replies.at(-1).components[0].toJSON().components;assert.equal(shouldDeferButtonUpdate(buttons[1].custom_id),true);return {confirm:interaction(buttons[1].custom_id),cancel:interaction(buttons[0].custom_id)};}
 async function state(){const [[a]]=await pool.query('SELECT wallet FROM accounts WHERE user_id=1001');const [[i]]=await pool.query('SELECT quantity FROM item_users');const [vcs]=await pool.query('SELECT * FROM vcs');const [actions]=await pool.query('SELECT * FROM actions');return {wallet:a.wallet,quantity:i.quantity,vcs,actions};}
 await t.test('賢者・旅人は残高0でも無料券を1枚消費して12時間利用',async()=>{
  for(const role of [R.CORE_MEMBER_ROLES.JUNJUNHONMEN,R.CORE_MEMBER_ROLES.KARIMEN]){
   await reset(2,0,role);const f=await show();assert.match(replies.at(-1).embeds[0].toJSON().description,/通常ホテル無料券1枚/);
   await handlePanelButton(f.confirm);const s=await state();assert.equal(s.wallet,0);assert.equal(s.quantity,1);assert.equal(s.vcs[0].is_ticket,1);assert.equal(s.actions[0].amount,0);
   assert.ok(Math.abs(s.vcs[0].expire_at-Date.now()-12*3600000)<5000);
   await assert.rejects(handlePanelButton(f.confirm),/処理済み/);assert.equal((await state()).quantity,1);
  }
 });
 await t.test('券なしの料金は賢者5000、旅人10000',async()=>{
  for(const [role,price] of [[R.CORE_MEMBER_ROLES.JUNJUNHONMEN,5000],[R.CORE_MEMBER_ROLES.KARIMEN,10000]]){
   await reset(0,10000,role);await handlePanelButton((await show()).confirm);const s=await state();assert.equal(s.wallet,10000-price);assert.equal(s.vcs[0].is_ticket,0);assert.equal(s.actions[0].amount,price);
  }
 });
 await t.test('無料ロールは券を消費せず既存の期限なし特典を維持',async()=>{
  for(const role of [R.CORE_MEMBER_ROLES.JUNHONMEN,R.CORE_MEMBER_ROLES.HONMEN,R.HOTEL_LEADER,R.SABANUSI,R.KANRISYA]){
   await reset(2,0,role);await handlePanelButton((await show()).confirm);const s=await state();assert.equal(s.quantity,2);assert.equal(s.wallet,0);assert.equal(s.vcs[0].is_bonus,1);assert.equal(s.vcs[0].expire_at,null);
  }
 });
 await t.test('確認後の在庫・料金変更は再確認、勝手にLIA払いに変更しない',async()=>{
  for(const scenario of ['ticket','role']){
   await reset(scenario==='ticket'?1:0,10000,R.CORE_MEMBER_ROLES.JUNJUNHONMEN);const f=await show();
   if(scenario==='ticket')await pool.query('UPDATE item_users SET quantity=0');else roles=new Set([R.CORE_MEMBER_ROLES.KARIMEN]);
   await handlePanelButton(f.confirm);assert.match(replies.at(-1).content,/変わりました/);assert.equal(created.length,0);assert.equal((await state()).wallet,10000);
  }
 });
 await t.test('別の確認画面が最後の1枚を競合しても1枚・1部屋だけ',async()=>{
  await reset();const a=await show(),b=await show();await Promise.allSettled([handlePanelButton(a.confirm),handlePanelButton(b.confirm)]);
  const s=await state();assert.equal(s.quantity,0);assert.equal(s.wallet,10000);assert.equal(s.vcs.length,1);assert.equal(created.length-deleted.length,1);
 });
 await t.test('VC作成・履歴保存・残高不足の失敗で券と残高を失わない',async()=>{
  for(const scenario of ['create','db','money']){
   await reset(scenario==='money'?0:1,0);const f=await show();failCreate=scenario==='create';
   if(scenario==='db')await pool.query("CREATE TRIGGER fail_normal BEFORE INSERT ON actions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='db failed'");
   try{await assert.rejects(handlePanelButton(f.confirm));const s=await state();assert.equal(s.quantity,scenario==='money'?0:1);assert.equal(s.wallet,0);assert.equal(s.vcs.length,0);assert.equal(created.length-deleted.length,0);}
   finally{if(scenario==='db')await pool.query('DROP TRIGGER fail_normal');}
  }
 });
 await t.test('キャンセル・所有者検証・期限切れ・旧ボタン',async()=>{
  await reset();const f=await show();await assert.rejects(handlePanelButton({...f.confirm,user:{id:'1002'}}),/操作できません/);
  await handlePanelButton(f.cancel);await assert.rejects(handlePanelButton(f.confirm),/処理済み/);
  const expired=await show(),now=Date.now(),clock=t.mock.method(Date,'now',()=>now+600001);
  try{await assert.rejects(handlePanelButton(expired.confirm),/期限切れ/);}finally{clock.mock.restore();}
  await assert.rejects(handlePanelButton(interaction('NORMAL_hotel_create_チケット_user_not_selected')),/期限切れ/);
  assert.equal((await state()).quantity,1);
 });
 await t.test('結果返信の失敗は確定済みの利用を戻さない',async()=>{
  await reset();const f=await show();failReply=true;await assert.rejects(handlePanelButton(f.confirm),/reply failed/);await assert.rejects(handlePanelButton(f.confirm),/処理済み/);assert.equal((await state()).quantity,0);assert.equal((await state()).vcs.length,1);
 });
});
