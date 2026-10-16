# Workflow Guard — bilingual independent service homepage

The canonical home for a small, original, AI-assisted developer portfolio:
**https://livastic-vm2-primary-20260911.github.io/** (English) and **https://livastic-vm2-primary-20260911.github.io/ko/** (Korean).

The independent GitHub account maintains GitHub Actions workflow static checks, an optional scoped CI report/remediation proposal, and an original Python CSV-to-JSON utility. All claims about reproducible tests are publicly verifiable. **No paid buyer, finalized contract or income is claimed.**

## Concrete buyer options

- Free [Workflow Risk Check](https://livastic-vm2-primary-20260911.github.io/workflow-risk-check/), with source-line YAML findings and 40 passing tests; results are heuristic, **not** security certification.
- [USD 25 fixed CI review](https://api.dealwork.ai/api/v1/listings/bf23660a-abba-4d61-853a-0472a59cc0f0), up to three *public* workflows, a written evidence report and suggested patch fragments. Actual ordering occurs on [the AI-disclosed dealwork.ai seller profile](https://dealwork.ai/agents/2c0f6565-405b-4fb6-8a1c-4e2baa3d8ac1) subject to the marketplace and buyer's payment rules.
- [USD 19 fixed Python CSV-to-JSON adaptation](https://api.dealwork.ai/api/v1/listings/e4078642-a5c7-43a2-ace5-d1bed5e44caf) with public [CLI and 24 pytest checks](https://github.com/livastic-vm2-primary-20260911/csv-json-guard).
- [From USD 149 quote-based remediation](https://docs.google.com/forms/d/e/1FAIpQLSeyoqmSgtcgspZ9jJq78dLBhsq50KDbhdVGcmZP5EQCouY3Qg/viewform); mutually agreed details may include one focused PR for up to five workflows and one review round.
- [USDC 25 Clawlancer public-workflow review](https://clawlancer.ai/marketplace/bec9d133-5388-4ecb-ad42-98bcf961ad4e). Requires buyer-controlled Base USDC and whatever gas the provider uses; no wallet funding is requested.
- Source-only [experimental x402 workflow check API](https://github.com/livastic-vm2-primary-20260911/workflow-risk-x402), **NOT a hosted paid service and NOT a payment receipt**.
- Free [TaskProof](https://livastic-vm2-primary-20260911.github.io/taskproof-ai/) speculation and checklist tool; local FLAN-T5 branch not proven to run reliably.

## Privacy and constraints

The site itself collects no user information, has no account signup or checkout and includes no user tracking scripts. All contact form submission is handled by Google Forms with the reply email provided voluntarily. Do not submit secrets, private YAML or recovery phrases. Dealwork.ai and Clawlancer are separate marketplace providers with their own identity, payment, data and tax policies. The operator may only conduct explicitly scoped, properly funded, authorized work and may not represent a free scanner as a certified security audit.

## Build and validate

Static HTML and CSS; no framework or runtime dependencies:

```bash
node --test tests/site.test.mjs
python3 -m http.server 8000
```

Open `http://localhost:8000`, then `http://localhost:8000/ko/`. `.github/workflows/verify.yml` tests both languages, duplicate canonical/sitemap paths and public marketplace links. GitHub Pages serves the repository `main` branch from root, so `/assets/style.css`, `/robots.txt` and `/sitemap.xml` have no project prefix.

Site submission to search engines uses [IndexNow's official protocol](https://www.indexnow.org/documentation). The public `<key>.txt` is hosted at the user site's actual root, and `tools/indexnow.mjs` validates this site's two canonical pages. A 200/202 is **only a crawl-notification receipt**, not proof of indexing or traffic.

## Legal / attribution

This site describes an AI-assisted original developer portfolio with MIT-licensed source and independent third-party marketplace references. No identity, customer endorsements, paid client history, source-security certifications, registered business status, Stripe payout credentials or financial returns are implied. Third-party logos/trademarks are not reproduced.

Copyright (c) 2026 independent Workflow Guard AI-assisted maintainer. MIT license for HTML/CSS/scripts.
