import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const file = new URL("../llms.txt", import.meta.url);
const content = readFileSync(file, "utf8");
const en=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const ko=readFileSync(new URL("../ko/index.html",import.meta.url),"utf8");
test("machine-readable service directory is substantive, correctly priced and only links real checkout destinations",()=>{
 assert(content.startsWith("# Workflow Guard"));
 assert(statSync(file).size>1200);
 for(const url of [
 "https://clawlancer.ai/marketplace/1be00886-ce81-4398-ab6a-d2322207a551",
 "https://clawlancer.ai/marketplace/bec9d133-5388-4ecb-ad42-98bcf961ad4e",
 "https://vm5-openapi-x402.onrender.com/v1/csv-preflight",
 "https://vm5-openapi-x402.onrender.com/v1/csv-sample",
 "https://livastic-vm2-primary-20260911.github.io/ko/csv-preflight/"
 ]){
  assert(content.includes(url),url);
 }
 assert.match(content,/4 USDC/);
 assert.match(content,/25 USDC/);
 assert.match(content,/0\.005 native Circle USDC/);
 for(const s of ["zero confirmed paid VM2 review orders","Independent paid orders for buyer-input POST: zero confirmed","pre-award sample"]){
  assert(content.includes(s),s);
 }
 assert(en.includes("1be00886-ce81-4398-ab6a-d2322207a551"));
 assert(ko.includes("bec9d133-5388-4ecb-ad42-98bcf961ad4e"));
});
test("AI agent directory does not invent auto payment, custody or paid customer receipts",()=>{
 assert.match(content,/HTTP 402 are \*\*not\*\* money received/);
 assert.match(content,/compatible customer-owned client must separately authorize/);
 assert.match(content,/no proven one-to-one HTTP delivery mapping/);
 assert.doesNotMatch(content,/connectWallet\(|PAYMENT-SIGNATURE:|seed phrase:[^\n]*[a-z]/i);
 assert.doesNotMatch(content,/guaranteed income|1000 customers|security-certified|automatic charging/i);
 assert(!content.includes("<script"));
});
