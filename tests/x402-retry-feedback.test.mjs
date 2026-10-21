import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const issue=readFileSync(new URL("../.github/ISSUE_TEMPLATE/x402-retry-feedback.yml",import.meta.url),"utf8");
const html=readFileSync(new URL("../x402-trace/index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../x402-trace/styles.css",import.meta.url),"utf8");
test("voluntary public original issue form captures attempted use, observed need and nonbinding willingness-to-pay only",()=>{
 for(const field of ["id: use","id: observed","id: reproduce","id: outcome","id: paid","id: safety"]){
  assert(issue.includes(field),field);
 }
 assert(issue.includes("I have not used the free tool yet"));
 assert(issue.includes("29 native Base Circle USDC"));
 assert(issue.includes("Nonbinding"));
 assert(issue.includes("contains no wallet secrets"));
 assert(issue.includes("required: true"));
 assert(!/\\bapi_key:\\s*\\S+|private_key:\\s*\\S+|bearer\\s+\\w+/i.test(issue));
});
test("public feedback route is opt-in, GitHub-account disclosed and not linked to payment execution",()=>{
 const url="https://github.com/livastic-vm2-primary-20260911/livastic-vm2-primary-20260911.github.io/issues/new?template=x402-retry-feedback.yml";
 assert.equal(html.split(url).length-1,1);
 assert.match(html,/requires a GitHub account/);
 assert.match(html,/Independent human feedback received so far/);
 assert.match(html,/none verified/);
 assert.match(html,/form-action 'none'/);
 assert.match(css,/\.reader-feedback/);
 assert.match(html,/target="_blank" rel="noopener noreferrer">send a public/);
});
