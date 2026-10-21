import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {analyze, parseTrace, EXAMPLES, usdc, MAX_EVENTS} from "../x402-trace/engine.mjs";
const fixture=trace=>JSON.stringify({synthetic:true,trace});
const codes=x=>x.requests.flatMap(r=>r.findings.map(f=>f.code));
const site=readFileSync(new URL("../x402-trace/index.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../x402-trace/app.mjs",import.meta.url),"utf8");
test("real lost-response scenario flags the claimed settled-but-undelivered path",()=>{
 const x=analyze(JSON.stringify(EXAMPLES.missingDelivery));
 assert.equal(x.requestCount,1);assert.equal(x.eventCount,4);
 assert(codes(x).includes("SETTLED_NO_DELIVERY_ENTRY"));
 assert(codes(x).includes("RETRY_AFTER_SETTLEMENT_CLAIM"));
 assert.equal(x.requests[0].status,"REVIEW_URGENT");
 assert.equal(x.verifiedOnchainSettlement,false);
 assert.equal(x.verifiedExternalServiceDelivery,false);
});
test("separate paid labels for same request become possible duplicate, not claimed proven double charge",()=>{
 const x=analyze(JSON.stringify(EXAMPLES.doublePayment));
 assert(codes(x).includes("POSSIBLE_DUPLICATE_SETTLEMENT"));
 assert.equal(x.requests[0].distinctPaymentLabels,2);
 assert.equal(x.verifiedPaidCustomer,false);
});
test("consistent invented trace is unverified, never safe-to-pay guarantee",()=>{
 const x=analyze(JSON.stringify(EXAMPLES.matchingClaims));
 assert.deepEqual(codes(x),["NO_CONTRADICTION_DETECTED"]);
 assert.equal(x.requests[0].status,"UNVERIFIED_SAMPLE");
 assert.match(x.caveat,/not signed chain evidence/);
});
test("same payment repeated in trace is not mistaken for independent transfers",()=>{
 const x=analyze(fixture([{request:"a",kind:"QUOTE",amountAtomic:"1"},
 {request:"a",kind:"SETTLE",payment:"p",amountAtomic:"1"},
 {request:"a",kind:"SETTLE",payment:"p",amountAtomic:"1"},
 {request:"a",kind:"DELIVER",payment:"p",delivery:"d"}]));
 assert.equal(x.requests[0].distinctPaymentLabels,1);
 assert(!codes(x).includes("POSSIBLE_DUPLICATE_SETTLEMENT"));
});
test("last quote must agree with claimed amount; exact six-decimal bigint only",()=>{
 const x=analyze(fixture([{request:"r",kind:"QUOTE",amountAtomic:"5000000"},
 {request:"r",kind:"SETTLE",payment:"p",amountAtomic:"5000001"}]));
 assert(codes(x).includes("PRICE_MISMATCH"));
 assert.equal(usdc("1234567"),"1.234567 USDC");
 assert.equal(usdc("1"),"0.000001 USDC");
});
test("verify by itself does not imply final settlement",()=>{
 const x=analyze(fixture([{request:"r",kind:"VERIFY",payment:"p"}]));
 assert(codes(x).includes("VERIFIED_NOT_SETTLED"));
});
test("replay rejection without prior settled entry cannot prove transfer",()=>{
 const x=analyze(fixture([{request:"r",kind:"REPLAY_REJECTED",payment:"p"}]));
 assert(codes(x).includes("REPLAY_REJECTED_NOT_FINALITY"));
});
test("price changes need buyer authorization, not silent retry",()=>{
 const x=analyze(fixture([{request:"r",kind:"PRICE_CHANGED"}]));
 assert(codes(x).includes("PRICE_CHANGED_REQUIRES_NEW_CONSENT"));
});
test("grouping keeps logical requests separate",()=>{
 const x=analyze(fixture([{request:"A",kind:"QUOTE",amountAtomic:"5"},
 {request:"B",kind:"VERIFY",payment:"p"},
 {request:"B",kind:"DELIVER",payment:"p",delivery:"d"}]));
 assert.equal(x.requestCount,2);
 assert.equal(x.requests[0].request,"A");
 assert.equal(x.requests[1].request,"B");
});
test("rejects extraneous/sensitive unknown fields, actual wallet and signature identifiers",()=>{
 assert.throws(()=>parseTrace(JSON.stringify({synthetic:true,trace:[{request:"r",kind:"QUOTE",amountAtomic:"1",privateKey:"SECRET"}]})),/unexpected field/);
 assert.throws(()=>parseTrace(fixture([{request:"0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",kind:"QUOTE",amountAtomic:"1"}])),/fictional short label/);
 assert.throws(()=>parseTrace(fixture([{request:"r",kind:"SETTLE",payment:"p",amountAtomic:2.5}])),/integer string/);
 assert.throws(()=>parseTrace(fixture([{request:"r",kind:"SETTLE",payment:"p",amountAtomic:"1e6"}])),/integer string/);
 assert.throws(()=>parseTrace(JSON.stringify({synthetic:false,trace:[{request:"r",kind:"VERIFY",payment:"p"}]})),/synthetic:true/);
});
test("fails closed on invalid huge input and unsupported record kinds",()=>{
 assert.throws(()=>parseTrace("x".repeat(32769)),/Maximum 32 KiB/);
 const bad=Array.from({length:MAX_EVENTS+1},()=>({request:"r",kind:"QUOTE",amountAtomic:"1"}));
 assert.throws(()=>parseTrace(fixture(bad)),/1 to 32/);
 assert.throws(()=>parseTrace(fixture([{request:"r",kind:"PAY_WALLET"}])),/Unsupported/);
});
test("user-facing tool is entirely client-side, no wallet, no upload, no fake paid orders",()=>{
 assert.match(site,/connect-src 'none'/);
 assert.match(site,/form-action 'none'/);
 assert.match(site,/No wallet connection/);
 assert.match(site,/29 native Circle Base USDC/);
 assert.match(site,/quote, not an instant checkout/);
 assert.match(site,/mailto:onecursor1@gmail.com/);
 assert.match(site,/clawlancer\.ai\/marketplace\/84efd440-a7cd-4932-8d5d-415e7f05d33b/);
 assert.match(site,/fixed 29 native Circle Base USDC/);
 assert.match(site,/no verified previous customers/);
 assert(!/https?:\/\/(?:js\.stripe\.com|cdn\.)/i.test(site));
 assert(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|connectWallet/.test(app));
 assert.match(app,/textContent=/);
 assert(!/innerHTML|eval\(/.test(app));
});
test("root homepage and the child index are same-origin and marketing not fake sale",()=>{
 const homepage=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ko=readFileSync(new URL("../ko/index.html",import.meta.url),"utf8");
 const index=readFileSync(new URL("../sitemap-index.xml",import.meta.url),"utf8");
 const child=readFileSync(new URL("../x402-trace/sitemap.xml",import.meta.url),"utf8");
 assert(homepage.includes('href="/x402-trace/"'));
 assert(ko.includes('href="/x402-trace/"'));
 assert(index.includes("https://livastic-vm2-primary-20260911.github.io/x402-trace/sitemap.xml"));
 assert(child.includes("https://livastic-vm2-primary-20260911.github.io/x402-trace/"));
});
