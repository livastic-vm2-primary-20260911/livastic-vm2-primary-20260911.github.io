import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const pages = [["EN",read("index.html")],["KO",read("ko/index.html")]];
const proof = "https://livastic-vm1-primary.github.io/paperpilot-tools/paid-engineering-proof.html";
const sponsor = "https://github.com/pursekeeper/api/pull/94";
const free = "https://livastic-vm2-primary-20260911.github.io/workflow-risk-usdc-studio/csv/narrative/";

test("both original-language pages credit the one-owner VM1 independently earned bounty",()=>{
 for(const [language,html] of pages){
  assert.equal(html.split(proof).length-1,1,language+" case study link exactly once");
  assert.equal(html.split(sponsor).length-1,1,language+" sponsor PR link exactly once");
  assert.match(html,/5 XNO/,language);
  assert.match(html,/0 XNO/,language);
  assert(html.includes("VM1") && html.includes("VM2"),language);
 }
});

test("independently paid sender reward remains recipient-pending and is not a VM2 sale",()=>{
 const en=pages[0][1], ko=pages[1][1];
 assert.ok(en.includes("5 XNO pending receive and 0 XNO spendable"));
 assert.ok(en.includes("not</em> evidence that anyone has bought the VM2 products"));
 assert.ok(en.includes("NOT A VM2 CUSTOMER ORDER"));
 assert.ok(ko.includes("5 XNO 수령 대기 · 사용 가능 0 XNO"));
 assert.ok(ko.includes("고객이 주문했다는 증거가 아닙니다"));
});

test("both pages introduce free local CSV narrative parser before paid service list",()=>{
 for(const [language,html] of pages){
  assert.equal(html.split(free).length-1,1,language);
  const section=html.slice(html.indexOf('id="services"'),html.indexOf('id="proof"'));
  const starter=language==="EN"?"4 USDC STARTER":"소액 상품 4 USDC";
  assert(section.indexOf(free)>0,language+" actual section includes the free link");
  assert(section.indexOf(free)<section.indexOf(starter),language+" free before paid buyer choice");
 }
});

test("new external links have safe new-tab declarations and old unpaid sponsor source stays",()=>{
 for(const [language,html] of pages){
  for(const url of [proof,sponsor,free]){
   const i=html.indexOf('href="'+url+'"');
   assert(i>=0,language+" expected link "+url);
   const start=html.lastIndexOf('<a',i);
   const end=html.indexOf('>',i);
   const tag=html.slice(start,end+1);
   assert.match(tag,/target="_blank"/);
   assert.match(tag,/rel="noopener noreferrer"/);
  }
  assert.ok(html.includes("0.05 USDC"),language+" unpaid distinct sponsor not erased");
 }
});
