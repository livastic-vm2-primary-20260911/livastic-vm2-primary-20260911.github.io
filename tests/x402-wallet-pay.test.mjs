import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PAY_URL,CAIP_CHAIN,USDC,SELLER,PRICE_ATOMIC,CheckoutError,
  decodeBase64Utf8,encodeBase64Utf8,validateQuote,
  createAuthorization,randomNonce,safePaidSummary,payCsvOnce
} from '../assets/x402-wallet-pay.mjs';
const offer={
  scheme:'exact',network:'eip155:8453',amount:'5000',
  asset:USDC,payTo:SELLER,maxTimeoutSeconds:300,
  extra:{name:'USD Coin',version:'2'}
};
const resource={url:PAY_URL,description:'One authorized nonsecret customer CSV',mimeType:'application/json'};
const quote={x402Version:2,resource,accepts:[offer],extensions:{}};
const fakeAccount='0x'+'ad'.repeat(20);
const fakeSig='0x'+'11'.repeat(65);
const fakeTx='0x'+'a4'.repeat(32);
const receipt={success:true,transaction:fakeTx,network:CAIP_CHAIN,payer:fakeAccount};
const merchant={ok:true,paid:true,chargedUSDC:'0.005',dataRows:2,
  normalizedDuplicateRows:1,spreadsheetFormulaRiskCells:1};
const reply=(status,body,headers={})=>({status,
  headers:{get(key){return headers[key.toLowerCase()]||null;}},
  async text(){return typeof body==='string'?body:JSON.stringify(body);}
});
const provider=(calls,chain='0x2105')=>({
  async request({method,params}){
    calls.push({method,params});
    if(method==='eth_chainId')return chain;
    if(method==='eth_requestAccounts')return [fakeAccount];
    if(method==='eth_signTypedData_v4')return fakeSig;
    throw Error('Unexpected wallet method');
  }
});
const cryptoSource={getRandomValues(x){x.fill(42);return x;}};
const firstResponse=()=>reply(402,{}, {'payment-required':encodeBase64Utf8(quote)});
const secondResponse=()=>reply(200,merchant,{'payment-response':encodeBase64Utf8(receipt)});
const params=(wallet,fetchFn,confirmPayment=async()=>true)=>({
 csvText:'name,age\nAlice,33\nBob,44',
 expectedColumns:['name','age'],
 provider:wallet,fetchFn,cryptoSource,nowSeconds:()=>1792486800,confirmPayment
});
const errCode=code=>e=>e instanceof CheckoutError && e.code===code;

test('real v2 first-party challenge exact Base Circle USDC recipient only',()=>{
  assert.equal(validateQuote(quote).amount,PRICE_ATOMIC);
  assert.equal(validateQuote(quote).payTo,SELLER);
  assert.equal(validateQuote(quote).network,CAIP_CHAIN);
  assert.equal(decodeBase64Utf8(encodeBase64Utf8(quote)).resource.url,PAY_URL);
});
test('wrong payment domain, merchant resource, network, amount, asset and version fail closed',()=>{
  for(const mutate of [
    q=>q.resource.url='https://steal.example/pay',
    q=>q.accepts[0].payTo='0x'+'00'.repeat(20),
    q=>q.accepts[0].network='eip155:1',
    q=>q.accepts[0].amount='5001',
    q=>q.accepts[0].asset='0x'+'ee'.repeat(20),
    q=>q.accepts[0].extra.version='1',
    q=>q.accepts[0].extra.name='USDC',
    q=>q.x402Version=1
  ]){
    const clone=structuredClone(quote);mutate(clone);
    assert.throws(()=>validateQuote(clone),CheckoutError);
  }
});
test('duplicate eligible options, absent extensions, invalid extension type refused',()=>{
  assert.throws(()=>validateQuote({...quote,accepts:[offer,offer]}),CheckoutError);
  assert.equal(validateQuote({...quote,extensions:undefined}).scheme,'exact');
  assert.throws(()=>validateQuote({...quote,extensions:[]}),CheckoutError);
});
test('broken quote encoding and malformed signed payload rejected',()=>{
  for(const x of [null,'', '@@@@','abcd_','#','a'.repeat(24001)])
    assert.throws(()=>decodeBase64Utf8(x),CheckoutError);
  assert.throws(()=>safePaidSummary({paid:true},receipt),errCode('PAID_SETTLEMENT_PROOF_MISSING'));
});
test('EIP3009 data is bounded to 0.005 USDC Base with unique full nonce and expiry',()=>{
  const nonce=randomNonce(cryptoSource);
  assert.match(nonce,/^0x[0-9a-f]{64}$/);assert.equal(nonce,'0x'+'2a'.repeat(32));
  const {auth,typedData}=createAuthorization({address:fakeAccount,offer,seconds:1792486800,nonce});
  assert.equal(auth.from,fakeAccount);
  assert.equal(auth.to,SELLER);
  assert.equal(auth.value,'5000');
  assert.equal(auth.validAfter,'1792486740');
  assert.equal(auth.validBefore,'1792487040');
  assert.equal(typedData.domain.chainId,8453);
  assert.equal(typedData.domain.name,'USD Coin');
  assert.equal(typedData.domain.version,'2');
  assert.equal(typedData.domain.verifyingContract,USDC);
  assert.equal(typedData.primaryType,'TransferWithAuthorization');
  assert.equal(typedData.types.TransferWithAuthorization.length,6);
});
test('no secure random or wrong buyer address fails closed',()=>{
  assert.throws(()=>randomNonce({}),errCode('SECURE_RANDOM_UNAVAILABLE'));
  assert.throws(()=>createAuthorization({address:'0xdeadbeef',offer,seconds:1792486800,nonce:'0x'+'11'.repeat(32)}),CheckoutError);
});
test('single mock buyer payment: 402 quote, own wallet signature, ONE retry and sanitized paid proof',async()=>{
  const calls=[],wire=[];
  const fetchFn=async(url,opts)=>{
    wire.push({url,opts});
    return wire.length===1?firstResponse():secondResponse();
  };
  const result=await payCsvOnce(params(provider(calls),fetchFn));
  assert.equal(result.status,'settled_and_delivered');
  assert.equal(result.chargedUSDC,'0.005');
  assert.equal(result.transaction,fakeTx);
  assert.equal(result.metrics.dataRows,2);
  assert.equal(result.metrics.normalizedDuplicateRows,1);
  assert.equal(result.onlySanitizedOutput,true);
  assert(!JSON.stringify(result).includes('Alice'));
  assert.equal(wire.length,2);
  assert.equal(wire[0].url,PAY_URL);assert.equal(wire[1].url,PAY_URL);
  assert(!wire[0].opts.headers['PAYMENT-SIGNATURE']);
  const signed=decodeBase64Utf8(wire[1].opts.headers['PAYMENT-SIGNATURE']);
  assert.deepEqual(signed.resource,resource);
  assert.deepEqual(signed.accepted,offer);
  assert.equal(signed.payload.signature,fakeSig);
  assert.equal(signed.payload.authorization.value,'5000');
  assert.equal(signed.payload.authorization.to,SELLER);
  assert.deepEqual(calls.map(x=>x.method),[
    'eth_chainId','eth_requestAccounts','eth_chainId','eth_signTypedData_v4'
  ]);
  const typed=JSON.parse(calls.at(-1).params[1]);
  assert.equal(typed.message.value,'5000');
  assert.equal(typed.domain.verifyingContract,USDC);
});
test('buyer refuses: no wallet connect or signature and no paid retry',async()=>{
  const calls=[],requests=[];
  const result=await payCsvOnce(params(provider(calls),async(...args)=>{
    requests.push(args);return firstResponse();},async()=>false));
  assert.equal(result.status,'cancelled_no_signature');
  assert.equal(requests.length,1);
  assert.deepEqual(calls.map(c=>c.method),['eth_chainId']);
});
test('wrong network never sends CSV or signs anything',async()=>{
  let networkCalled=0;
  await assert.rejects(
    payCsvOnce(params(provider([], '0x1'),async()=>{networkCalled++;throw Error('should never fetch');})),
    errCode('WALLET_MUST_BE_ON_BASE'));
  assert.equal(networkCalled,0);
});
test('no wallet provider refuses before any network request',async()=>{
  let count=0;
  await assert.rejects(payCsvOnce(params(null,async()=>{count++;})),errCode('NO_INJECTED_WALLET'));
  assert.equal(count,0);
});
test('input >32 KiB fails BEFORE wallet access and first upload',async()=>{
  const methods=[];let count=0;
  await assert.rejects(payCsvOnce({...params(provider(methods),async()=>{count++;}),csvText:'A'.repeat(32770)}),
    errCode('HOSTED_INPUT_EXCEEDS_32KB'));
  assert.equal(count,0);assert.equal(methods.length,0);
});
test('quote recipient mismatch never asks buyer to sign',async()=>{
  const altered=structuredClone(quote);altered.accepts[0].payTo='0x'+'00'.repeat(20);
  const calls=[];
  await assert.rejects(payCsvOnce(params(provider(calls),async()=>reply(402,{},{
    'payment-required':encodeBase64Utf8(altered)
  }))),errCode('UNTRUSTED_PAYMENT_TERMS'));
  assert.deepEqual(calls.map(c=>c.method),['eth_chainId']);
});
test('API 503 after signing never retries, shows ambiguous settlement',async()=>{
  const calls=[],requests=[];
  const fetchFn=async(...args)=>{
    requests.push(args);return requests.length===1?firstResponse():reply(503,{error:'settlement uncertain'});
  };
  await assert.rejects(payCsvOnce(params(provider(calls),fetchFn)),
    errCode('SIGNED_SETTLEMENT_UNKNOWN_DO_NOT_RETRY'));
  assert.equal(requests.length,2);
  assert.equal(calls.filter(x=>x.method==='eth_signTypedData_v4').length,1);
});
test('200 response without final settlement proof is NOT counted as paid',async()=>{
  let count=0;
  const fetchFn=async()=>++count===1?firstResponse():reply(200,merchant);
  await assert.rejects(payCsvOnce(params(provider([]),fetchFn)),
    errCode('SIGNED_SETTLEMENT_UNKNOWN_DO_NOT_RETRY'));
  assert.equal(count,2);
});
test('only intended merchant origin is reachable from checkout and strict URL guards present',()=>{
  const source=fs.readFileSync(new URL('../assets/x402-wallet-pay.mjs',import.meta.url),'utf8');
  assert.equal(PAY_URL,'https://vm5-openapi-x402.onrender.com/v1/csv-preflight');
  assert(!/localStorage|sessionStorage|document\.cookie|window\.open/.test(source));
  assert(!/eth_sendTransaction|personal_sign|eth_sendRawTransaction|eth_sign\b/.test(source));
  assert(source.includes('eth_signTypedData_v4'));
});
