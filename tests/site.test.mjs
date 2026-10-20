import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=rel=>fs.readFileSync(path.join(root,rel),"utf8");
const en=read("index.html"),ko=read("ko/index.html");
const domain="https://livastic-vm2-primary-20260911.github.io";
test("main and Korean pages have correct titles, languages, canonical URLs",()=>{
 for(const [html,lang,url] of [[en,"en",domain+"/"],[ko,"ko",domain+"/ko/"]]){
  assert(html.includes('<html lang="'+lang+'">'));
  assert(html.includes('<link rel="canonical" href="'+url+'">'));
  assert.match(html,/<title>.{20,}/);
  assert(html.includes("</title>"));
  assert.match(html,/<meta name="description" content="[^"]{45,}">/);
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
 }
});
test("Both languages have reciprocal hreflang for international indexing",()=>{
 for(const html of [en,ko]){
  assert(html.includes('hreflang="en" href="'+domain+'/'));
  assert(html.includes('hreflang="ko" href="'+domain+'/ko/'));
  assert(html.includes('hreflang="x-default" href="'+domain+'/'));
 }
});
test("Public CI and Python evidence links match original source repositories",()=>{
 for(const html of [en,ko]){
  for(const repo of ["workflow-risk-check","csv-json-guard"]){
   assert(html.includes("https://github.com/livastic-vm2-primary-20260911/"+repo));
  }
  assert(html.includes("https://livastic-vm2-primary-20260911.github.io/workflow-risk-check/"));
  assert(html.includes("https://livastic-vm2-primary-20260911.github.io/taskproof-ai/"));
 }
});
test("Real offer links present; no fabricated checkout/Stripe buttons",()=>{
 for(const html of [en,ko]){
  assert(html.includes("https://dealwork.ai/agents/2c0f6565-405b-4fb6-8a1c-4e2baa3d8ac1"));
  assert(html.includes("https://clawlancer.ai/marketplace/bec9d133-5388-4ecb-ad42-98bcf961ad4e"));
  assert(html.includes("https://docs.google.com/forms/d/e/1FAIpQLSeyoqmSgtcgspZ9jJq78dLBhsq50KDbhdVGcmZP5EQCouY3Qg/viewform"));
  assert(!html.includes("checkout.stripe.com"));
  assert(!html.includes("connectWallet("));
 }
});
test("Low-priced Clawlancer listing has bilingual order CTAs without fabricated sales claims",()=>{
 const starter="https://clawlancer.ai/marketplace/1be00886-ce81-4398-ab6a-d2322207a551";
 for(const html of [en,ko]){
  assert.equal((html.match(new RegExp(starter,"g"))||[]).length,2);
  assert(html.includes("4 USDC"));
  assert(html.includes("300"));
  assert(html.includes("bec9d133-5388-4ecb-ad42-98bcf961ad4e")); // retain original 25 USDC choice
 }
 assert.match(en,/not a security audit or guarantee/);
 assert.match(ko,/정식 보안 감사나 안전 보증/);
 assert.match(en,/Work starts only after deliverables, acceptance criteria and payment arrangements are agreed/);
 assert.match(ko,/산출물·검수 조건·결제 방식을 확정한 후/);
});
test("Buyer can reach actual 25 USDC offering instead of generic Dealwork hiring profile",()=>{
 const originalPrice="https://clawlancer.ai/marketplace/bec9d133-5388-4ecb-ad42-98bcf961ad4e";
 const oldProfile="https://dealwork.ai/agents/2c0f6565-405b-4fb6-8a1c-4e2baa3d8ac1";
 const form="https://docs.google.com/forms/d/e/1FAIpQLSeyoqmSgtcgspZ9jJq78dLBhsq50KDbhdVGcmZP5EQCouY3Qg/viewform";
 for(const html of [en,ko]){
  assert(html.includes('25 USDC <small>'));
  assert(html.includes(originalPrice));
  assert.equal(html.split(oldProfile).length-1,1,"legacy hiring-only profile should not occupy product CTAs");
  assert(html.split(form).length-1>=2,"$19 scoped quote and remediation must retain honest buyer inquiry paths; footer may repeat");
  assert(html.indexOf(originalPrice)<html.indexOf(oldProfile),"direct offer must be encountered first");
  assert(!html.includes('>$25 <small>USD · fixed listing'));
 }
 assert.match(en,/profile, not a direct service checkout/i);
 assert.match(ko,/상품 즉시 결제 페이지는 아님/);
 assert.match(en,/zero confirmed paid orders/);
 assert.match(ko,/실제 주문은 현재 0건/);
 assert.match(en,/not direct checkout/);
 assert.match(ko,/즉시 결제 아님/);
});

test("Buyer-facing copy does not invent customer results or certification",()=>{
 assert.doesNotMatch(en,/over [0-9]+ satisfied customers|guaranteed payouts|verified paid clients/i);
 assert.doesNotMatch(ko,/고객 [0-9]+명 확보|매출 [0-9]+.*달성/i);
 assert.match(en,/not formal security audits|not security certification|security certification/i);
 assert.match(ko,/보안 인증|보안 감사/);
});
test("Reported test counts are grounded in checked project outputs",()=>{
 for(const html of [en,ko]){
  assert.match(html,/(42 passing checks|42개 자동 테스트 통과)/);
  assert.match(html,/(24 pytest cases|24개 pytest)/);
 }
});
test("Accepted independent software fix is documented as unpaid, not a customer",()=>{
 const url="https://github.com/Hugo0/swarmmemo/pull/17#issuecomment-6269423069";
 const shipped="https://github.com/Hugo0/swarmmemo/pull/17#issuecomment-6270609449";
 for(const html of [en,ko]){
  assert.equal(html.split(url).length-1,1);
  assert(html.includes("0.05 USDC"));
  assert.equal(html.split(shipped).length-1,1);
 }
 assert.match(en,/No SwarmMemo payment has been received/i);
 assert.match(en,/PR is still open/i);
 assert.match(ko,/아직 SwarmMemo 보상금은 실제 입금되지/);
 assert.match(ko,/PR도 열려/);
});
test("Same-owner VM5 paid APIs are linked honestly without claiming VM2 sales",()=>{
 const doc="https://vm5-openapi-x402.onrender.com/llms.txt";
 const spec="https://vm5-openapi-x402.onrender.com/openapi.json";
 for(const html of [en,ko]){
  assert.equal(html.split(doc).length-1,1);
  assert.equal(html.split(spec).length-1,1);
  assert(html.includes("0.010 USDC"));
  assert(html.includes("0.005 USDC"));
  assert(html.includes("1be00886-ce81-4398-ab6a-d2322207a551"));
 }
 assert.match(en,/not recurring subscriptions or VM2 service orders/);
 assert.match(ko,/정기 구독이나 VM2 판매 상품의 주문 실적이 아닙니다/);
});
test("All external new-tab links use noopener noreferrer",()=>{
 for(const html of [en,ko]){
  const anchors=[...html.matchAll(/<a\b[^>]*>/g)].map(m=>m[0]);
  for(const tag of anchors){
   if(tag.includes('target="_blank"'))assert(tag.includes('rel="noopener noreferrer"'),tag.slice(0,100));
  }
 }
});
test("Root sitemap contains the two homepages and two new original bilingual guides without cross-project duplication",()=>{
 const sitemap=read("sitemap.xml");
 const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
 assert.deepEqual(urls,[domain+"/",domain+"/ko/",domain+"/guides/pull-request-target-november-2026/",domain+"/ko/guides/pull-request-target-2026/",domain+"/csv-preflight/",domain+"/ko/csv-preflight/"]);
 assert.equal(new Set(urls).size,urls.length);
 assert(read("robots.txt").includes("Sitemap: "+domain+"/sitemap.xml"));
});
test("Site has style and source, without user-tracking scripts or third-party crypto widgets",()=>{
 assert(fs.statSync(path.join(root,"assets/style.css")).size>2500);
 for(const html of [en,ko]){
  assert(html.includes('href="/assets/style.css"'));
  assert(!/google-analytics\.com|googletagmanager\.com|gtag\(|mixpanel|amplitude\.init/i.test(html));
  assert(!/private key|seed phrase/i.test(html));
 }
});
test("Service steps do not imply a signed contract or safe scan from a contact form",()=>{
 assert.match(en,/No security engagement starts from a contact form submission alone/i);
 assert.match(ko,/상담 신청만으로 계약이나 접근 허가가 성립하지 않습니다/);
});


test("CSV paid buyer conversion references only original VM5 and discloses new settlement limits",()=>{
 const free="https://vm5-openapi-x402.onrender.com/v1/csv-sample";
 const paid="https://vm5-openapi-x402.onrender.com/v1/csv-report";
 const guide="https://github.com/livastic-vm5-primary-20260911/x402-openapi-lint/blob/main/docs/CSV_REAL_DATA_BUYER_QUICKSTART_20261020.md";
 for(const html of [en,ko]){
   assert.equal(html.split('id="paid-csv"').length-1,1);
   assert(html.indexOf('id="paid-csv"')<html.indexOf('id="tls"'));
   assert(html.includes(free));assert(html.includes(paid));assert(html.includes(guide));
   assert(html.includes("0.005"));assert(html.includes("PayAI"));
   assert(!html.includes("guaranteed 2 paid customers"));
 }
 assert.match(en,/exact response-to-transaction mapping remains unverified/);
 assert.match(ko,/일대일 연결은 아직 미검증입니다/);
 assert.match(en,/zero independently confirmed POST purchases/);
 assert.match(ko,/POST 상품의 검증된 실제 구매는 아직 0건/);
 assert.match(en,/HTTP 402 alone is not a sale/);
 assert.match(ko,/HTTP 402 자체는 결제가 아닙니다/);
});

test("Bilingual public route demonstration is honest and links only the original source",()=>{
  const url="https://livastic-vm2-primary-20260911.github.io/vm2-route-backfill-demo-20261018/";
  for(const html of [en,ko]){
    assert.equal(html.split(url).length-1,1);
    assert(html.includes("36/36"));
    assert(html.includes("390 USDC"));
    assert(!/390 USDC (?:earned|received|paid to us)|390 USDC(?:를)? (?:입금받|확정 수익)/i.test(html));
  }
});
