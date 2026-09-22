const test = require('node:test');
const assert = require('node:assert/strict');
const { HistoryService } = require('../dist/service/currency/historyService');
const { AccountService } = require('../dist/service/account/accountService');
const { ACTION_TYPES: A } = require('../dist/constant/currency/action');
const { BOT_ID } = require('../dist/constant/shared/id');
const { PANEL_COMMAND_NAMES } = require('../dist/constant/shared/command');
const { HISTORY_FILTER_GROUPS: groups, emptyHistoryFilters, historyCustomId, parseHistoryCustomId } = require('../dist/service/currency/historyFilter');
const { shouldDeferButtonUpdate } = require('../dist/util/interaction/interactionAck');
const { handleUserSelectMenu } = require('../dist/handler/interaction/userSelectHandler');
const { handleStringSelectMenu } = require('../dist/handler/interaction/stringSelectHandler');
const { handlePanelButton } = require('../dist/handler/interaction/panelButtonHandler');
const user = '123456789012345678';
const other = '223456789012345678';
const third = '323456789012345678';
const casino = groups.findIndex(group => group.types.includes(A.CASINO_GF));
const filters = patch => ({ ...emptyHistoryFilters(), ...patch });
const action = (id, type = A.TRANSFER, overrides = {}) => ({
  id, command_name: type, amount: 100, from_user_id: other, to_user_id: user,
  from_after_wallet: 900, to_after_wallet: 1100, comment: '', created_at: new Date('2026-09-22T00:00:00Z'), ...overrides,
});

test('casino matches GF, mahjong and other with OR, combining counterparty and income with AND', () => {
  const rows = [action(1, A.CASINO_GF), action(2, A.CASINO_MAHJONG), action(3, A.CASINO_OTHER),
    action(4, A.ROULETTE_PAYOUT), action(5, A.TRANSFER), action(6, A.CASINO_GF, { from_user_id: third }),
    action(7, A.CASINO_OTHER, { from_user_id: user, to_user_id: other })];
  assert.deepEqual(HistoryService.filterActions(rows, user, filters({ groups: [casino], counterparty: other, direction: 'income' })).map(row => row.id), [3, 2, 1]);
  const transfer = groups.findIndex(group => group.types.includes(A.TRANSFER));
  assert.deepEqual(HistoryService.filterActions(rows, user, filters({ groups: [casino, transfer], counterparty: other, direction: 'expense' })).map(row => row.id), [7]);
  assert.equal(rows[0].id, 1, 'sorting does not mutate input');
});

test('income/expense handles signed omikuji, game expenses, zero change and self transfers', () => {
  const rows = [action(1, A.OMIKUJI_DRAW, { from_user_id: BOT_ID, amount: -50 }),
    action(2, A.OMIKUJI_DRAW, { from_user_id: BOT_ID, amount: 50 }),
    action(3, A.OMIKUJI_DRAW, { amount: 0 }),
    action(4, A.GAME_PASS, { from_user_id: user, to_user_id: BOT_ID }),
    action(5, A.TRANSFER, { from_user_id: user })];
  assert.deepEqual(HistoryService.filterActions(rows, user, filters({ direction: 'income' })).map(row => row.id), [2]);
  assert.deepEqual(HistoryService.filterActions(rows, user, filters({ direction: 'expense' })).map(row => row.id), [4, 1]);
  assert.equal(HistoryService.filterActions(rows, user).length, 5);
  assert.match(HistoryService.createHistoryString(rows[3], user), /-100LIA/);
  assert.match(HistoryService.createHistoryString(rows[0], user), /-50LIA/);
});

test('grant/burn operators are excluded; self-grants and legacy action names remain visible', () => {
  const rows = [action(1, A.ADMIN_MINT, { from_user_id: user, to_user_id: other }),
    action(2, A.ADMIN_BURN), action(3, A.ROLE_BASED_GRANT, { from_user_id: user, to_user_id: other }),
    action(4, A.ADMIN_MINT), action(5, PANEL_COMMAND_NAMES.ADMIN_MINT, { from_user_id: user }),
    action(6, A.ADMIN_BURN, { from_user_id: user, to_user_id: other })];
  assert.deepEqual(HistoryService.filterActions(rows, user).map(row => row.id), [6, 5, 4]);
  assert.deepEqual(HistoryService.filterActions(rows, user, filters({ counterparty: BOT_ID })).map(row => row.id), [6, 5, 4]);
  assert.equal(HistoryService.filterActions(rows, user, filters({ counterparty: other })).length, 0);
  assert.match(HistoryService.createHistoryString(rows[4], user), /付与/);
});

test('every known action has exactly one filter group and renders for its affected account', () => {
  const types = groups.flatMap(group => group.types);
  assert.deepEqual(types.slice().sort(), Object.values(A).sort());
  assert.equal(new Set(types).size, types.length);
  assert.ok(groups.length <= 25);
  for (const type of types) {
    const text = HistoryService.createHistoryString(action(1, type), user)
      || HistoryService.createHistoryString(action(1, type, { from_user_id: user, to_user_id: BOT_ID }), user);
    assert.ok(text, type);
    assert.doesNotMatch(text, /不明な取引/, type);
  }
});

test('all filter state fits component IDs and survives roundtrip without a server session', () => {
  const selected = filters({ counterparty: other, groups: groups.map((_, index) => index), direction: 'expense' });
  for (const control of ['counterparty', 'groups', 'direction', 'page', 'reset']) {
    const id = historyCustomId(user, selected, control, 999999);
    assert.ok(id.length <= 100);
    assert.deepEqual(parseHistoryCustomId(id, user), { filters: selected, control, page: 999999 });
    assert.throws(() => parseHistoryCustomId(id, other), /無効/);
    assert.equal(shouldDeferButtonUpdate(id), true);
  }
  for (const suffix of ['-:zzzzzzzz:income:page:1', '-:0:other:page:1', '-:0:all:page:0', '-:0:all:page:NaN']) {
    assert.throws(() => parseHistoryCustomId(`history:v1:${user}:${suffix}`, user), /無効/);
  }
});

async function withHistory(t, rows) {
  const events = [];
  t.mock.method(AccountService, 'hasAccount', async id => { events.push('account'); assert.equal(id, user); return true; });
  t.mock.method(HistoryService, 'getActionsByUserId', async id => { events.push('history'); assert.equal(id, user); return rows; });
  return events;
}
function interaction(kind, customId, events, values = []) {
  return {
    user: { id: user }, customId, values, deferred: false, replied: false, payload: null,
    isButton: () => kind === 'button', isUserSelectMenu: () => kind === 'user', isStringSelectMenu: () => kind === 'string',
    async deferUpdate() { events.push('ack'); this.deferred = true; },
    async editReply(payload) { events.push('edit'); this.payload = payload; },
  };
}
const components = i => i.payload.components.map(row => row.toJSON());

test('component handlers acknowledge first, preserve combined filters across pages, and reset', async t => {
  const rows = Array.from({ length: 12 }, (_, i) => action(i + 1, A.CASINO_GF));
  rows.push(action(13, A.TRANSFER));
  const events = await withHistory(t, rows);
  const selected = filters({ groups: [casino], direction: 'income' });
  const first = interaction('user', historyCustomId(user, selected, 'counterparty', 3), events, [other]);
  await handleUserSelectMenu(first);
  assert.deepEqual(events.slice(0, 3), ['ack', 'account', 'history']);
  assert.match(first.payload.embeds[0].data.description, /該当12件中、1〜10/);
  const firstControls = components(first);
  assert.deepEqual(firstControls[0].components[0].default_values, [{ id: other, type: 'user' }]);
  const next = interaction('button', firstControls[3].components[1].custom_id, events);
  next.deferred = true;
  await handlePanelButton(next);
  assert.match(next.payload.embeds[0].data.description, /11〜12/);
  const nextState = parseHistoryCustomId(components(next)[0].components[0].custom_id, user);
  assert.deepEqual(nextState.filters, { ...selected, counterparty: other });
  const reset = interaction('button', components(next)[3].components[2].custom_id, events);
  await handlePanelButton(reset);
  assert.match(reset.payload.embeds[0].data.description, /該当13件中、1〜10/);
  assert.equal(components(reset)[3].components[2].disabled, true);
});

test('zero results clear old entries but retain controls; clearing selection restores results', async t => {
  const events = await withHistory(t, [action(1, A.CASINO_GF)]);
  const selected = filters({ counterparty: third, groups: [casino] });
  const i = interaction('string', historyCustomId(user, selected, 'direction'), events, ['expense']);
  await handleStringSelectMenu(i);
  assert.match(i.payload.embeds[0].data.description, /条件に一致する取引履歴がありません/);
  assert.equal(i.payload.embeds[0].data.fields?.length || 0, 0);
  assert.equal(i.payload.content, '');
  const rows = components(i);
  assert.equal(rows.length, 4);
  assert.equal(rows[3].components[2].disabled, false);
  const clear = interaction('user', historyCustomId(user, filters({ counterparty: third }), 'counterparty'), events, []);
  await handleUserSelectMenu(clear);
  assert.match(clear.payload.embeds[0].data.description, /該当1件/);
  assert.equal(components(clear)[0].components[0].default_values?.length || 0, 0);
});

test('action selections use OR and clearing them restores all types', async t => {
  const events = await withHistory(t, [action(1, A.CASINO_GF), action(2, A.TRANSFER)]);
  const i = interaction('string', historyCustomId(user, filters(), 'groups'), events, [String(casino)]);
  await handleStringSelectMenu(i);
  assert.match(i.payload.embeds[0].data.description, /該当1件/);
  const clear = interaction('string', components(i)[1].components[0].custom_id, events, []);
  await handleStringSelectMenu(clear);
  assert.match(clear.payload.embeds[0].data.description, /該当2件/);
});

test('empty history has valid disabled options; full history respects Discord component/embed limits', async t => {
  await withHistory(t, []);
  const i = interaction('button', PANEL_COMMAND_NAMES.HISTORY, []);
  await HistoryService.viewHistory(i);
  assert.match(i.payload.embeds[0].data.description, /取引履歴がありません/);
  assert.equal(components(i)[1].components[0].disabled, true);
  const allRows = Object.values(A).map((type, index) => action(index, type));
  const allFilters = filters({ counterparty: other, groups: groups.map((_, index) => index), direction: 'income' });
  const allComponents = HistoryService.createFilterComponents(user, allFilters, allRows, 1, 2).map(row => row.toJSON());
  assert.ok(allComponents.length <= 5);
  assert.ok(allComponents[1].components[0].options.length <= 25);
  allComponents.flatMap(row => row.components).forEach(c => assert.ok(c.custom_id.length <= 100));
  const strings = Array.from({ length: 10 }, (_, index) => HistoryService.createHistoryString(action(index, A.TRANSFER, { comment: '長'.repeat(350) }), user));
  const pages = HistoryService.createHistoryPages(strings);
  for (const page of pages) {
    const fields = HistoryService.createHistoryEmbedFields(page);
    assert.ok(fields.length <= 25);
    assert.ok(fields.every(field => field.value.length <= 1024));
    const conditionLength = groups.map(g => g.label).join('・').length + 250;
    assert.ok(fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0) + conditionLength < 6000);
  }
});


test('market combines purchases, stamps, ticket exchange and name changes and migrates old selections', async t => {
  const types = [A.SHOP_PURCHASE, A.DARK_SHOP_PURCHASE, A.COURT_SHOP_PURCHASE, A.MARKET_GACHA_DRAW, A.CREATOR_EMBLEM_PAYMENT, A.TICKET_EXCHANGE, A.DISPLAY_NAME_CHANGE];
  const market = groups.findIndex(group => group.label === '市場・夢印' && !group.hidden);
  const rows = types.map((type, i) => action(i + 1, type, type === A.TICKET_EXCHANGE
    ? { from_user_id: BOT_ID, to_user_id: user } : { from_user_id: user, to_user_id: BOT_ID }));
  rows.push(action(8, A.CASINO_GF));
  const events = await withHistory(t, rows);
  for (const oldGroup of [market, 3, 4, 5, 8, 10, 17]) {
    const i = interaction('button', historyCustomId(user, filters({ groups: [oldGroup] }), 'page'), events);
    await handlePanelButton(i);
    assert.match(i.payload.embeds[0].data.description, /種類：市場・夢印/);
    assert.match(i.payload.embeds[0].data.description, /該当7件/);
    const options = components(i)[1].components[0].options;
    assert.deepEqual(options.map(option => option.label), ['カジノ（GF・麻雀・その他）', '市場・夢印']);
    assert.doesNotMatch(JSON.stringify(i.payload.embeds.map(embed => embed.toJSON())), /宮廷/);
    assert.deepEqual(parseHistoryCustomId(components(i)[1].components[0].custom_id, user).filters.groups, [market]);
  }
  const onlyCourt = HistoryService.createFilterComponents(user, filters(), [rows[2]], 1, 1).map(row => row.toJSON());
  assert.deepEqual(onlyCourt[1].components[0].options.map(option => option.label), ['市場・夢印']);
});


test('merged transfer and adjustment groups preserve income/expense and old selections', async t => {
  const rows = [action(1, A.TRANSFER), action(2, A.SUPERCHAT),
    action(3, A.ROLE_BASED_GRANT), action(4, A.ADMIN_MINT),
    action(5, A.ADMIN_BURN, { from_user_id: user, to_user_id: other }),
    action(6, A.CASINO_GF)];
  const events = await withHistory(t, rows);
  for (const [oldGroup, currentGroup, label, income, expense] of [
    [0, 0, '送金', [2, 1], []], [6, 0, '送金', [2, 1], []],
    [14, 15, '付与・剥奪', [4, 3], [5]], [15, 15, '付与・剥奪', [4, 3], [5]],
    [16, 15, '付与・剥奪', [4, 3], [5]],
  ]) {
    assert.deepEqual(HistoryService.filterActions(rows, user, filters({ groups: [oldGroup], direction: 'income' })).map(row => row.id), income);
    assert.deepEqual(HistoryService.filterActions(rows, user, filters({ groups: [oldGroup], direction: 'expense' })).map(row => row.id), expense);
    const i = interaction('button', historyCustomId(user, filters({ groups: [oldGroup] }), 'page'), events);
    await handlePanelButton(i);
    assert.ok(i.payload.embeds[0].data.description.includes(`種類：${label}`));
    assert.deepEqual(parseHistoryCustomId(components(i)[1].components[0].custom_id, user).filters.groups, [currentGroup]);
  }
  assert.equal(groups.filter(group => !group.hidden).length, 15);
});
