const assert = require('assert');
const { getWslpb, getAddressType, estimateTransactionSize } = require('../utils.js');

function testGetWslpb() {
  assert.strictEqual(getWslpb(10), 1);
  assert.strictEqual(getWslpb(75), 1);
  assert.strictEqual(getWslpb(76), 2);
  assert.strictEqual(getWslpb(255), 2);
  assert.strictEqual(getWslpb(256), 3);
}

function testGetAddressType() {
  assert.strictEqual(getAddressType('1abc'), 'P2PKH');
  assert.strictEqual(getAddressType('3xyz'), 'P2SH');
  assert.strictEqual(getAddressType('bc1q' + 'a'.repeat(38)), 'Bech32');
  assert.strictEqual(getAddressType('bc1q' + 'a'.repeat(58)), 'P2WSH');
  assert.strictEqual(getAddressType('bc1p' + 'a'), 'Taproot');
  assert.strictEqual(getAddressType('zzzz'), 'Unknown');
}

function testEstimateTransactionSize() {
  assert.strictEqual(estimateTransactionSize('P2PKH', 1, 1), 192);
  assert.strictEqual(estimateTransactionSize('P2SH', 1, 1), 133);
  assert.strictEqual(estimateTransactionSize('P2WSH', 1, 1, 2, 3), 117);
  assert.strictEqual(estimateTransactionSize('P2SH', 1, 1, 2, 3, true), 329);
}

function run() {
  testGetWslpb();
  testGetAddressType();
  testEstimateTransactionSize();
  console.log('All tests passed');
}

run();
