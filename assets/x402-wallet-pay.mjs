// x402 v2 exact EVM buyer helper for ONE existing same-owner VM5 paid CSV API.
// No private keys, no hidden network requests, no session/account persistence.
// Buyers explicitly choose to connect their OWN EIP-1193 wallet, preview amount,
// sign one EIP-3009 authorization, then submit one paid request. Never auto-retry.
import {paidRequestPayload} from './csv-core.mjs';

export const PAY_URL='https://vm5-openapi-x402.onrender.com/v1/csv-preflight';
export const PAY_ORIGIN='https://vm5-openapi-x402.onrender.com';
export const CHAIN_ID=8453;
export const CAIP_CHAIN='eip155:8453';
export const USDC='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const SELLER='0x6b01efA0705E91a7aca54271510bf9e594717f34';
export const PRICE_ATOMIC='5000'; // exactly 0.005000 USDC; hard cap.
const address=/^0x[0-9a-fA-F]{40}$/;
const sig=/^0x[0-9a-fA-F]{130}$/;
const hexNonce=/^0x[0-9a-fA-F]{64}$/;

export class CheckoutError extends Error {
  constructor(code,message) { super(message||code);this.name='CheckoutError';this.code=code; }
}
const refuse=code=>{throw new CheckoutError(code);};
const same=(a,b)=>typeof a==='string'&&a.toLowerCase()===b.toLowerCase();
const isObject=x=>x!==null && typeof x==='object' && !Array.isArray(x);

export function decodeBase64Utf8(header){
  if(typeof header!=='string'||header.length<8||header.length>24000||
     !/^[a-zA-Z0-9+/]+={0,2}$/.test(header))refuse('INVALID_QUOTE_HEADER');
  try {
    const binary=atob(header);
    const raw=Uint8Array.from(binary,x=>x.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  }catch{refuse('INVALID_QUOTE_JSON');}
}
export function encodeBase64Utf8(value) {
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  if(bytes.length>18000)refuse('PAYMENT_PAYLOAD_TOO_LARGE');
  return btoa(Array.from(bytes,x=>String.fromCharCode(x)).join(''));
}
export function validateQuote(quote){
  if(!isObject(quote)||quote.x402Version!==2||
     !isObject(quote.resource)||quote.resource.url!==PAY_URL)refuse('WRONG_X402_RESOURCE');
  if(!Array.isArray(quote.accepts)||quote.accepts.length>8||!quote.accepts.length)
    refuse('INVALID_X402_OPTIONS');
  const valid=quote.accepts.filter(q=>
    isObject(q)&&q.scheme==='exact'&&q.network===CAIP_CHAIN&&
    q.amount===PRICE_ATOMIC&&same(q.asset,USDC)&&same(q.payTo,SELLER)&&
    Number.isInteger(q.maxTimeoutSeconds)&&q.maxTimeoutSeconds>=60&&q.maxTimeoutSeconds<=300&&
    isObject(q.extra)&&q.extra.name==='USD Coin'&&q.extra.version==='2');
  if(valid.length!==1)refuse('UNTRUSTED_PAYMENT_TERMS');
  if(quote.extensions!==undefined&&!isObject(quote.extensions))refuse('INVALID_X402_EXTENSIONS');
  if(JSON.stringify(quote.extensions||{}).length>14000)refuse('EXCESSIVE_X402_EXTENSIONS');
  return valid[0];
}
export function createAuthorization({address:buyer,offer,seconds,nonce}){
  if(!address.test(buyer)||!hexNonce.test(nonce)||
     !Number.isSafeInteger(seconds)||seconds<1_700_000_000)refuse('INVALID_WALLET_OR_CLOCK');
  if(!isObject(offer)||offer.amount!==PRICE_ATOMIC||!same(offer.payTo,SELLER))
    refuse('UNTRUSTED_PAYMENT_TERMS');
  const auth={
    from:buyer,
    to:SELLER,
    value:PRICE_ATOMIC,
    validAfter:String(seconds-60),
    validBefore:String(seconds+Math.min(240,offer.maxTimeoutSeconds)),
    nonce
  };
  return {
    auth,
    typedData:{
      domain:{name:'USD Coin',version:'2',chainId:CHAIN_ID,verifyingContract:USDC},
      types:{TransferWithAuthorization:[
        {name:'from',type:'address'}, {name:'to',type:'address'},
        {name:'value',type:'uint256'}, {name:'validAfter',type:'uint256'},
        {name:'validBefore',type:'uint256'}, {name:'nonce',type:'bytes32'}
      ]},
      primaryType:'TransferWithAuthorization',
      message:auth
    }
  };
}
export function randomNonce(cryptoSource){
  if(!cryptoSource || typeof cryptoSource.getRandomValues!=='function')
    refuse('SECURE_RANDOM_UNAVAILABLE');
  const bytes=new Uint8Array(32);
  cryptoSource.getRandomValues(bytes);
  return '0x'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
async function replyJSON(response,limit=30000) {
  const text=await response.text();
  if(text.length>limit)refuse('RESPONSE_TOO_LARGE');
  try{return JSON.parse(text);}catch{refuse('INVALID_API_JSON');}
}
export function safePaidSummary(data,receipt){
  if(!isObject(data)||data.ok!==true||data.paid!==true||!isObject(receipt)||
     receipt.success!==true||receipt.network!==CAIP_CHAIN||
     typeof receipt.transaction!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(receipt.transaction))
    refuse('PAID_SETTLEMENT_PROOF_MISSING');
  const numeric={};
  for(const field of ['dataRows','rowCount','columns','columnCount','irregularRows',
    'normalizedDuplicateRows','spreadsheetFormulaRiskCells','blankCells','invalidCells']){
    const value=data[field];
    if(Number.isSafeInteger(value)&&value>=0&&value<=200000)numeric[field]=value;
  }
  return {
    status:'settled_and_delivered',
    transaction:receipt.transaction,
    chargedUSDC:'0.005',
    network:CAIP_CHAIN,
    metrics:numeric,
    // Never display or log uploaded CSV, payload, authorization, or raw server JSON.
    onlySanitizedOutput:true
  };
}

/** Exactly one buyer-authorized spending attempt. Caller MUST gather two
 * separate affirmative checkboxes and explicit confirmation before invocation.
 * Does not retry failed or ambiguous payments or generate a second nonce.
 */
export async function payCsvOnce({csvText,expectedColumns=[],provider,
  fetchFn,cryptoSource,nowSeconds,confirmPayment,onSignStarted}) {
  if(!provider||typeof provider.request!=='function')refuse('NO_INJECTED_WALLET');
  if(typeof fetchFn!=='function'||typeof confirmPayment!=='function')refuse('INVALID_BUYER_ENVIRONMENT');
  // Refuse oversized payload BEFORE account access or any network request.
  let input;
  try{input=paidRequestPayload(csvText,expectedColumns);}
  catch(e){refuse(e?.code||'INVALID_CSV_INPUT');}
  const body=JSON.stringify(input);
  const chain=await provider.request({method:'eth_chainId'});
  if(typeof chain!=='string'||Number.parseInt(chain,16)!==CHAIN_ID)refuse('WALLET_MUST_BE_ON_BASE');
  const options={method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body};
  let response;
  try{response=await fetchFn(PAY_URL,options);}catch{refuse('API_UNREACHABLE_NO_SIGNATURE');}
  if(response.status!==402)refuse('EXPECTED_402_NO_SIGNATURE');
  const offerResponse=decodeBase64Utf8(response.headers.get('payment-required'));
  const offer=validateQuote(offerResponse);
  // Browser has already sent the non-sensitive CSV to existing VM5 once to get
  // this live quote. No signature, payment or wallet transfer has occurred yet.
  const approved=await confirmPayment({
    priceUSDC:'0.005',network:CAIP_CHAIN,recipient:SELLER,
    externalApi:PAY_URL,quote:offer
  });
  if(approved!==true)return {status:'cancelled_no_signature'};
  const accounts=await provider.request({method:'eth_requestAccounts'});
  if(!Array.isArray(accounts)||accounts.length<1||!address.test(accounts[0]))
    refuse('WALLET_ACCOUNT_UNAVAILABLE');
  const recheck=await provider.request({method:'eth_chainId'});
  if(typeof recheck!=='string'||Number.parseInt(recheck,16)!==CHAIN_ID)
    refuse('WALLET_CHAIN_CHANGED');
  const seconds=nowSeconds();
  const {auth,typedData}=createAuthorization({
    address:accounts[0],offer,seconds,nonce:randomNonce(cryptoSource)
  });
  let signed;
  if(typeof onSignStarted==='function')onSignStarted();
  try{
    signed=await provider.request({
      method:'eth_signTypedData_v4',
      params:[accounts[0],JSON.stringify(typedData)]
    });
  }catch{refuse('WALLET_SIGNATURE_CANCELLED_OR_FAILED');}
  if(typeof signed!=='string'||!sig.test(signed))refuse('INVALID_WALLET_SIGNATURE');
  // Note: EIP-3009 signed authorizations CAN transfer the exact USDC amount.
  // Signing is deliberately NEVER performed silently.
  const payHeader=encodeBase64Utf8({
    x402Version:2,
    resource:offerResponse.resource,
    accepted:offer,
    payload:{signature:signed,authorization:auth},
    extensions:offerResponse.extensions||{}
  });
  let settled;
  try {
    settled=await fetchFn(PAY_URL,{...options,headers:{
      ...options.headers,'PAYMENT-SIGNATURE':payHeader
    }});
  }catch{
    refuse('SIGNED_SETTLEMENT_UNKNOWN_DO_NOT_RETRY');
  }
  if(settled.status!==200)refuse('SIGNED_SETTLEMENT_UNKNOWN_DO_NOT_RETRY');
  const raw=await replyJSON(settled);
  let receipt;
  try{receipt=decodeBase64Utf8(settled.headers.get('payment-response'));}
  catch{refuse('SIGNED_SETTLEMENT_UNKNOWN_DO_NOT_RETRY');}
  return safePaidSummary(raw,receipt);
}
