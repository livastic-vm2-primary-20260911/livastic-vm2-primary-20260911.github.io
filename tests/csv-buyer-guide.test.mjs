import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const domain="https://livastic-vm2-primary-20260911.github.io";
const read=(p)=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const en=read("csv-preflight/index.html");
const ko=read("ko/csv-preflight/index.html");
test("Both bilingual CSV pages are separately indexed, canonical, reciprocal and linked by site",()=>{
 for(const [html,loc] of [[en,"/csv-preflight/"],[ko,"/ko/csv-preflight/"]]){
  assert(html.includes('<link rel="canonical" href="'+domain+loc+'"'));
  assert(html.includes('hreflang="en"'));assert(html.includes('hreflang="ko"'));
  assert(html.includes('href="/assets/style.css"'));assert(html.includes('"@type":"WebPage"'));
  assert(!html.includes('"aggregateRating"'));
 }
 assert(read("sitemap.xml").includes(domain+"/csv-preflight/"));
 assert(read("sitemap.xml").includes(domain+"/ko/csv-preflight/"));
 assert(read("index.html").includes('href="/csv-preflight/"'));
 assert(read("ko/index.html").includes('href="/ko/csv-preflight/"'));
});
test("Free sample, paid static GET and buyer-input paid POST remain distinct with accurate pricing",()=>{
 const get="https://vm5-openapi-x402.onrender.com/v1/csv-report";
 const sample="https://vm5-openapi-x402.onrender.com/v1/csv-sample";
 const postGuide="https://github.com/livastic-vm5-primary-20260911/x402-openapi-lint/blob/main/docs/CSV_REAL_DATA_BUYER_QUICKSTART_20261020.md";
 for(const html of [en,ko]){
  assert(html.includes(get));assert(html.includes(sample));assert(html.includes(postGuide));
  assert(html.includes("POST /v1/csv-preflight"));assert(html.includes("GET /v1/csv-report"));
  assert(html.includes("0.005"));assert(html.includes("eip155:8453"));
  assert(!/<form\b/i.test(html));
  assert(!/name="(wallet|token|email|password)"/i.test(html));
  assert.doesNotMatch(html,/guaranteed payouts|thousands of paying customers|verified (?:100|1000) buyers/i);
 }
 assert.match(en,/402 is not payment/i);
 assert.match(ko,/HTTP 402는 결제 지시/);
 assert.match(en,/no verified independent paid purchase of the buyer-input POST/);
 assert.match(ko,/POST의 독립적인 실결제는 아직 확인되지/);
});
test("Safe links and text-only docs: no automatic pay, tracking scripts or unguarded new tabs",()=>{
 for(const html of [en,ko]){
  for(const [tag] of html.matchAll(/(<a\b[^>]*>)/g)) if(tag.includes('target="_blank"')) assert(tag.includes('rel="noopener noreferrer"'),tag);
  assert(!/<script(?![^>]*application\/ld\+json)/i.test(html));
  assert(!html.includes("google-analytics.com"));assert(!html.includes("gtag("));
 }
});

test("Buyer-first CTA experiment: actual buyer-input POST purchase guide precedes free-only sample",()=>{
 const paid="https://github.com/livastic-vm5-primary-20260911/x402-openapi-lint/blob/main/docs/CSV_REAL_DATA_BUYER_QUICKSTART_20261020.md";
 const free="https://vm5-openapi-x402.onrender.com/v1/csv-sample";
 for(const html of [en,ko]){
  const actions=html.match(/<div class="actions">([\s\S]*?)<\/div>/)?.[1];
  assert(actions,"visible CTA group must exist");
  assert(actions.includes('class="btn primary" href="'+paid+'"'));
  assert(actions.includes('class="btn secondary" href="'+free+'"'));
  assert(actions.indexOf(paid)<actions.indexOf(free));
  assert(!/<script(?![^>]*application\/ld\+json)/i.test(html));
 }
 assert.match(en,/0\.005 USDC payment steps/);
 assert.match(ko,/0\.005 USDC 구매 절차/);
});
