import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = f => fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const site="https://livastic-vm2-primary-20260911.github.io";
const xml=read("sitemap-index.xml");
const robots=read("robots.txt");

test("root sitemap index links root and five real owner-hosted project sitemaps",()=>{
 assert.match(xml,/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
 assert.match(xml,/<sitemapindex xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
 const rows=[...xml.matchAll(/<sitemap><loc>(https:\/\/[^<]+)<\/loc><lastmod>([^<]+)<\/lastmod><\/sitemap>/g)];
 const urls=rows.map(x=>x[1]);
 assert.deepEqual(urls,[
  site+"/sitemap.xml",
  site+"/vault-exit-reality/sitemap.xml",
  site+"/workflow-risk-usdc-studio/sitemap.xml",
  site+"/signscope-offline-permit-checker/sitemap.xml",
  site+"/x402-manifest-import-preflight/sitemap.xml",
  site+"/x402-trace/sitemap.xml"
 ]);
 assert.equal(new Set(urls).size,6);
 assert(rows.every(x=>/^\d{4}-\d\d-\d\d$/.test(x[2])));
 assert(xml.trim().endsWith("</sitemapindex>"));
});
test("existing root sitemap stays linked and second discoverable sitemap index is explicit in robots",()=>{
 assert(robots.includes("Sitemap: "+site+"/sitemap.xml"));
 assert(robots.includes("Sitemap: "+site+"/sitemap-index.xml"));
 assert(robots.includes("User-agent: *"));
 assert(robots.includes("Allow: /"));
});
test("index is safe metadata and does not refer to unowned hosts or guess forbidden pages",()=>{
 const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
 assert(urls.every(u=>u.startsWith(site+"/")));
 assert(!/api_key|bearer|credentials|private|secret|wallet seed|agent-token/i.test(xml));
 assert(!/function|<script|https?:\/\/attacker\./i.test(xml));
 assert(!/\/xmlrpc\.php|\/admin\/|\/accounts\//.test(xml));
});
