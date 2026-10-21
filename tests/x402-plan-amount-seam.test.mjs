import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {inspectPlanMatrix,readPlanMatrix,PLAN_EXAMPLES} from "../x402-trace/plan-seam.mjs";
const codes=x=>x.planFindings.flatMap(p=>p.findings.map(f=>f.code));
const short=x=>JSON.stringify(x);
const only=plan=>short({synthetic:true,plans:[plan]});
const originalHtml=readFileSync(new URL("../x402-trace/index.html",import.meta.url),"utf8");
const ui=readFileSync(new URL("../x402-trace/plan-ui.mjs",import.meta.url),"utf8");
const css=readFileSync(new URL("../x402-trace/plan-seam.css",import.meta.url),"utf8");
test("real-world-inspired 9 USDC versus 0.005 per-call default mismatch is independently obvious",()=>{
 const r=inspectPlanMatrix(short(PLAN_EXAMPLES.brokenSubscription));
 assert.equal(r.planCount,3);
 assert.equal(r.highRiskPlanCount,2);
 assert(codes(r).includes("CHALLENGE_VS_VERIFIER_MISMATCH"));
 assert.equal(r.planFindings[1].challengeUSDC,"9.000000 USDC");
 assert.equal(r.planFindings[1].verifyUSDC,"0.005000 USDC");
 assert(r.crossChecks.some(f=>f.code==="SHARED_VERIFIER_DEFAULT_ACROSS_MULTIPLE_PRICES"));
 assert.equal(r.verifiedPayment,false);
 assert.equal(r.liveVerifierExecuted,false);
 assert.equal(r.verifiedMerchant,false);
});
test("correct multi-price flow remains hypothetical, not real settled or fulfilled",()=>{
 const r=inspectPlanMatrix(short(PLAN_EXAMPLES.correctedPrices));
 assert.equal(r.highRiskPlanCount,0);
 assert.equal(r.crossChecks.length,0);
 assert(r.planFindings.every(p=>p.findings[0].code==="AMOUNTS_MATCH_IN_THIS_SCENARIO_ONLY"));
 assert.match(r.disclaimer,/cannot inspect a real HTTP 402/);
 assert.match(r.testRecipe,/fake facilitator/);
});
test("UI display amount must equal x402 challenge before any signing",()=>{
 const r=inspectPlanMatrix(only({plan:"PPPtier",displayedAtomic:"3000000",challengeAtomic:"9000000",verifyAtomic:"9000000"}));
 assert(codes(r).includes("DISPLAY_VS_CHALLENGE_MISMATCH"));
 assert.equal(r.highRiskPlanCount,1);
});
test("all price arithmetic is exact bigint at six USDC decimals; no numeric truncation",()=>{
 const r=inspectPlanMatrix(only({plan:"TinyFee",displayedAtomic:"1",challengeAtomic:"1",verifyAtomic:"1"}));
 assert.equal(r.planFindings[0].challengeUSDC,"0.000001 USDC");
 const large=inspectPlanMatrix(only({plan:"Large",displayedAtomic:"99999999999",challengeAtomic:"99999999999",verifyAtomic:"99999999999"}));
 assert.equal(large.planFindings[0].challengeUSDC,"99999.999999 USDC");
});
test("zero-price flows are flagged for intentional-entitlement verification",()=>{
 const r=inspectPlanMatrix(only({plan:"free",displayedAtomic:"0",challengeAtomic:"0",verifyAtomic:"0"}));
 assert(codes(r).includes("ZERO_PRICE_MUST_BE_EXPLICIT"));
 assert.equal(r.verifiedPayment,false);
});
test("fails closed on unapproved extra fields, real wallet-like names, wrong/missing money types",()=>{
 assert.throws(()=>readPlanMatrix(short({synthetic:true,plans:[{plan:"abc",displayedAtomic:"1",challengeAtomic:"1",verifyAtomic:"1",PAYMENT_SIGNATURE:"SECRET"}]})),/unexpected field/);
 assert.throws(()=>readPlanMatrix(only({plan:"0xabcdefabcdefabcdef",displayedAtomic:"1",challengeAtomic:"1",verifyAtomic:"1"})),/short fictional/);
 assert.throws(()=>readPlanMatrix(only({plan:"abc",displayedAtomic:1,challengeAtomic:"1",verifyAtomic:"1"})),/base-unit/);
 assert.throws(()=>readPlanMatrix(only({plan:"abc",displayedAtomic:"1e6",challengeAtomic:"1",verifyAtomic:"1"})),/base-unit/);
 assert.throws(()=>readPlanMatrix(only({plan:"abc",displayedAtomic:"1.5",challengeAtomic:"1",verifyAtomic:"1"})),/base-unit/);
 assert.throws(()=>readPlanMatrix(only({plan:"abc",displayedAtomic:"0x10",challengeAtomic:"1",verifyAtomic:"1"})),/base-unit/);
});
test("prevents wrong root type, wrong flag, massive payloads and duplicate plan names",()=>{
 assert.throws(()=>readPlanMatrix("[]"),/JSON object/);
 assert.throws(()=>readPlanMatrix(short({synthetic:false,plans:[]})),/synthetic:true/);
 assert.throws(()=>readPlanMatrix("x".repeat(16385)),/16 KiB/);
 assert.throws(()=>readPlanMatrix(short({synthetic:true,plans:[]})),/1-12/);
 assert.throws(()=>readPlanMatrix(short({synthetic:true,plans:Array.from({length:13},(_,n)=>({plan:"p"+n,displayedAtomic:"1",challengeAtomic:"1",verifyAtomic:"1"}))})),/1-12/);
 assert.throws(()=>readPlanMatrix(short({synthetic:true,plans:[{plan:"same",displayedAtomic:"1",challengeAtomic:"1",verifyAtomic:"1"},{plan:"same",displayedAtomic:"1",challengeAtomic:"1",verifyAtomic:"1"}]})),/Duplicate plan/);
 assert.throws(()=>readPlanMatrix(short({synthetic:true,plans:[{plan:"p",displayedAtomic:"1",challengeAtomic:"1",verifyAtomic:"1"}],privateEmail:"test@test.dev"})),/unexpected field/);
});
test("local pre-sign UI has no network calls, secrets, wallet controls or auto-payment path",()=>{
 assert.match(originalHtml,/id="plan-verify"/);
 assert.match(originalHtml,/id="plan-results"/);
 assert.match(originalHtml,/9.000000 USDC/);
 assert.match(originalHtml,/0.005000 USDC/);
 assert.match(originalHtml,/real independent x402 developer/);
 assert.match(originalHtml,/nor a live middleware test/);
 assert(originalHtml.includes("href=\"https://dev.to/mrpkk/the-test-suite-was-green-while-the-payment-path-was-broken-1e71\""));
 assert(originalHtml.includes("connect-src 'none'"));
 assert(originalHtml.includes("form-action 'none'"));
 assert.match(css,/\.plan-section/);
 for(const bad of ["fetch(","XMLHttpRequest","sendBeacon","localStorage","connectWallet","walletClient","approve(","signTypedData","innerHTML"]){
  assert(!ui.includes(bad),"unsafe UI pattern "+bad);
 }
 assert(ui.includes(".textContent=")||ui.includes("textContent="));
});
test("original bilingual landing retains free x402 trace and 29USDC distinct real listing",()=>{
 for(const filename of ["index.html","ko/index.html"]){
  const html=readFileSync(new URL("../"+filename,import.meta.url),"utf8");
  assert.equal((html.match(/id="x402-retry-trace"/g)||[]).length,1);
  assert(html.includes('href="/x402-trace/"'));
  assert(html.includes("9")&&html.includes("0.005"));
 }
 assert(originalHtml.includes("clawlancer.ai/marketplace/84efd440-a7cd-4932-8d5d-415e7f05d33b"));
});
