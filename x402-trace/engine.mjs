// x402 retry/settlement/delivery evidence classifier. Local-only; never sends payments.
// Only fictional or deliberately redacted short labels. No wallet access, no network.
export const MAX_EVENTS = 32;
export const MAX_BYTES = 32768;
const KINDS = new Set(["QUOTE","VERIFY","SETTLE","DELIVER","RETRY","REPLAY_REJECTED","PRICE_CHANGED","REJECT"]);
const COLUMNS = new Set(["request","kind","payment","amountAtomic","delivery"]);
const LABEL = /^[A-Za-z][A-Za-z0-9_-]{0,29}$/;
const MAX_ATOMIC = 100000000000n;
function allowed(obj,names,scope){
  for(const field of Object.keys(obj)) if(!names.has(field)) throw Error(scope+": unexpected field "+field+". Never paste keys, signatures or production logs.");
}
function label(val,scope){
  if(typeof val!=="string"||!LABEL.test(val)) throw Error(scope+": use a fictional short label, not a hash, URL, wallet address or personal data.");
  return val;
}
function amount(val,scope){
  if(typeof val!=="string"||!/^(0|[1-9][0-9]{0,11})$/.test(val)) throw Error(scope+": amountAtomic must be a base-10 integer string (6 USDC decimals).");
  const n=BigInt(val);if(n>MAX_ATOMIC)throw Error(scope+": value too large.");
  return n;
}
export function usdc(n){
  const b=BigInt(n);
  return (b/1000000n).toString()+"."+String(b%1000000n).padStart(6,"0")+" USDC";
}
export function parseTrace(src){
  if(typeof src!=="string"||new TextEncoder().encode(src).byteLength>MAX_BYTES)throw Error("Maximum 32 KiB. Use fictional labels instead of customer data.");
  let data;try{data=JSON.parse(src)}catch{throw Error("Invalid JSON. This accepts no raw HTTP headers or access tokens.")}
  if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Provide one JSON object.");
  allowed(data,new Set(["synthetic","trace"]),"Input");
  if(data.synthetic!==true)throw Error("Set synthetic:true. Enter only synthetic or explicitly anonymized evidence labels.");
  if(!Array.isArray(data.trace)||data.trace.length<1||data.trace.length>MAX_EVENTS)throw Error("trace must have 1 to 32 events.");
  return data.trace.map((x,i)=>{
    if(!x||typeof x!=="object"||Array.isArray(x))throw Error("Event "+(i+1)+" must be an object.");
    allowed(x,COLUMNS,"Event "+(i+1));
    const r=label(x.request,"Event "+(i+1)+".request");
    if(!KINDS.has(x.kind))throw Error("Unsupported event kind "+String(x.kind));
    const p=x.payment===undefined?undefined:label(x.payment,"payment");
    if(["VERIFY","SETTLE","RETRY","REPLAY_REJECTED"].includes(x.kind)&&!p)throw Error(x.kind+" requires a synthetic payment label.");
    const a=x.amountAtomic===undefined?undefined:amount(x.amountAtomic,"amountAtomic");
    if(["QUOTE","SETTLE"].includes(x.kind)&&a===undefined)throw Error(x.kind+" requires a six-decimal atomic amount string.");
    const d=x.delivery===undefined?undefined:label(x.delivery,"delivery");
    if(x.kind==="DELIVER"&&!d)throw Error("DELIVER requires a fictional delivery label.");
    return {request:r,kind:x.kind,payment:p,amountAtomic:a,delivery:d,step:i+1};
  });
}
const flag=(code,severity,detail)=>({code,severity,detail});
function review(request,events){
  const q=events.filter(e=>e.kind==="QUOTE"),s=events.filter(e=>e.kind==="SETTLE");
  const d=events.filter(e=>e.kind==="DELIVER"),v=events.filter(e=>e.kind==="VERIFY");
  const pay=new Set(s.map(e=>e.payment)), flags=[];
  if(pay.size>1)flags.push(flag("POSSIBLE_DUPLICATE_SETTLEMENT","high","Multiple distinct payment labels claim settlement for one request. Verify real chain transfers, credit/refund records and buyer intent."));
  if(pay.size&&d.length===0)flags.push(flag("SETTLED_NO_DELIVERY_ENTRY","high","A claimed settlement lacks a delivery entry. Inspect the provider's actual receipt; incomplete logs alone cannot prove missing service."));
  if(!pay.size&&d.length)flags.push(flag("DELIVERY_WITHOUT_SETTLEMENT_ENTRY","note","Delivery without recorded settlement may be free or credit-funded; do not assume unpaid usage."));
  if(!pay.size&&v.length)flags.push(flag("VERIFIED_NOT_SETTLED","medium","Verify/approval alone does not establish a finalized USDC transfer."));
  if(!q.length&&pay.size)flags.push(flag("SETTLED_WITHOUT_RECORDED_QUOTE","medium","A claimed settlement has no recorded buyer-approved amount, chain or recipient."));
  let latestQuote;
  for(const ev of events){
    if(ev.kind==="QUOTE")latestQuote=ev.amountAtomic;
    if(ev.kind==="SETTLE"&&latestQuote!==undefined&&latestQuote!==ev.amountAtomic)flags.push(
      flag("PRICE_MISMATCH","medium","Claimed settlement "+usdc(ev.amountAtomic)+" differs from latest quote "+usdc(latestQuote)+". An agreed overpayment may instead be account credit; independently reconcile."));
  }
  const settled=new Set();
  for(const ev of events){
    if(ev.kind==="SETTLE")settled.add(ev.payment);
    if(ev.kind==="RETRY"&&settled.has(ev.payment))flags.push(flag("RETRY_AFTER_SETTLEMENT_CLAIM","medium","Recover existing receipt/job; do not automatically sign a second payment."));
    if(ev.kind==="REPLAY_REJECTED"&&!settled.has(ev.payment))flags.push(flag("REPLAY_REJECTED_NOT_FINALITY","note","Replay refusal alone cannot establish original payment finality."));
  }
  if(new Set(d.map(e=>e.delivery)).size<d.length)flags.push(flag("REPEATED_DELIVERY_ID","note","Repeated delivery label could be retry or duplicate fulfillment; inspect original provider event."));
  if(events.some(e=>e.kind==="PRICE_CHANGED"))flags.push(flag("PRICE_CHANGED_REQUIRES_NEW_CONSENT","medium","Price change needs a fresh explicit buyer decision; never silently auto-increase a previously approved payment."));
  if(!flags.length)flags.push(flag("NO_CONTRADICTION_DETECTED","info","No inconsistency among supplied labels. This does not verify real payments, merchants, client safety or delivered goods."));
  return {request,claimedVerifications:v.length,claimedSettlementEvents:s.length,distinctPaymentLabels:pay.size,deliveryEntries:d.length,
    status:flags.some(f=>f.severity==="high")?"REVIEW_URGENT":flags.some(f=>f.severity==="medium")?"REVIEW":"UNVERIFIED_SAMPLE",findings:flags};
}
export function analyze(text){
  const items=parseTrace(text), groups=new Map();
  for(const ev of items){if(!groups.has(ev.request))groups.set(ev.request,[]);groups.get(ev.request).push(ev)}
  return {schema:"x402-retry-evidence-local-v1",sampleOnly:true,verifiedOnchainSettlement:false,verifiedPaidCustomer:false,
    verifiedExternalServiceDelivery:false,eventCount:items.length,requestCount:groups.size,
    requests:[...groups.entries()].map(([k,v])=>review(k,v)),
    caveat:"Every entry is user-provided synthetic/redacted text, not signed chain evidence, facilitator response, payment confirmation, security audit or service-delivery verification. Never initiate a retry or payment based on this output."};
}
export const EXAMPLES = {
  missingDelivery:{synthetic:true,trace:[
    {request:"jobA",kind:"QUOTE",amountAtomic:"5000"},
    {request:"jobA",kind:"VERIFY",payment:"payA"},
    {request:"jobA",kind:"SETTLE",payment:"payA",amountAtomic:"5000"},
    {request:"jobA",kind:"RETRY",payment:"payA"}]},
  doublePayment:{synthetic:true,trace:[
    {request:"jobB",kind:"QUOTE",amountAtomic:"10000"},
    {request:"jobB",kind:"SETTLE",payment:"payB1",amountAtomic:"10000"},
    {request:"jobB",kind:"RETRY",payment:"payB2"},
    {request:"jobB",kind:"SETTLE",payment:"payB2",amountAtomic:"10000"},
    {request:"jobB",kind:"DELIVER",payment:"payB2",delivery:"resultB"}]},
  matchingClaims:{synthetic:true,trace:[
    {request:"jobC",kind:"QUOTE",amountAtomic:"25000"},
    {request:"jobC",kind:"VERIFY",payment:"payC"},
    {request:"jobC",kind:"SETTLE",payment:"payC",amountAtomic:"25000"},
    {request:"jobC",kind:"DELIVER",payment:"payC",delivery:"resultC"}]}
};
