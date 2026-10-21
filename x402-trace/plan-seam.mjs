// x402 plan-amount seam: strictly local fictional quote/verify consistency.
/// It cannot read the production middleware, facilitator, chain, or real payment.
const FIELDS = new Set(["plan","displayedAtomic","challengeAtomic","verifyAtomic"]);
const VALID_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,29}$/;
const MAX_PLANS = 12;
const MAX_BYTES = 16_384;
const MAX_PRICE = 100_000_000_000n;

function assertFields(item,allowed,scope) {
  for(const key of Object.keys(item)) if(!allowed.has(key)) throw new Error(scope+" unexpected field "+key+"; no tokens, signatures, wallet addresses, or private plans.");
}
function parseAmount(value,label) {
  if(typeof value!=="string" || !/^(0|[1-9][0-9]{0,11})$/.test(value)){
    throw new Error(label+" must be a six-decimal USDC atomic base-unit decimal string, e.g. 9000000.");
  }
  const n=BigInt(value);
  if(n>MAX_PRICE)throw new Error(label+" exceeds the allowed offline analysis cap.");
  return n;
}
const describeAmount=n=>(n/1_000_000n).toString()+"."+(n%1_000_000n).toString().padStart(6,"0")+" USDC";
function signal(code,severity,detail){return {code,severity,detail};}

export function readPlanMatrix(text) {
  if(typeof text!=="string" || new TextEncoder().encode(text).byteLength>MAX_BYTES)
    throw new Error("Use a 16 KiB or smaller fictional JSON sample. Never paste real signed requests or secrets.");
  let data;try{data=JSON.parse(text)}catch{throw new Error("Provide valid fictional JSON.");}
  if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Root must be a JSON object.");
  assertFields(data,new Set(["synthetic","plans"]),"Root");
  if(data.synthetic!==true)throw new Error("Explicit synthetic:true is required.");
  if(!Array.isArray(data.plans)||data.plans.length<1||data.plans.length>MAX_PLANS)throw new Error("Provide 1-12 invented plan rows.");
  const names=new Set();
  return data.plans.map((row,index)=>{
    if(!row||typeof row!=="object"||Array.isArray(row))throw new Error("Plan row must be an object.");
    assertFields(row,FIELDS,"Plan "+(index+1));
    const name=row.plan;
    if(typeof name!=="string"||!VALID_NAME.test(name))throw new Error("Plan must be a short fictional label, not a URL/address.");
    if(names.has(name))throw new Error("Duplicate plan label "+name+". Use unique fictional names.");
    names.add(name);
    return {
      plan:name,
      displayedAtomic:parseAmount(row.displayedAtomic,name+".displayedAtomic"),
      challengeAtomic:parseAmount(row.challengeAtomic,name+".challengeAtomic"),
      verifyAtomic:parseAmount(row.verifyAtomic,name+".verifyAtomic")
    };
  });
}

export function inspectPlanMatrix(json) {
  const rows=readPlanMatrix(json);
  const findings=[];
  for(const row of rows) {
    const flags=[];
    if(row.displayedAtomic!==row.challengeAtomic)flags.push(signal("DISPLAY_VS_CHALLENGE_MISMATCH","high",
      "Displayed "+describeAmount(row.displayedAtomic)+" but HTTP 402 advertises "+describeAmount(row.challengeAtomic)+". Confirm explicit buyer consent and check route configuration BEFORE signature."));
    if(row.challengeAtomic!==row.verifyAtomic)flags.push(signal("CHALLENGE_VS_VERIFIER_MISMATCH","high",
      "HTTP 402 requests "+describeAmount(row.challengeAtomic)+" but your described verifier expects "+describeAmount(row.verifyAtomic)+". A green quote-only test cannot prove this buyer path can settle."));
    if(row.displayedAtomic===0n||row.challengeAtomic===0n||row.verifyAtomic===0n)flags.push(signal("ZERO_PRICE_MUST_BE_EXPLICIT","note",
      "Free or zero-price flow is allowed only if it is the operator's intentional entitlement rule; this checker does not confirm that."));
    if(!flags.length)flags.push(signal("AMOUNTS_MATCH_IN_THIS_SCENARIO_ONLY","info",
      "These three invented values match. No actual backend verifier, signature, network, chain event, or entitlement was tested."));
    findings.push({plan:row.plan, displayedUSDC:describeAmount(row.displayedAtomic),
      challengeUSDC:describeAmount(row.challengeAtomic),verifyUSDC:describeAmount(row.verifyAtomic),
      severity:flags.some(f=>f.severity==="high")?"REVIEW_URGENT":"NOT_PROVEN",
      findings:flags});
  }
  const quoting = new Set(rows.map(row=>row.challengeAtomic.toString()));
  const verifier = new Set(rows.map(row=>row.verifyAtomic.toString()));
  const crossChecks=[];
  if(rows.length>1 && quoting.size>1 && verifier.size===1)crossChecks.push(signal(
    "SHARED_VERIFIER_DEFAULT_ACROSS_MULTIPLE_PRICES","medium",
    "Different plans have different 402 prices, but all supplied verifier amounts use the same base value. Confirm the server selects the quoted plan's amount rather than a per-call default."));
  return {
    schema:"x402-price-seam-offline-v1",
    syntheticOnly:true, verifiedPayment:false, verifiedMerchant:false, liveVerifierExecuted:false,
    planCount:rows.length, highRiskPlanCount:findings.filter(r=>r.severity==="REVIEW_URGENT").length,
    planFindings:findings, crossChecks,
    testRecipe:"In the merchant's own authorized CI, create a fake facilitator/verify spy and assert that the amount passed into verification is exactly the challenge amount for each plan. Also assert mismatches cannot trigger SETTLE or enable an entitlement. The values above are fiction; this site has NOT executed that middleware.",
    disclaimer:"This compares hypothetical recorded values only; it cannot inspect a real HTTP 402, verify signed payments, prove settlement, audit access controls, or authorize a second payment."
  };
}

export const PLAN_EXAMPLES = Object.freeze({
  brokenSubscription:{synthetic:true,plans:[
    {plan:"perCall",displayedAtomic:"5000",challengeAtomic:"5000",verifyAtomic:"5000"},
    {plan:"standard30d",displayedAtomic:"9000000",challengeAtomic:"9000000",verifyAtomic:"5000"},
    {plan:"regional30d",displayedAtomic:"3000000",challengeAtomic:"3000000",verifyAtomic:"5000"}
  ]},
  correctedPrices:{synthetic:true,plans:[
    {plan:"perCall",displayedAtomic:"5000",challengeAtomic:"5000",verifyAtomic:"5000"},
    {plan:"standard30d",displayedAtomic:"9000000",challengeAtomic:"9000000",verifyAtomic:"9000000"},
    {plan:"regional30d",displayedAtomic:"3000000",challengeAtomic:"3000000",verifyAtomic:"3000000"}
  ]}
});
