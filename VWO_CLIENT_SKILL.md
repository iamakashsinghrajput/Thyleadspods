---

## name: vwo-client-skill description: Project-specific child skill for VWO (Wingify) outbound campaigns. Inherits all rules, validation checks, and self-learning loops from the base india-cold-email v17 SKILL.md. This file overrides the base only where VWO-specific calibration applies — ICP, persona priorities, angle library, scoring weights, social proof library, exclusion seed, and tooling constraints. Use this child skill for every VWO campaign; the base skill stays untouched. When this child skill conflicts with the base, the child wins. inherits: india-cold-email v17 (base) client: VWO (Wingify Software Pvt Ltd) client\_segment: MarTech (with overlap into Series B) last\_updated: 2026-05-07 status: production (validated through 26-lead pilot v6, accepted by operator)

# VWO Client Skill — Calibration overlay on india-cold-email v17

## How this file works

Read the base SKILL.md first. Every rule, validation check, and self-learning loop in the base applies. This file only documents the VWO-specific overrides — what to calibrate differently for VWO than for a generic Indian outbound campaign.

When the base says "use the per-segment quick-reference table" or "pull from the seller's customer roster," this file is what those instructions resolve to for VWO.

## Client identity (VWO)

VWO (product of Wingify Software Pvt Ltd) is an Indian SaaS company headquartered in Delhi NCR, founded in 2009\. Sells an A/B testing, experimentation, and CRO platform to growth, marketing, and product teams. Competes globally with Optimizely, Adobe Target, AB Tasty, Convert.com, and emerging tools like Statsig and PostHog. In India, competes mostly with Optimizely and AB Tasty for enterprise, and with Mida.so / nicheCRO tools at the SMB end.

VWO's positioning is "the experimentation platform that connects the dots between behaviour, hypothesis, test, and outcome" — visitor analytics \+ heatmaps \+ session recordings \+ A/B testing \+ personalization \+ form analytics \+ funnel reports, all in one stack. Single-vendor sell, not point-tool sell.

Buyer's mental model when VWO lands: "another A/B testing tool" — needs to be repositioned as "the experimentation OS that replaces 3-4 point tools." This positioning shapes every email opener and angle.

## ICP for VWO (overrides base ICP block)

### Primary ICP (target buckets in priority order)

1. **D2C / Ecom Indian brands, 50-500 employees, Series A-B-C** — highest historical conversion (32.7% of past meetings). Digital revenue is core, not ancillary; CRO budget exists. Sweet spot: 100-300 employees, raised Series A/B in last 12-24 months.  
2. **BFSI / Fintech / Insurance / Health Insurance, 200-2000 employees** — second-largest converted segment (18.3%). KYC \+ signup \+ quote flows are the persistent surface area. Strong VWO references (HDFC ERGO, ICICI Lombard, HDFC Bank).  
3. **SaaS B2B Indian companies, 100-500 employees, Series B-C** — demo-form and trial-flow optimisation. POSist/Restroworks reference is strong.  
4. **EdTech Indian companies, 100-1000 employees** — fee-page and admission-flow optimisation. Online Manipal, UNext are accepted references.  
5. **Travel / Mobility Indian companies, 200-2000 employees** — search-form and route-page optimisation. Use Billund Airport reference carefully (international example).  
6. **Healthcare / Diagnostics / Hospitals (B2B2C), 200-1000 employees** — patient-funnel and lead-form optimisation.

### Anti-ICP (auto-exclude)

- Companies under 50 employees (no CRO budget, founder-led without growth team)  
- Pure services agencies (digital agencies, consultancies — they're competitors selling CRO, not buyers)  
- Pure offline retail without an active digital surface (no website to optimise)  
- Companies whose tech stack page lists Optimizely, AB Tasty, Convert, Statsig, or another VWO competitor as the active vendor (penalty 0.2× per the base rubric — they just bought)  
- Non-India-HQ subsidiaries unless India-decisioned buying is explicitly confirmed in the campaign brief  
- Government / PSU accounts (long procurement cycles outside the SDR motion)

### Sweet-spot stage signals

- Recently hired CMO / VP Marketing / Head of Growth / Head of Product (0-90 days) → highest converter  
- Recently hired Performance Marketing Manager, Senior Growth Manager, CRO Lead, Conversion Optimization Manager → strong axis 3a hiring signal  
- Page change on `/pricing`, hero copy, or `/customers` page in last 30 days → axis 3b  
- Funded Series A or B in last 3-12 months (sweet spot per base rubric Layer 2c)  
- Headcount growth 10%+ in last 6 months in marketing/growth function specifically  
- Currently using only GA4 \+ Hotjar (legacy stack VWO replaces) → strong tech-stack displacement angle

## Persona archetypes for VWO (priority order)

Inherits all 8 archetypes from base, but priority order calibrated to VWO's buyer:

1. **Marketing / Growth leader** (CMO, VP Marketing, Head of Growth, Head of Performance Marketing, Director Marketing) — primary buyer. Owns the budget. Reads CRO emails. Highest reply rate historically.  
2. **Product leader** (CPO, VP Product, Head of Product, Director Product) — secondary buyer. Cares about retention, activation, onboarding flows. Often the technical champion for VWO.  
3. **Founder / CEO** at sub-200-employee D2C / SaaS — relevant when growth team isn't formed yet; founder is the buyer. Use the founder archetype rules from base.  
4. **E-commerce Head / Head of D2C / Online Business Head** — common at larger D2C/retail brands. Treat as Marketing/Growth archetype variant.  
5. **CRO Lead / Conversion Optimization Manager** (rare in India, usually rolled into Growth) — when this title exists, it's a Tier A signal of a mature CRO function.  
6. **Engineering leader** — only relevant for fintech KYC/signup flow optimization sales motion (CTO at Series A/B fintech). Use sparingly; CTO at most VWO targets is not the buyer.  
7. **Finance / HR / Sales / Ops** — generally NOT the buyer for VWO. Skip unless explicitly part of a multi-stakeholder mapped account.

## Tooling constraint for VWO (overrides base tool intelligence)

Available research tools for VWO campaigns: **Coresignal \+ Tavily only**. No Crustdata, no Visualping, no Listen Notes, no Apify, no Clay orchestration. Apollo is available for firmographics and contact mining only. ZeroBounce for email verification only.

This constraint changes axis sourcing as follows:

| Axis | Tool path under VWO constraint |
| :---- | :---- |
| Axis 1 (company-level) | Tavily extract on prospect's homepage \+ 1-2 funnel pages (`/pricing`, `/checkout`, `/signup`, `/demo`, category page). Default for Tier B/C and the fallback for Tier A. |
| Axis 2 (lead-level — LinkedIn posts) | **Coresignal** for last 90 days of LinkedIn posts. Reserved for Tier A leads only (top 10 in a 50-lead pilot). |
| Axis 2 (lead-level — articles, talks, podcasts) | **Tavily site-targeted** queries on the prospect's name across the Indian site list (see below). Catches Substack, Medium, conference appearances, podcast show notes. |
| Axis 3a (hiring activity) | **Tavily site-targeted** on careers/jobs pages \+ Apollo's headcount \+ recent-hire fields. We don't have Crustdata so hiring velocity is approximated from Apollo's `headcount_six_month_growth` \+ Tavily searches on `"<Company>" hiring OR "is hiring" site:linkedin.com OR site:naukri.com`. |
| Axis 3b (page/pricing/careers changes) | **NOT AVAILABLE under current toolstack.** No Visualping, no custom crawler. Flag this gap to the operator quarterly — axis 3b is a high-leverage signal that requires watcher infrastructure. Until set up, axis 3b contributes 0 to the signal graph and the campaign relies on axes 1, 2, 3a, 3c, 3d. |
| Axis 3c (competitive activity) | **Tavily site-targeted** on competitor domains. Quarterly competitor list curation per VWO ICP segment is required (3-5 competitors per segment — see Competitor list below). |
| Axis 3d (press/launch/leadership announcements) | **Tavily site-targeted** on the standard Indian press list (`site:inc42.com`, `site:entrackr.com`, `site:economictimes.indiatimes.com`, `site:livemint.com`, `site:moneycontrol.com`, `site:yourstory.com`). Strongest ROI tool under VWO's constraint. |

**Tavily query templates for VWO (use these defaults):**

| Signal sought | Tavily query |
| :---- | :---- |
| Lead's recent posts/articles on growth/CRO/experimentation | `"<Lead Name>" growth OR experiment OR conversion site:substack.com OR site:medium.com OR site:linkedin.com` |
| Lead's conference talk | `"<Lead Name>" speaker OR keynote site:saasboomi.in OR site:nasscom.in OR site:inc42.com` |
| Lead's function-specific opinions (CMO/marketing) | `"<Lead Name>" site:etbrandequity.com OR site:economictimes.indiatimes.com` |
| Lead's function-specific opinions (Product) | `"<Lead Name>" site:yourstory.com OR site:inc42.com` |
| Company funding | `"<Company>" funding OR raise OR Series site:inc42.com OR site:entrackr.com OR site:moneycontrol.com OR site:livemint.com` |
| Company product launch | `"<Company>" launches OR launched OR unveils site:inc42.com OR site:yourstory.com OR site:economictimes.indiatimes.com` |
| Company hiring announcement | `"<Company>" hires OR appoints OR hired site:economictimes.indiatimes.com OR site:livemint.com OR site:moneycontrol.com` |
| Recent leadership change | `"<Company>" "joined as" OR "appointed" OR "named" site:economictimes.indiatimes.com OR site:moneycontrol.com OR site:livemint.com` |

**Coresignal usage rule for VWO:** reserve for Tier A only (top 10 leads per 50-lead pilot). Pull last 90 days of posts. If the lead has no posts in last 30 days OR posts are off-topic for VWO's value prop (CRO / experimentation / growth / product / D2C / SaaS), demote to axis 1 sourcing for that lead. Do not burn Coresignal credits on a Tier A lead whose recent activity doesn't tie to VWO.

## VWO social proof library (verified metrics, segment-mapped)

Use ONLY this list. Never name a brand outside this library as social proof. Never quote a metric not in this list. The metrics are sourced from VWO's published case studies. When `(none provided)` is the social proof input on a per-lead brief, default to the segment-mapped trio from this table.

| Segment | Trio for body 1 (in this order) | Notes |
| :---- | :---- | :---- |
| **D2C-Apparel / Fashion** | Andaaz Fashion (125% conversion lift), Attrangi (50% RPV lift), Utsav Fashion | Three Indian D2C apparel brands. Andaaz lift is the strongest published number; Attrangi is the SaaS-friendly metric (revenue per visitor). |
| **D2C-Beauty / Wellness / FMCG** | Amway, Andaaz Fashion, "Indian D2C brands at your stage" | Direct beauty references in VWO's roster are thin; lead with Amway, follow with adjacent D2C apparel for credibility, close with category-level. |
| **Ecom / Marketplace / Retail** | eBay, BigBasket, Yuppiechef (100% category-page lift) | Yuppiechef has the named metric. eBay and BigBasket are global/Indian marquee. |
| **Fintech / Lending / Payments / Wallets** | HDFC Bank, PayU, "Indian fintech players" | HDFC Bank is marquee; PayU is direct fintech; close with category-level. |
| **BFSI — Insurance / Banking (general)** | HDFC ERGO (47% CPA drop), ICICI Lombard (44% lead-form lift), HDFC Bank | Strongest single trio in VWO's roster. Use this as the default for fintech/insurance/healthcare regulated segments. |
| **EdTech** | Online Manipal, UNext, "Indian EdTech players at your stage" | Both are direct VWO customers in the EdTech space. |
| **SaaS B2B** | POSist (now Restroworks, 52% demo-request lift), PayScale, "Indian SaaS players" | POSist is the named SaaS-specific reference. PayScale is a B2B SaaS HR analytics ref. |
| **Health / Diagnostics / Hospitals / Healthtech** | HDFC ERGO, ICICI Lombard, "Indian healthtech brands" | Healthcare doesn't have a strong direct VWO Indian reference beyond the BFSI trio (which sells health insurance). Use the BFSI trio as proxy. |
| **Travel / Mobility / Hospitality** | Virgin Holidays, Billund Airport (49.85% click-through lift), "Indian travel players" | Virgin Holidays \+ Billund are international. Lead with Virgin (international but well-known in India), close with category-level. |

**Cross-pollination check:** before using a brand as social proof, verify it is NOT in the VWO prospect list for the current campaign. The exclusion universe (next section) doubles as a cross-pollination guard.

## Exclusion universe seed for VWO

Standard six-source exclusion (per base SKILL Section "Prospect list exclusions"). VWO-specific seeds the operator must populate at campaign start:

1. **VWO active customer list** — pull from VWO's CRM monthly. Includes everyone in the social proof library above.  
2. **VWO past-12-month meetings** — pull from VWO's CRM monthly.  
3. **VWO DNC list** — separate VWO-maintained sheet.  
4. **VWO case study customers** — every brand named in vwo.com/case-studies. Must be excluded.  
5. **VWO website logo customers** — every logo on vwo.com homepage, customers page, deck, or marketing material.  
6. **Holding-company / sister-brand expansion** — apply the base SKILL's parent/sister-brand rule to all 1-5 above. For VWO specifically, watch for these Indian conglomerates that own multiple brands: Arvind Fashions, Aditya Birla Fashion & Retail (ABFRL), House of Rare, Reliance Retail, Tata Digital, Honasa, Good Glamm, Nykaa, Marico, Mahindra, L\&T, Adani, Razorpay, Zoho.

**The known landmines from the v6 pilot:**

- Andaaz Fashion is a VWO customer → exclude all Andaaz Group brands.  
- HDFC ERGO is a VWO customer → ANY HDFC Group entity (HDFC Bank, HDFC Life, HDFC Securities, HDFC AMC) gets case-by-case review. Generally exclude.  
- ICICI Lombard is a VWO customer → ANY ICICI Group entity (ICICI Bank, ICICI Pru Life, ICICI Securities, ICICI Direct) gets case-by-case review. Generally exclude.  
- POSist is a VWO customer (now Restroworks) → exclude both names.

## VWO scoring rubric (overrides base per-product weights)

VWO falls primarily into the MarTech segment of the base rubric (per base Section "Per-product weight calibration"). Weights inherited from MarTech template, with these client-specific tweaks based on the past-meeting calibration corpus (32.7% D2C, 18.3% BFSI/Fintech, 9.2% EdTech):

| Layer | Base MarTech weight | VWO override | Rationale |
| :---- | :---- | :---- | :---- |
| L1 Fit | 25 | 25 | Unchanged. Industry sweet-spot signal kept high. |
| L2 Intent — Hiring (2a) | 15 | 15 | Hiring marketing/growth/CRO roles is the strongest individual signal for VWO. |
| L2 Intent — Leadership (2b) | 15 | 18 | New CMO/VP Marketing in last 90d is the single highest-converting signal in VWO's past meetings. Bumped 3 points over MarTech base. |
| L2 Intent — Funding (2c) | 5 | 4 | Slightly downweighted — Indian D2C founders see "saw your Series B" pings constantly; saturation. |
| L2 Intent — Growth (2d) | 5 | 6 | Headcount growth in marketing/growth function specifically (not org-wide) is a strong signal for VWO. |
| L2 Intent — News (2e) | 0 | 0 | Inherited. Awards alone don't predict VWO purchase. |
| L2 Intent — Tech stack (2f) | 10 | 12 | Bumped: legacy-tool-displacement angle (GA4 \+ Hotjar only, no A/B tool) is a strong VWO buying signal. |
| L3 Engagement | 20 | 20 | Unchanged. CMO accessible bonus per base. |
| L4 Why-Now | 10 | 10 | Unchanged. |
| **Total** | 100 | **100** | Reweights internally; total stays at 100\. |

**Layer 5 Timing multiplier for VWO:** apply base SKILL's Indian fiscal calendar table directly. No VWO-specific override. Diwali blackout (0.6×) is hard — VWO buyers are running festive-season campaigns and are heads-down. FY transition window (1.3×) is the strongest. SaaS-B2B seasonality from base table applies.

**Layer 6 Penalty multiplier for VWO:** apply base table. VWO-specific addition: prospect on a competitor's published case study page (Optimizely, AB Tasty, Convert, Statsig) → 0.2× multiplier (publicly committed to incumbent). Detect via Tavily query `"<Company>" site:optimizely.com OR site:abtasty.com OR site:convert.com OR site:statsig.com`.

**Buckets after multipliers:**

- Top Priority (95+): send this week, full Tier A custom research with Coresignal  
- Priority (75-94): send this campaign, Tier B archetype defaults  
- Active (55-74): send next campaign cycle, Tier C defaults  
- Nurture (35-54): hold; re-score monthly  
- Excluded (\<35): drop

## VWO observation library per segment (axis 1 defaults)

For Tier C (axis 1 only) and Tier B (axis 1 default with axis 3 if visible), use these segment-mapped observation defaults. These are calibrated to VWO's actual value prop — every observation maps cleanly to a VWO capability.

| Segment | Top observations (axis 1\) | VWO capability tied to each |
| :---- | :---- | :---- |
| **D2C-Apparel** | (1) Size guide depth on PDP — sits 2 clicks deep, collapsed under tab below fold. (2) PDP image stack on mobile shows product detail too late. (3) Category page density too high for first-time tier-2/3 buyer. | Heatmaps \+ A/B test on PDP layout; mobile-first PDP redesign tests; category-page grid density A/B test. |
| **D2C-Beauty / Wellness** | (1) Bundle vs single-SKU PDP serves both shoppers the same. (2) Ingredients/efficacy section below fold. (3) Subscription CTA placement competes with one-time purchase. | A/B test on PDP layout; personalisation by visitor source (Google vs Meta vs returning); subscription-vs-one-time CTA test. |
| **Ecom / Marketplace** | (1) Category page shows 24+ SKUs above mobile fold with small thumbnails. (2) Cart shows COD as default but pincode-confirm modal blocks cart. (3) Pre-checkout login wall blocks guest path. | Category density A/B test; checkout flow A/B test; guest-checkout vs login-wall A/B test. |
| **Fintech / Lending** | (1) KYC asks for PAN, Aadhaar OTP, bank linkage, selfie liveness across 4 near-back-to-back screens. (2) Single-use-case homepage serves first-time investors AND active F\&O traders AND mutual fund investors with one CTA. (3) Pricing/demo page asks same fields regardless of buyer segment. | Form analytics on KYC step; A/B test on homepage hero with persona segmentation (geo, source, returning); demo-form personalisation. |
| **BFSI / Insurance / Banking** | (1) Quote-page form length (15+ fields). (2) Lead form serves both retail and SME with same fields. (3) Hospital-network lookup adds friction before quote. | Form analytics; A/B test on form-step splits (single-step vs multi-step); personalisation by visitor segment. |
| **EdTech** | (1) Course detail page puts fee section at the bottom after curriculum, faculty, schedule, testimonials. (2) EMI calculator depth — 3 clicks deep. (3) Free-to-paid step has no tour or onboarding. | Heatmap on fee-section visibility; A/B test on fee-section placement; personalisation on free-to-paid CTA. |
| **SaaS B2B** | (1) Demo form serves both SMB and enterprise leads with same fields. (2) Pricing page lacks segment-specific routing. (3) Trial signup → activation step has no progressive disclosure. | Form analytics on demo form; A/B test on pricing-page CTA; trial-flow A/B test. |
| **Travel / Mobility** | (1) Search form date defaults don't match common Indian search patterns (round-trip vs one-way bias). (2) Route page density for tier-2/3 cities. (3) COD vs prepay messaging on booking page. | A/B test on search-form defaults; route-page A/B test; payment-method messaging test. |
| **Health / Diagnostics / Hospitals** | (1) Lead form for B2B (insurer/corporate) and B2C (patient) uses same fields. (2) Treatment page tone serves international patient \+ family caregiver \+ hospital partner with one CTA. (3) Trust signals (certifications, doctor profiles) below fold. | Form analytics; A/B test on hero with persona segmentation (international patient vs family vs partner); trust-signal placement test. |

**Body 2 capability rotation rule (specific to VWO):** when generating body 1 and body 2 for the same lead, body 2 must use a DIFFERENT VWO capability than body 1\. Approved capability pairs (use the second one for body 2):

- Body 1 \= A/B test on hero personalisation → Body 2 \= form analytics \+ heatmaps on demo/checkout  
- Body 1 \= A/B test on hero personalisation → Body 2 \= session recordings \+ funnel reports on signup/onboarding  
- Body 1 \= heatmaps \+ A/B test on PDP → Body 2 \= personalisation by visitor source on category/landing  
- Body 1 \= form analytics on KYC → Body 2 \= A/B test on form-step splits  
- Body 1 \= session recordings → Body 2 \= on-page surveys \+ visitor segmentation

When the same lead has multiple emails generated across a campaign sequence, capability differentiation matters more than segment differentiation. Repeat-buyer fatigue is real; capability rotation is what keeps body 2 fresh.

**For sibling leads at the same company** (e.g., 3 leads at one Series B fintech): each sibling gets a different capability angle in body 2 even if body 1 leads with the same observation. The earlier conversation built this exact pattern across Samco Securities (Ulhas Joshi → form analytics \+ heatmaps; Prashant Gupta → session recordings \+ funnel reports). Continue the pattern.

## VWO subject library by persona archetype

Inherits the format from base Rule 1: `FirstName, [2-4 word observation]`. Lowercase, ≤32 chars, ≤5 words including first name.

VWO-specific defaults per archetype:

**Marketing / Growth (CMO, VP Marketing, Head of Growth, Performance Marketing Head):**

- `<Name>, your homepage hero` — when axis 1 is hero personalisation  
- `<Name>, your demo form` — when axis 1 is demo/pricing form  
- `<Name>, your checkout flow` — when axis 1 is checkout/cart  
- `<Name>, your category page` — for D2C  
- `<Name>, your meta ads` — when axis 3 is paid-channel landing page  
- `<Name>, your signup funnel` — for SaaS/Fintech

**Product (CPO, VP Product, Head of Product):**

- `<Name>, your onboarding step` — activation flow  
- `<Name>, your trial gate` — for SaaS  
- `<Name>, your empty state` — first-run experience  
- `<Name>, your signup screen`  
- `<Name>, your paywall` — for B2C subscription

**Founder / CEO (sub-200 employee D2C/SaaS):**

- `<Name>, your homepage` — broadest, most peer-toned  
- `<Name>, your demo button`  
- `<Name>, your launch page`  
- `<Name>, your pricing page`

**E-commerce Head / D2C Lead:**

- Same as Marketing/Growth, with category-page emphasis  
- `<Name>, your category page`  
- `<Name>, your cart cod` — for tier-2/3 D2C  
- `<Name>, your pdp depth`

**Engineering (CTO at fintech/SaaS — rare for VWO):**

- `<Name>, your kyc step`  
- `<Name>, your sso flow`  
- `<Name>, your signup api` — when fintech and signup is API-driven

**Avoid for VWO across all archetypes:**

- Anything with "experimentation," "A/B test," "CRO," "conversion lift" in the subject — these brand the email as a vendor pitch immediately  
- Anything with VWO's product name in the subject  
- Anything aspirational ("better conversions," "more signups")

## VWO competitor list (for axis 3c and exclusion penalty)

Refresh quarterly. Last updated: 2026-05-07.

**Direct competitors (high overlap, displacement angle):**

- Optimizely (formerly Optimizely Web \+ DXP)  
- AB Tasty  
- Convert.com  
- Statsig (newer, engineering-led)  
- PostHog (open-source, product analytics \+ experimentation)

**Adjacent / partial overlap (integration or replacement angle):**

- Adobe Target (enterprise only)  
- LaunchDarkly (feature flags, not full CRO)  
- Mida.so (SMB, India-specific)  
- Hotjar (heatmaps \+ recordings only — VWO's "you can replace your point tools" angle)  
- FullStory (session recordings \+ analytics)  
- Mixpanel / Amplitude (product analytics — adjacent, not direct)

**Penalty trigger:** if a prospect's tech stack (BuiltWith via Apollo keywords proxy) lists any of the direct competitors as the active CRO/experimentation tool, apply 0.2× multiplier per base Layer 6\. Detect via Tavily: `"<Company>" site:optimizely.com OR site:abtasty.com OR site:convert.com OR site:statsig.com OR site:posthog.com` — if the prospect appears as a customer/case study on any competitor's site, penalty fires.

## VWO four-stage pipeline notes

Inherits the base Stage 1-4 pipeline. VWO-specific notes per stage:

**Stage 1 (Signal Collection):**

- Apollo bulk\_enrich for firmographics (run AFTER exclusion dedupe)  
- Tavily extract on prospect homepage \+ 1-2 funnel pages (axis 1 source)  
- Tavily site-targeted on Indian press list for axis 3d (funding, leadership, launches)  
- Coresignal for Tier A only (axis 2 LinkedIn posts)  
- Tavily site-targeted for axis 2 articles/talks (Substack, Medium, SaaSBoomi, ETBrandEquity)  
- Apollo's `headcount_six_month_growth` \+ recently-joined filter for axis 3a hiring \+ leadership change  
- Axis 3b NOT AVAILABLE (no watcher infra) — note in graph as `axis_3b: null, source: "watcher_infrastructure_not_configured"`

**Stage 2 (Signal Selection — formula applied per base):**

- VWO's `business_impact` field is high (0.9-1.0) for any signal that ties to the lead's funnel/conversion/experimentation/growth function. Low (0.3-0.5) for signals tied only to revenue/product/engineering without conversion implication.  
- For VWO specifically, "hired CMO/VP Marketing 0-90 days" \+ "marketing/growth function headcount up 10%+" \+ "uses only Hotjar \+ GA4" is the canonical Top Priority composite. When all three stack fresh (≤30 days), this is a 1.20× composite case.

**Stage 3 (Insight Generation — angle library application):**

- Use base SKILL angle library. VWO-specific picking rules:  
  - Hiring marketing roles → default angle "funnel about to get scrutinised" (CRO seller fit)  
  - Hiring product roles → default angle "product surface about to be re-examined" (UX audit angle)  
  - New CMO 0-90 days → "first-quarter wins mandate" (almost always the strongest hook)  
  - Page change pricing → axis 3b unavailable; use axis 1 instead (homepage observation)  
  - LinkedIn post on growth/CRO/experimentation topic → tie post belief to the lead's own surface gap (e.g., they wrote about persona-based hero testing → their own homepage runs one hero for everyone)

**Stage 4 (Email Writing — body templates from base):**

- Body 1 paragraph 2 stacks the segment-mapped trio from VWO's social proof library above (in stated order)  
- Body 1 must include the reassurance line: *"Often, these don't require a full redesign. Even small, validated changes can create measurable improvements."* AND the ease coda: *"without heavy dev effort."*  
- Body 1 paragraph 3 CTA names the company and "20 min" — phrase as a peer offer, not a vendor ask  
- Body 2 uses a different VWO capability than body 1 (per the rotation table above)  
- Body 3 is breakup, references the lead's signal naturally

## VWO validation checklist additions

Inherits all 50 base checks. VWO-specific additions:

**V-VWO-1: Social proof from approved library only.** Every body 1 and body 2 names brands ONLY from the VWO social proof library. Any other brand mention fails the email.

**V-VWO-2: Verified metrics only.** Every quoted percentage in body 1/body 2 traces to the table above. Andaaz 125%, Attrangi 50%, HDFC ERGO 47%, ICICI Lombard 44%, Yuppiechef 100%, POSist 52%, Billund 49.85% are the verified set. No other metrics are quoted.

**V-VWO-3: VWO-specific cross-pollination.** No prospect-list company appears in the VWO active customer or case study list. Run before send.

**V-VWO-4: Capability rotation enforced.** When multiple emails are drafted for sibling leads at the same company, body 2 capabilities are unique across siblings. (Per the Samco pattern from earlier conversation.)

**V-VWO-5: No VWO product name in subject.** Subject does not contain "VWO," "Wingify," "experimentation," "A/B test," "CRO," or "conversion."

**V-VWO-6: Reassurance line \+ ease coda present.** Both phrases appear in body 1 paragraph 2 verbatim.

## Validation seed (sample emails for operator review)

These are 3 sample sequences validated against this child skill. The operator reviews before any campaign launches under v17 base \+ this VWO overlay.

**Sample 1 — D2C Apparel, CMO, Tier A, axis 2 \+ axis 1:**

- Lead: hypothetical CMO at a Series B D2C apparel brand who posted on LinkedIn 14 days ago about "tier-2/3 acquisition needs different creative, not just translation"  
- Body 1 leads with the LinkedIn post (axis 2\) and ties it to the homepage hero serving one creative variant for all geographies  
- Body 1 social proof: Andaaz Fashion (125%), Attrangi (50%), Utsav Fashion  
- Body 2 capability: heatmaps \+ A/B test on category page density  
- Body 3: warm breakup

**Sample 2 — Fintech, Head of Growth, Tier B, axis 1 \+ axis 3a:**

- Lead: Head of Growth at a Series B fintech, no fresh axis 2 signal  
- Body 1 leads with axis 1 (KYC step asking 4 documents across 4 screens)  
- Body 1 social proof: HDFC Bank, PayU, "Indian fintech players"  
- Body 2 capability rotation: A/B test on form-step splits  
- Body 3: warm breakup tied to KYC plateau signal

**Sample 3 — Samco Securities pattern (from prior session) — Fintech, multi-stakeholder:**

- Sibling 1 (CEO RankMF): body 2 capability \= form analytics \+ heatmaps on demo/pricing form  
- Sibling 2 (CBO): body 2 capability \= session recordings \+ funnel reports  
- Both use the same axis 1 (homepage serves multiple personas with one CTA) but rotate body 2 capabilities

## Operating gates for VWO campaigns

**Gate I-1 (initial child skill sign-off):** this file. Operator confirms ICP, persona priorities, segment-observation library, social proof library, exclusion seed, and tooling constraint match VWO's reality.

**Gate I-2 (weekly diff after campaign close):** after every campaign, append outcomes to `vwo_campaign_outcomes.csv`. Run base SKILL Loops 1-6 (ICP, scoring, observation angles, subject patterns, exclusion universe, persona research ROI). Surface material changes to operator before applying.

**Gate I-3 (quarterly audit):**

- Refresh competitor list (any new Indian/global CRO/experimentation tool launched?)  
- Refresh exclusion universe (any new VWO customers? any sister-brand expansions to map?)  
- Refresh social proof library (any new VWO case studies? any deprecated metrics?)  
- Refresh axis 3b status (has watcher infrastructure been added? if yes, lift the "not available" flag and rebuild the signal graph schema)  
- Re-validate the per-segment observation library — has any Indian D2C / fintech / SaaS pattern shifted enough that the defaults need updating?

## What stays inherited from base (do not duplicate here)

- All 50 validation checks (Subject length, em dash ban, banned vocabulary scan, no-staccato check, empathy marker present, generous CTA, etc.)  
- The 12 rules (subject format, opener observation, one problem per body, word count limits, paragraph formatting, no greeting/sign-off, no em dashes, no spintax, "you/your" density, simpler English \+ warmth, social proof from roster, three-step cadence)  
- The four-stage pipeline (Signal Collection → Selection → Insight → Email Writing)  
- The signal selection formula  
- The signal → insight chain pattern  
- The base angle library  
- The axis 2 operationalization recipe  
- The body 1/2/3 templates with their structural beats  
- The base scoring methodology (the 5-layer model \+ composite multiplier \+ recency decay)  
- The Indian fiscal calendar timing multipliers  
- The penalty multipliers  
- The six-source exclusion routine and the holding-company expansion rule  
- The self-learning loop (6 sub-loops, decay rules, periodic review cadence, campaign postmortem deliverable)  
- The persona-tailored subject conventions (CEO mirror, age cohort, role tenure modifiers)  
- The three-axis observation model and per-tier protocol  
- The behavioral watcher infrastructure pattern (flagged as not-yet-set-up for VWO; set up at next opportunity)

## Iteration history (VWO-specific)

- **v0 (deprecated):** US-playbook subjects, single-touch, generic CRO copy. Rejected by VWO.  
- **v1 (deprecated):** Spintax-heavy, generic 50-80 word bodies, salutation/sig in body. Rejected.  
- **v2 (deprecated):** Wrong source list (used DNC tab as targets). Rejected.  
- **v3 (deprecated):** Long subjects (5-7 words), 120-150 word bodies, news/funding openers. Rejected.  
- **v4 (deprecated):** Short subjects, observation-based, but no paragraph formatting \+ em dashes present. Rejected.  
- **v5 (accepted as draft):** 3-step sequences, 3-4 word subjects, observation-based openers, ≤120 word bodies, single problem per body. Accepted pending paragraph formatting.  
- **v6 (final, sendable):** v5 \+ paragraph formatting \+ em dashes removed. Accepted.  
- **v7 (current — this child skill):** v6 patterns \+ the v17 base SKILL framework formalised \+ VWO-specific overrides (ICP calibrated to past meeting corpus, segment-mapped social proof library with verified metrics, axis sourcing constrained to Coresignal+Tavily, axis 3b explicitly flagged as unavailable until watcher infra is set up, capability rotation rules between body 1 and body 2, sibling-lead capability differentiation pattern from the Samco multi-stakeholder build).

