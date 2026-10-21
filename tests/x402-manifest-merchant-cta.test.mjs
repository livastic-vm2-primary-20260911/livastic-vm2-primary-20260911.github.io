import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('public x402 merchant value path has a free check and a distinct optional real priced listing',()=>{
  assert.equal((html.match(/id="x402-merchant"/g)||[]).length,1);
  assert.match(html,/href="https:\/\/livastic-vm2-primary-20260911\.github\.io\/x402-manifest-import-preflight\/"/);
  assert.match(html,/href="https:\/\/github\.com\/livastic-vm2-primary-20260911\/x402-manifest-import-preflight\/releases\/tag\/v1\.1\.0"/);
  assert.match(html,/href="https:\/\/clawlancer\.ai\/marketplace\/3afdccb7-ecd3-471b-b3b0-8983543cfce7"/);
  assert.match(html,/Optional fixed 19 native Circle USDC/);
  assert.match(html,/payment audit or proof of settlement/);
  const block=html.slice(html.indexOf('id="x402-merchant"'),html.indexOf('id="local-csv"'));
  assert.equal((block.match(/rel="noopener noreferrer"/g)||[]).length,3);
  assert.doesNotMatch(block,/<script\b|private key|secret phrase/i);
});
