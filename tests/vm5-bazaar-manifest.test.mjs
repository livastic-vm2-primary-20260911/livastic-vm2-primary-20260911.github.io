import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('../vm5-x402-agent-bazaar.json', import.meta.url), 'utf8'));
test('same-owner paid API listing: valid manifest and truthful supported prices', () => {
  assert.equal(data.x402Version, 2);
  assert.equal(data.resources.length, 4);
  const amounts = ['10000', '5000', '5000', '5000'];
  const paths = ['/v1/x402-template', '/v1/csv-report', '/v1/email-dns-preflight?domain=gmail.com', '/v1/https-cert-preflight?domain=github.com'];
  for (const [i, entry] of data.resources.entries()) {
    assert.equal(entry.url, 'https://vm5-openapi-x402.onrender.com' + paths[i]);
    assert.equal(entry.method, 'GET');
    assert.ok(entry.description.length > 65 && entry.description.length < 500);
    assert.equal(entry.accepts.length, 1);
    assert.equal(entry.accepts[0].scheme, 'exact');
    assert.equal(entry.accepts[0].network, 'eip155:8453');
    assert.equal(entry.accepts[0].asset.toLowerCase(), '0x833589fcD6edb6e08f4c7c32d4f71b54bdA02913'.toLowerCase());
    assert.equal(entry.accepts[0].amount, amounts[i]);
    assert.match(entry.accepts[0].payTo, /^0x[0-9a-fA-F]{40}$/);
  }
  assert.equal(new Set(data.resources.map(r => r.accepts[0].payTo.toLowerCase())).size, 1);
  assert.match(data.note, /not a sale/i);
});
