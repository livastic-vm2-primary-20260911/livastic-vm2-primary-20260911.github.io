import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");
const enPath = "guides/pull-request-target-november-2026/index.html";
const koPath = "ko/guides/pull-request-target-2026/index.html";
const en = read(enPath), ko = read(koPath);
const homeEn = read("index.html"), homeKo = read("ko/index.html");
const origin = "https://livastic-vm2-primary-20260911.github.io";
const enURL = origin + "/guides/pull-request-target-november-2026/";
const koURL = origin + "/ko/guides/pull-request-target-2026/";
const paid4 = "https://clawlancer.ai/marketplace/1be00886-ce81-4398-ab6a-d2322207a551";
const paid25 = "https://dealwork.ai/agents/2c0f6565-405b-4fb6-8a1c-4e2baa3d8ac1";

test("Both first-party policy pages are standalone and bidirectionally localized",()=>{
 for (const [html,lang,canonical] of [[en,"en",enURL],[ko,"ko",koURL]]){
  assert(html.includes('<html lang="'+lang+'">'));
  assert(html.includes('<link rel="canonical" href="'+canonical+'">'));
  assert(html.includes('hreflang="en" href="'+enURL+'"'));
  assert(html.includes('hreflang="ko" href="'+koURL+'"'));
  assert(html.includes('hreflang="x-default" href="'+enURL+'"'));
  assert.match(html,/<meta name="description" content="[^"]{60,}">/);
  assert.match(html,/<title>[^<]{40,}<\/title>/);
  assert(html.includes('href="/assets/style.css"'));
  assert(html.includes('datePublished'));
  assert(html.includes('2026-10-20'));
 }
});

test("Policy copy states qualifying scope and future 2026-11-02 instead of blanket enforcement",()=>{
 for(const html of [en,ko]){
  assert(html.includes("pull_request_target"));
  assert(html.includes("November 2, 2026") || html.includes("2026년 11월 2일"));
  assert(html.includes("private") || html.includes("비공개"));
  assert(html.includes("evaluate mode") || html.includes("평가 모드"));
  assert(html.includes("contents: read"));
  assert(html.includes("pull_request:"));
  assert(html.includes("actions/checkout@v4"));
 }
 assert.match(en,/does <strong>not<\/strong> mean every repository/);
 assert.match(ko,/모든 저장소나 모든 PR 워크플로가 막히는 것은 아닙니다/);
});

test("Guides cite independent official GitHub sources, not seller-created policies",()=>{
 for(const html of [en,ko]){
  assert(html.includes("https://github.blog/changelog/2026-09-17-workflow-execution-protections-in-github-actions-generally-available/"));
  assert(html.includes("https://github.blog/changelog/2026-06-18-safer-pull_request_target-defaults-for-github-actions-checkout/"));
  assert(/href="https:\/\/docs\.github\.com\/(?:ko|en)\/actions\/reference\/security\/securely-using-pull_request_target"/.test(html));
 }
});

test("Original real paid checkout links are exact, not fabricated merchants or sales",()=>{
 for(const html of [en,ko]){
  assert(html.includes(paid4));
  assert(html.includes(paid25));
  assert(html.includes("300"));
  assert(html.includes("4"));
  assert(html.includes("$25"));
  assert(!/connectWallet\(|checkout\.stripe\.com|guaranteed profit|guaranteed sales/i.test(html));
  assert(!/https?:\/\/.*\/wallet\/private/i.test(html));
 }
 assert.match(en,/Listing publication or clicking a link is not a sale/);
 assert.match(ko,/게시·클릭·문의는 매출이 아니며/);
});

test("Main pages link each first-party guide exactly once without adding duplicate price offer CTAs",()=>{
 assert.equal(homeEn.split('href="/guides/pull-request-target-november-2026/"').length-1,1);
 assert.equal(homeKo.split('href="/ko/guides/pull-request-target-2026/"').length-1,1);
 for(const html of [homeEn,homeKo]){
  assert.equal(html.split(paid4).length-1,2);
 }
});

test("No third-party scripts, analytics, unsafe cross-origin links or seed phrases",()=>{
 for(const html of [en,ko]){
  assert(!/google-analytics|gtag\(|googletagmanager|mixpanel|connectWallet\(|seed phrase/i.test(html));
  for(const m of html.matchAll(/<a\b[^>]*>/g)){
   const tag = m[0];
   if(tag.includes('target="_blank"'))assert(tag.includes('rel="noopener noreferrer"'),tag);
  }
 }
});
