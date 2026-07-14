const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateShopTicketDiscount,
  getShopTicket,
  isShopTicketType,
  SHOP_TICKET_MAX_APPLICABLE_AMOUNT,
  SHOP_TICKET_TYPE,
} = require("../dist/constant/shopTicket.js");

test("ショップ割引券は5%・10%の2種類を受け付ける", () => {
  assert.equal(isShopTicketType(SHOP_TICKET_TYPE.DISCOUNT_5), true);
  assert.equal(isShopTicketType(SHOP_TICKET_TYPE.DISCOUNT_10), true);
  assert.equal(isShopTicketType("none"), false);
  assert.equal(getShopTicket(SHOP_TICKET_TYPE.DISCOUNT_5).discountRate, 5);
  assert.equal(getShopTicket(SHOP_TICKET_TYPE.DISCOUNT_10).discountRate, 10);
});

test("ショップ割引額は端数を切り捨てる", () => {
  assert.deepEqual(
    calculateShopTicketDiscount(12345, SHOP_TICKET_TYPE.DISCOUNT_5),
    { discountAmount: 617, paymentAmount: 11728 },
  );
  assert.deepEqual(
    calculateShopTicketDiscount(12345, SHOP_TICKET_TYPE.DISCOUNT_10),
    { discountAmount: 1234, paymentAmount: 11111 },
  );
});

test("ショップ割引券の上限は100万krm未満", () => {
  assert.equal(SHOP_TICKET_MAX_APPLICABLE_AMOUNT, 1000000);
});
