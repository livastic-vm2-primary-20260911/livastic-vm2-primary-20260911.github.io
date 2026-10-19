import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const BASE='https://vm5-openapi-x402.onrender.com';
const en=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ko=readFileSync(new URL('../ko/index.html',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../vm5-x402-agent-bazaar.json',import.meta.url),'utf8'));

test('EN+KO pages expose one free TLS example and one paid original VM5 route each',()=>{
 for(const [language,html] of [['EN',en],['KO',ko]]){
  for(const path of ['/v1/tls-certificate-sample','/v1/https-cert-preflight?domain=github.com'])
   assert.equal(html.split(BASE+path).length-1,1,language+' '+path);
  assert.ok(html.includes('0.005'),language);
  assert.ok(html.includes('HTTP 402'),language);
  assert.ok(html.includes('noopener noreferrer'),language);
 }
});

test('both languages explicitly say new TLS product has zero actual paid customers',()=>{
 assert.match(en,/New endpoint had zero verified independent paid orders/i);
 assert.match(ko,/실제 결제 고객은 0명/);
 assert.match(en,/not a sale/i);
 assert.match(ko,/매출이 아닙니다/);
 assert.match(en,/internal endpoints/i);
 assert.match(ko,/내부 IP/);
});

test('TLS paid product is discoverable near the top without fake purchase proof',()=>{
 for(const html of [en,ko]){
  const hero=html.indexOf('class="hero-tls" id="tls"');
  const proof=html.indexOf('class="stats"');
  assert.ok(hero>0 && hero<proof,"Paid TLS preflight must appear before the proof grid");
  assert.ok(html.indexOf('/v1/tls-certificate-sample')<proof,"Free demo should be above fold");
 }
 assert.match(en,/<meta name="description" content="[^"]*TLS certificate expiry[^"]*">/);
 assert.match(ko,/<meta name="description" content="[^"]*TLS 인증서 만료일[^"]*">/);
});
test('public x402 discovery uses one ORIGINAL VM5 recipient and correct 5000 atomic price',()=>{
 assert.equal(manifest.resources.length,4);
 const tls=manifest.resources.at(-1);
 assert.equal(tls.url,BASE+'/v1/https-cert-preflight?domain=github.com');
 assert.equal(tls.method,'GET');
 assert.equal(tls.accepts.length,1);
 const a=tls.accepts[0];
 assert.equal(a.scheme,'exact');
 assert.equal(a.network,'eip155:8453');
 assert.equal(a.amount,'5000');
 assert.equal(a.asset.toLowerCase(),'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
 assert.equal(a.payTo.toLowerCase(),'0x6b01efa0705e91a7aca54271510bf9e594717f34');
 assert.equal(new Set(manifest.resources.map(x=>x.accepts[0].payTo.toLowerCase())).size,1);
 assert.match(manifest.note,/not a sale/i);
});
