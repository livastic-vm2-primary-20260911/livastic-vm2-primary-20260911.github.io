import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = p => readFileSync(new URL("../"+p,import.meta.url),"utf8");
const manifest = JSON.parse(read(".well-known/aiax.json"));
const mirrored = JSON.parse(read("aiax/manifest.json"));
const section = id => JSON.parse(read("aiax/sections/"+id+".json"));
const origin = "https://livastic-vm2-primary-20260911.github.io";
const vendor = "https://vm5-openapi-x402.onrender.com";

test("root and /aiax manifests are exactly one honest original public AIAX v0.1 document",()=>{
 assert.deepEqual(manifest,mirrored);
 assert.equal(manifest.aiax_version,"0.1");
 assert.equal(manifest.mcp_endpoint,null,"site must not invent an MCP service");
 assert.equal(manifest.trust_signals.score,null,"no fake independent rating");
 assert.equal(manifest.trust_signals.drs_receipt_count,null,"historical owner receipt != DRS");
 assert.deepEqual(manifest.trust_signals.partnerships,[],"no vendor endorsement");
 assert.equal(manifest.llms_txt_url,origin+"/llms.txt");
 assert.equal(manifest.openapi_url,vendor+"/openapi.json");
 assert.match(manifest.extensions.onecursor.disclosure,/NOT a registered LAX listing/);
 assert.doesNotMatch(manifest.extensions.onecursor.disclosure,/is an approved Kognai listing/i);
});

test("all three public sections have valid exact entry IDs and HTTPS URLs",()=>{
 const expected=["csv_local_private","csv_synthetic_report","csv_buyer_preflight"];
 assert.deepEqual(manifest.entry_points.map(x=>x.id),expected);
 for(const entry of manifest.entry_points){
  assert.match(entry.id,/^[a-z0-9][a-z0-9_-]{0,60}$/);
  assert.equal(entry.url,origin+"/aiax/sections/"+entry.id+".json");
  assert.ok(entry.est_tokens>=1&&entry.est_tokens<=5000);
  const s=section(entry.id);
  assert.equal(s.aiax_version,"0.1");
  assert.equal(s.section_id,entry.id);
  assert.ok(s.purpose.length>15&&s.purpose.length<=600);
  assert.equal(s.pact_mandate_template,null);
  assert.ok(s.examples.length>=1&&s.examples.length<=3);
  assert.ok(s.pricing.amount.match(/^[0-9]+(\.[0-9]+)?$/));
  assert.ok(["free","per_call"].includes(s.pricing.model));
  assert.ok(["x402","none"].includes(s.pricing.rail));
  for(const x of s.examples){
   assert.ok(x.description&&x.request&&x.response);
   if(x.request.url) assert.equal(new URL(x.request.url).protocol,"https:");
  }
 }
});

test("free browser tool does not masquerade as hosted paid JSON REST API",()=>{
 const s=section("csv_local_private");
 assert.equal(s.pricing.model,"free");
 assert.equal(s.pricing.amount,"0");
 assert.equal(s.pricing.rail,"none");
 assert.equal(s.examples[0].request.url,
  origin+"/workflow-risk-usdc-studio/csv/narrative/");
 assert.equal(s.examples[0].response.csv_uploaded,false);
 assert.equal(s.examples[0].response.x402_payment_requested,false);
 assert.match(s.purpose,/never uploads/i);
 assert.match(s.outputs,/No remote structured API/i);
});

test("synthetic hosted GET is clearly 0.005 USDC and NOT a buyer-owned POST",()=>{
 const s=section("csv_synthetic_report");
 assert.equal(s.pricing.model,"per_call");
 assert.equal(s.pricing.amount,"0.005");
 assert.equal(s.pricing.currency,"USDC");
 assert.equal(s.pricing.rail,"x402");
 assert.equal(s.inputs.properties.method.const,"GET");
 assert.equal(s.inputs.properties.url.const,vendor+"/v1/csv-report");
 assert.equal(s.examples[0].request.method,"GET");
 assert.equal(s.examples[0].response.status,402);
 assert.equal(s.examples[0].response.paid,false);
 assert.equal(s.extensions.onecursor.buyer_input_csv_processed,false);
 assert.equal(s.extensions.onecursor.free_synthetic_preview,vendor+"/v1/csv-sample");
 assert.equal(s.openapi_operation_id,"buyOriginalCSVDemoReport");
});

test("remote buyer-supplied POST is disclosed as potentially private and unpaid in example",()=>{
 const s=section("csv_buyer_preflight");
 assert.equal(s.pricing.amount,"0.005");
 assert.equal(s.inputs.type,"object");
 assert.deepEqual(s.inputs.required,["csvText","expectedColumns"]);
 assert.equal(s.inputs.additionalProperties,false);
 assert.equal(s.examples[0].request.method,"POST");
 assert.equal(s.examples[0].request.url,vendor+"/v1/csv-preflight");
 assert.ok(s.examples[0].request.body.csvText.includes("a@example.com"));
 assert.equal(s.examples[0].response.status,402);
 assert.equal(s.examples[0].response.paid,false);
 assert.equal(s.extensions.onecursor.buyer_private_source_is_submitted_remotely,true);
 assert.equal(s.extensions.onecursor.independent_verified_paid_buyer_post_orders,0);
 assert.match(s.purpose,/buyer-consented/i);
 assert.match(s.outputs,/an unpaid request returns HTTP 402/i);
});

test("paid entries pin native Circle Base USDC and do not fabricate a different chain",()=>{
 for(const id of ["csv_synthetic_report","csv_buyer_preflight"]){
  const o=section(id).extensions.onecursor;
  assert.equal(o.network,"eip155:8453");
  assert.equal(o.native_circle_usdc_asset,"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  assert.equal(section(id).pricing.rail,"x402");
 }
});

test("all public discovery docs avoid secret keys, executable payments and bogus sales",()=>{
 const paths=[
  ".well-known/aiax.json","aiax/manifest.json",
  "aiax/sections/csv_local_private.json",
  "aiax/sections/csv_synthetic_report.json",
  "aiax/sections/csv_buyer_preflight.json"
 ];
 for(const path of paths){
  const raw=read(path);
  assert.doesNotMatch(raw,/PRIVATE.KEY|seed.phrase|PAYMENT-SIGNATURE.{0,60}eyJ|Authorization:\s*Bearer/i);
  assert.ok(!raw.includes("http://localhost")&&!raw.includes("127.0.0.1"));
  assert.ok(!raw.includes("signed transaction receipt"));
 }
 assert.ok(read("llms.txt").includes(origin+"/.well-known/aiax.json"));
});

test("AIAX sections intentionally distinguish one actual owner across VM2+VM5",()=>{
 assert.ok(manifest.extensions.onecursor.beneficial_owner.includes("One human owner"));
 assert.ok(manifest.pricing_summary.includes("0.005 native Circle Base USDC"));
 assert.equal(new Date(manifest.updated_at).toString()!=="Invalid Date",true);
 assert.match(manifest.product.one_line_purpose,/Try crypto CSV checks locally/i);
});