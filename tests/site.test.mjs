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
test("Buyer-facing copy does not invent customer results or certification",()=>{
 assert.doesNotMatch(en,/over [0-9]+ satisfied customers|guaranteed payouts|verified paid clients/i);
 assert.doesNotMatch(ko,/고객 [0-9]+명 확보|매출 [0-9]+.*달성/i);
 assert.match(en,/not formal security audits|not security certification|security certification/i);
 assert.match(ko,/보안 인증|보안 감사/);
});
test("Reported test counts are grounded in checked project outputs",()=>{
 for(const html of [en,ko]){
  assert.match(html,/(41 passing checks|41개 자동 테스트 통과)/);
  assert.match(html,/(24 pytest cases|24개 pytest)/);
 }
});
test("All external new-tab links use noopener noreferrer",()=>{
 for(const html of [en,ko]){
  const anchors=[...html.matchAll(/<a\b[^>]*>/g)].map(m=>m[0]);
  for(const tag of anchors){
   if(tag.includes('target="_blank"'))assert(tag.includes('rel="noopener noreferrer"'),tag.slice(0,100));
  }
 }
});
test("Root sitemap contains only both canonical paths and no cross-project duplicate",()=>{
 const sitemap=read("sitemap.xml");
 const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
 assert.deepEqual(urls,[domain+"/",domain+"/ko/"]);
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
