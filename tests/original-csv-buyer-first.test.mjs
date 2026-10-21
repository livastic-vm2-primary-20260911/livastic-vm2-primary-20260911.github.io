import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = (p) => readFileSync(new URL("../"+p,import.meta.url),"utf8");
const yamlUrl = "https://clawlancer.ai/marketplace/1be00886-ce81-4398-ab6a-d2322207a551";
const riskUrl = "https://livastic-vm2-primary-20260911.github.io/workflow-risk-check/";

test("EN and KO homepage route interested CSV users to real buyer-input POST instructions first, free local second",()=>{
 for(const [file,guide,free] of [
  ["index.html","/csv-preflight/","/csv-checker/"],
  ["ko/index.html","/ko/csv-preflight/","/ko/csv-checker/"],
 ]){
  const html=read(file);
  const actions=html.match(/<div class="actions" id="buyer-csv-first">([\s\S]*?)<\/div>/)?.[1];
  assert(actions, file);
  assert(actions.includes('class="btn primary" href="'+guide+'"'),file);
  assert(actions.includes('class="btn secondary" href="'+free+'"'),file);
  assert(actions.indexOf(guide)<actions.indexOf(free),file);
  assert.equal((html.match(/id="buyer-csv-first"/g)||[]).length,1);
  assert.equal((html.match(/id="buyer-csv-route"/g)||[]).length,1);
  const paragraph=html.match(/<p class="hero-tls" id="buyer-csv-route">([\s\S]*?)<\/p>/)?.[1];
  assert(paragraph?.includes('POST /v1/csv-preflight'),file);
  assert(paragraph?.includes('GET /v1/csv-report'),file);
  assert(paragraph?.includes('0.005'),file);
  assert(paragraph?.includes(yamlUrl),file);
  assert(paragraph?.includes(riskUrl),file);
  assert.equal(html.split(yamlUrl).length-1,2,file+" must retain both original 4USDC listings");
  for (const match of paragraph.matchAll(/<a\b[^>]*>/g)) {
   if (match[0].includes('target="_blank"')) assert(match[0].includes('rel="noopener noreferrer"'),file);
  }
  assert(!/connectWallet\s*\(|<iframe\b|<form\b|auto.?sign/i.test(paragraph),file);
 }
});

test("Homepage does not claim that a paid synthetic GET processes buyer input",()=>{
 const en=read("index.html"),ko=read("ko/index.html");
 assert.match(en,/GET \/v1\/csv-report<\/code> only returns a fictional reference report/);
 assert.match(ko,/GET \/v1\/csv-report<\/code>는 고객 파일이 아닌 가상 예시 결과만 반환/);
 assert.match(en,/The button above opens instructions, not a transaction/);
 assert.match(ko,/구매 안내를 열 뿐 자동 결제/);
});
