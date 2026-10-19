#!/usr/bin/env python3
"""Build a free, accurate discovery manifest for existing same-owner VM5 x402 APIs.

READ-ONLY HTTP GET requests. Never signs, pays, or invokes an authenticated API.
Run from the original vm2-homepage repository: python3 tools/build_vm5_agent_bazaar_manifest.py --write
"""
from __future__ import annotations

import argparse
import base64
import json
import re
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = "https://vm5-openapi-x402.onrender.com"
USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
ROUTES = (
    ("/v1/x402-template", "10000", "Download an original x402 v2 OpenAPI example with a reproducible Redocly lint result; reference template, not a production security audit."),
    ("/v1/csv-report", "5000", "Get a reproducible demonstration CSV quality report (duplicate rows, invalid fields, CSV formula-injection warnings). Sample data, not customer data."),
    ("/v1/email-dns-preflight?domain=gmail.com", "5000", "Get a bounded public DNS report for MX, SPF, DMARC and A records for a chosen domain. Not mailbox or email deliverability verification."),
    ("/v1/https-cert-preflight?domain=github.com", "5000", "Inspect public HTTPS X.509 certificate expiry, issuer and observed local chain authorization and hostname match on one globally routable IPv4 443 endpoint. No web page content, private IP, ownership or comprehensive security certification."),
)
OUT = Path(__file__).resolve().parent.parent / "vm5-x402-agent-bazaar.json"


def resource_from_payment(challenge: dict, requested_url: str, expected_amount: str, explanation: str) -> tuple[dict, str]:
    if challenge.get("x402Version") != 2:
        raise ValueError("Expected x402 v2 challenge")
    endpoint = challenge.get("resource", {})
    if not isinstance(endpoint, dict) or endpoint.get("url") != requested_url:
        raise ValueError("Live challenge URL mismatches the requested paid API")
    accept = challenge.get("accepts")
    if not isinstance(accept, list) or len(accept) != 1:
        raise ValueError("Expected one unambiguous payment option")
    a = accept[0]
    if not isinstance(a, dict):
        raise ValueError("Payment option invalid")
    if any((a.get("scheme") != "exact",
            a.get("network") != "eip155:8453",
            a.get("asset", "").lower() != USDC.lower(),
            str(a.get("amount")) != expected_amount,
            not re.fullmatch(r"0x[a-fA-F0-9]{40}", str(a.get("payTo", ""))))):
        raise ValueError("Wrong network, asset, price, wallet shape, or payment scheme")
    if a.get("maxTimeoutSeconds", 0) < 30:
        raise ValueError("Payment expiry too short")
    return ({
        "url": requested_url,
        "method": "GET",
        "description": explanation,
        "accepts": [{
            "scheme": "exact",
            "network": "eip155:8453",
            "asset": USDC,
            "amount": expected_amount,
            "payTo": a["payTo"],
            "maxTimeoutSeconds": a["maxTimeoutSeconds"],
        }],
    }, a["payTo"].lower())


def read_unpaid_challenge(url: str) -> dict:
    req = Request(url, method="GET", headers={"User-Agent": "VM2-manifest-build/1.0 (free GET, no wallet)"})
    try:
        response = urlopen(req, timeout=15)
    except HTTPError as exc:
        response = exc
    with response:
        if response.status != 402 or response.geturl() != url:
            raise ValueError(f"Expected exact original paid endpoint 402, got {response.status} at {response.geturl()}")
        if not response.headers.get("payment-required"):
            raise ValueError("No payment-required x402 header")
        raw = base64.b64decode(response.headers["payment-required"], validate=True)
        if len(raw) > 50000:
            raise ValueError("Unexpectedly large challenge")
        return json.loads(raw)


def make_manifest(challenges: list[dict]) -> dict:
    if len(challenges) != len(ROUTES):
        raise ValueError("Wrong number of resources")
    resources, wallets = [], set()
    for (path, amount, explanation), challenge in zip(ROUTES, challenges):
        resource, wallet = resource_from_payment(challenge, BASE + path, amount, explanation)
        resources.append(resource)
        wallets.add(wallet)
    if len(wallets) != 1:
        raise ValueError("Mismatched original same-owner merchant payTo across routes")
    return {
        "x402Version": 2,
        "name": "VM5 Original API Tools - x402 Base USDC",
        "description": "Existing independent paid developer and data preflight APIs. Listing managed by same-owner VM2 distribution site; original merchant and settlement endpoint remain VM5. Each payment is per successful response, not a subscription.",
        "merchant": BASE,
        "source": "https://github.com/livastic-vm5-primary-20260911/x402-openapi-lint",
        "openapi": BASE + "/openapi.json",
        "note": "A listing or HTTP 402 is not a sale. Two previously settled calls (OpenAPI template 0.010 USDC and CSV report 0.005 USDC) came from one independent automated buyer; no recurring demand is claimed.",
        "resources": resources,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="Write the generated file; otherwise validate and print a non-secret summary only")
    args = ap.parse_args()
    challenges = [read_unpaid_challenge(BASE + path) for path, _, _ in ROUTES]
    manifest = make_manifest(challenges)
    if args.write:
        OUT.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"validated_urls": [r["url"] for r in manifest["resources"]],
                      "price_atomic_USDC": [r["accepts"][0]["amount"] for r in manifest["resources"]],
                      "asset": "native Base USDC", "wrote": str(OUT) if args.write else None,
                      "payments_made": 0}, indent=2))


if __name__ == "__main__":
    main()
