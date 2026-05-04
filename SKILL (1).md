---
name: india-cold-email
description: Use this skill whenever drafting B2B cold email campaigns aimed at Indian buyers (D2C founders, growth/marketing/product leaders at Indian SaaS, BFSI, EdTech, Health, Travel companies). Triggers include any mention of Indian outbound, India SDR campaign, Smartlead campaign for India, cold emails to Indian companies, campaigns targeting India D2C/Ecom/Fintech ICP, persona-tailored subject lines for Indian CXOs, ICP refinement from campaign reply data, or self-learning outbound loops. Produces emails that follow India outbound conventions: ultra-short subjects (calibrated per persona archetype, company stage, age cohort, and the CEO mirror hypothesis), observation-based openers (not news/funding), simpler English, conversational "you/your" tone, paragraph-formatted bodies under 120 words, three-step sequences, social proof from the seller's own customer roster, strict prospect-list exclusions including holding-company sister-brand expansion, and a closing-the-loop self-learning system that refines ICP, scoring, observation angles, and subject patterns from each campaign's tagged replies.
---

# India Cold Email — Style, Structure, and Sequence Skill (v4)

## Why this skill exists

Default LLM cold email templates ("Quick question," "Idea for X," "I came across your work") and the funding/news-event opener ("Saw your Series C," "Congrats on the acquisition") underperform with Indian buyers in 2026. Two reasons:

1. **The patterns are recognized as AI-generated.** Indian D2C founders and growth heads see dozens of these per week. News/funding openers in particular have been overused by automated tools since 2024 and signal "this person hasn't actually looked at my product."
2. **They don't answer "why me, why now."** A real prospect wants to know what the sender SAW that made them reach out specifically. Not what they read in the press.

The patterns in this skill are calibrated based on iteration with a real Indian SaaS engagement (VWO outbound pilot) where v1–v4 versions were rejected by the buyer's team and v5/v6 were accepted as ready-to-send.

## The 12 rules

### 1. Subject line: 3–4 words, lowercase, observation/funnel-specific

Subject must be ≤4 words and ≤25 characters. Lowercase. No punctuation other than apostrophe. Reference a specific page, funnel step, or pattern on the prospect's own product, NOT a news event.

**Good (real examples that converted):**
- `your size guide`
- `razorpayx onboarding`
- `your cart cod`
- `your kyc step`
- `category density`
- `your demo form`
- `your fee section`
- `your emi step`

**Banned:**
- "Quick question," "Idea for X," "X — one observation" (US-playbook tells)
- Subjects with !
- Subjects with em dashes
- News/funding openers in the subject ("congrats on series c", "saw your acquisition")
- Title-case ("Your Size Guide" — feels formal/corporate)
- Anything over 4 words or 25 chars

For 3-step sequences, the three subjects in a sequence connect to three different observations, not one repeated theme.

The rule above is the format. For wording calibrated to specific personas (founder vs CMO vs CTO vs CFO), company stage, age cohort, and the CEO mirror hypothesis, see the section "Persona-tailored subject lines" below.

### 2. Opener: observation-based, never news-based

The first 1–2 sentences of body 1 must lead with a specific OBSERVATION about the prospect's own product, page, funnel, or UX pattern. Not a press release reference.

**Good observation patterns:**
- "Your size guide on [domain] sits two clicks deep on every PDP, and your fabric/care detail is collapsed under a tab below the fold."
- "On [domain], your KYC step asks for PAN, Aadhaar OTP, bank linkage and a selfie liveness check across four near-back-to-back screens."
- "Your cart shows COD as your default and pre-selected option, but your pincode-confirmation modal blocks your cart for nearly 2 seconds on every load on mobile."
- "Your category page on [domain] shows 24 SKUs above your mobile fold with a fairly dense grid and small thumbnails."
- "On [domain], your demo form serves both your hospital and your insurer leads with the same set of fields."
- "Your course detail pages put your fee section at the very bottom, after curriculum, faculty, schedule and testimonials."

**Banned opener patterns (never lead with these):**
- "Saw your Series A/B/C/D"
- "Congrats on the [funding round]"
- "Read about your acquisition / new CEO / launch"
- "Noticed you raised"
- "Your recent [news event]"
- Anything that quotes a press release in the first two sentences

If a news event is genuinely relevant to the observation (e.g., a new product line forces the category page to handle two shopper types), it can be referenced LATER in the body, not the opener.

**How to find an observation when you don't have time to manually browse the site:**
- Use the prospect's `short_description` and `keywords` from enrichment to infer common patterns for that vertical
- Use category-level CRO knowledge: D2C apparel always has size-guide depth issues; fintech always has long KYC; EdTech always has fee placement choices; logistics SaaS always has demo-form segmentation
- Light Tavily search: `"<domain>" signup OR checkout OR pricing` for one observation per lead
- For higher-quality runs: actually browse 2–3 pages on the prospect's site

### 3. One problem per body, three different problems across the sequence

Each body addresses ONE specific funnel/CRO problem. Don't list 2 or 3. Pick the highest-leverage one for that prospect.

For 3-step sequences, the three bodies cover three DIFFERENT angles on the same prospect, so the sequence doesn't feel like the same email rephrased.

Example for a D2C apparel brand:
- Body 1: size guide depth on PDP
- Body 2: PDP image stack mobile-first ordering
- Body 3: breakup with light reference back to PDP testing

### 4. Word count limits — hard ceilings

| Body | Min | Max | Target avg |
|---|---|---|---|
| Body 1 | 90 | 120 | ~100 |
| Body 2 | 70 | 110 | ~95 |
| Body 3 | 50 | 80 | ~55 |

Count rigorously before writing the CSV. Trim aggressively.

### 5. Paragraph formatting for readability

Each body is split into paragraphs separated by `\n\n` (blank line):
- Body 1: 3 paragraphs
  - Para 1 = the observation + why it matters
  - Para 2 = the test/insight idea
  - Para 3 = social proof + soft CTA
- Body 2: 2–3 paragraphs (same shape, different observation)
- Body 3: 2 paragraphs (acknowledge / open door)

Subject lines stay one line. Do not split sentences awkwardly across paragraphs.

### 6. No greeting, no sign-off, no signature in the CSV body

The `body` column contains ONLY the message body. No "Hi <name>", no "Best,\n<sender>", no calendar link, no PS. The user wires up salutation and signature through Smartlead variables.

Body opens with the first content sentence. Body ends with the soft CTA (or breakup line for body 3).

### 7. No em dashes (—) anywhere

The em dash (`—`, Unicode U+2014) is a signature LLM-tell. Replace with proper punctuation:
- As a parenthetical pause → use a comma OR split into two sentences
- As a list separator → use a colon OR restructure
- As a clause introducer → use "so", "and", "but", or split into two sentences

Example: `"different fields, different routing, different SLAs — usually improves your SQL ratios"` → `"different fields, different routing, different SLAs. This usually improves your SQL ratios"`

Single hyphens INSIDE words are fine (`tier-2`, `self-serve`, `go-to-market`, `RazorpayX`). Standalone double-hyphens (`--`) are also banned.

### 8. No spintax, no template variables in subject/body

No `{a|b|c}`. No `{{first_name}}`. No `{{company_short}}`. Plain deterministic text. Personalization is achieved through the unique observation per lead, not through randomization.

(Spintax was previously recommended for deliverability but has been deprecated for outbound where each email is already unique. The unique content itself is sufficient deliverability variation.)

### 9. Heavy "you" / "your" — second-person throughout

Body 1 and body 2: ≥5 instances of "you / your / you're / yours" each (case-insensitive).
Body 3: ≥3 instances.
Target averages: 7 for body 1/2, 5 for body 3.

The reader should feel addressed directly throughout. Avoid third-person constructions where possible.

### 10. Simpler English

Replace any word a class-10 student in India might struggle with:
- "inflection point" → "turning point"
- "compound" → "stack up"
- "cohort" → "user group" (or keep "cohort" if it's the prospect's own jargon)
- "leverage" → "use"
- "compression" → "less time"
- "unparalleled" → drop
- "delight" → "make happy" or drop
- "synergy" / "world-class" / "game-changing" → drop entirely

Sentences ≤18 words, prefer 10–14. Active voice. One idea per sentence.

Industry terms are OK and add credibility (A/B test, CRO, heatmap, PDP, checkout, KYC, signup, demo-form, EMI, COD).

### 11. Social proof from seller's own customer roster

Every body 1 and body 2 includes one short social-proof line referencing a real customer of the seller — sourced from the seller's website (case studies page, customer page, success stories). Quote a real metric only if verified. Never invent numbers.

Format: `"<Customer Name> ran tests like these on <seller> and saw a <metric> lift."` or `"<Customer Name>'s <feature> with <seller> is a useful comparable for your team."`

Match the customer to the prospect's segment. Never name a prospect-list account as social proof for another prospect (cross-pollination check).

When no exact segment match exists in the seller's roster:
- Use the closest near-lookalike
- Use a famous Indian brand in the adjacent space
- Generic backstop: "Indian D2C brands at your stage" / "Indian fintech players"

### 12. Three-step sequence cadence

Every prospect gets THREE emails: body 1 (initial), body 2 (T+3 follow-up), body 3 (T+10 breakup).

- **Body 1** opens fresh with the strongest observation
- **Body 2** lightly references body 1 ("Following up on [domain]" / "One more observation on [domain]" / "Quick second observation on [topic]") and introduces a DIFFERENT observation/angle
- **Body 3** is the breakup. Acknowledge they're busy. State you're stopping. Leave a lightweight open door. Do not ask another time. Do not pitch again.

In Smartlead, configure as a 3-step campaign with 3-day gap between step 1 and step 2, 7-day gap between step 2 and step 3. Stop sequence on reply.

## CSV schema for Smartlead import

```
email, first_name, last_name, company_short, subject_1, body_1, subject_2, body_2, subject_3, body_3, domain, company_full, industry, employees, country, contact_title, score, segment, observation_angle, persona_archetype, tier_abc, stage, age_cohort, role_tenure_months, founder_led, lead_id
```

The `observation_angle` column captures what observation body 1 led with — useful for QA and post-campaign learning.

The `persona_archetype` column captures the matched archetype (founder, marketing, product, engineering, finance, hr, ops, sales) — used in the self-learning Loop 4 to refine subject patterns per archetype.

The `tier_abc` column captures whether this lead got Tier A custom research, Tier B archetype defaults, or Tier C role × segment × stage defaults — used in Loop 6 to validate the persona research ROI.

The `lead_id` column is the join key into `campaign_outcomes.csv` for the self-learning loop.

## Validation checklist (run before writing CSV)

Programmatic checks every campaign must pass:

1. **Subject length:** every subject_1/2/3 ≤25 chars, ≤4 words
2. **Subject case:** every subject lowercase
3. **Subject uniqueness:** within each row, the 3 subjects are different
4. **Banned subject patterns:** no "quick question," "idea for," em-dash + "observation"
5. **Body 1 word count:** 90–120, target ~100
6. **Body 2 word count:** 70–110, target ~95
7. **Body 3 word count:** 50–80, target ~55
8. **Banned openers:** body 1 first 2 sentences free of "Saw your Series", "raised", "acquisition", "launched", "congrats", "new CEO" etc.
9. **No greeting:** body never starts with "Hi", "Hey", "Hello", "Dear", a first name, or "Greetings"
10. **No sign-off:** body never ends with "Best,", "Thanks,", "Regards,", "Cheers,", a sender name, or signature lines
11. **No em dashes:** zero `—` (U+2014) and zero `--` (double hyphen) in any field
12. **No spintax:** zero `{...|...}` and zero `{{...}}` in subject or body
13. **You/your density:** ≥5 in body_1/2 each, ≥3 in body_3
14. **Paragraph structure:** body_1 = 3 paragraphs, body_2 = 2–3 paragraphs, body_3 = 2 paragraphs (separator: `\n\n`)
15. **Social proof:** every body 1 and body 2 has at least one named customer from seller's roster
16. **No invented metrics:** every quoted percentage cross-checked to a verified source (case study URL or documented win)
17. **Cross-pollination:** no prospect-list company name appears as social proof for another prospect
18. **Exclusion dedupe verified:** prospect list run against the full exclusion universe (DNC + active customers + past-12-month meetings + case study customers + website-logo customers + all parent/sister brands of the above). 10-row spot-check of survivors confirmed none belongs to an excluded holding company.
19. **Persona-archetype subject mapping:** every Tier A subject is custom-researched against the prospect's LinkedIn/CEO mirror; every Tier B subject matches its persona archetype default; every Tier C subject is the role × segment × stage default.
20. **Outcomes CSV row prepared:** every lead has a row in `campaign_outcomes.csv` pre-populated with all firmographic + persona + content features, ready to be appended with sentiment/reason/persona_signal once replies come in. Without this row at send time, the self-learning loop cannot retrofit the data.

## Anatomy of a good body 1 (annotated, 100 words)

> [Observation, 1–2 sentences]
> On citymall.live, your cart shows COD as your default and pre-selected option, but your pincode-confirmation modal blocks your cart for nearly 2 seconds on every load on mobile. Tier-2 and tier-3 buyers are still your dominant cohort, and on lower-end devices your 2-second blocker doubles in perceived weight.
>
> [Test/insight, 1 sentence]
> A test deferring your pincode modal to checkout step one, instead of your cart, typically lifts your cart-to-checkout by 8-15% on tier-2/3 commerce.
>
> [Social proof + CTA, 1–2 sentences]
> BigBasket has run similar cart-flow simplification tests with VWO. Worth a 20-min walkthrough on your cart funnel?

## Anatomy of a good body 2 (annotated, 95 words)

> [Light reference + new observation]
> One more observation on citymall.live. Your category page shows 24 SKUs above your mobile fold with a fairly dense grid and small thumbnails. Your tier-2/3 first-time shopper, often on a 5-inch device, scans your density very differently from a metro buyer, and your current grid likely depresses your first-tap rate.
>
> [Test idea + social proof]
> A test reducing your grid to 12 SKUs with bigger thumbnails and clearer price strikes typically lifts your category-to-PDP by 15-25%. Yuppiechef saw a 100% lift in conversions on a similar navigation rework with VWO.
>
> [CTA]
> Want me to share the exact test plan for your category page?

## Anatomy of a good body 3 (annotated, 55 words)

> [Breakup acknowledgement]
> Wrapping up here, Gaurav, on citymall.live. If cart and category testing isn't a focus for you right now, totally understand.
>
> [Open door + close]
> If your tier-2/3 cohort CVR plateaus, or your CAC on the new geos climbs, my note is here for whenever you want to revisit. Wishing you and the team a strong scale-up ahead.

## How to source observations efficiently

Time per lead matters. Tiered approach:

**Tier A — high-value leads (top 10–20% of pilot):** Manually browse 2–3 pages on the prospect's website. Note one specific observable thing per page.

**Tier B — middle leads:** One Tavily extract on the homepage + one search for `<domain> signup OR checkout OR pricing OR demo`. Pull observations from the structured response.

**Tier C — long-tail leads:** Infer from segment + firmographics + category-level CRO patterns. Indian fintech almost always has overlong KYC. Indian D2C apparel almost always has size-guide depth issues. Indian EdTech always has fee placement choices.

In all cases, the observation should be specific enough that the prospect could agree it's true, but generic enough that it doesn't require deep site knowledge.

## Persona-tailored subject lines (research-driven, per ICP)

The 3-4 word lowercase observation pattern from Rule 1 is the format. The WORDING within that format has to match how the persona reads, writes, and thinks. A founder reads differently from a CMO, who reads differently from a CTO. Indian buyers further vary by company stage, age cohort, role tenure, industry vertical, and the CEO's own communication style (which often sets cultural norms in founder-led companies).

This section turns Rule 1 from "follow the format" into "match the format to the human."

### Why persona research matters more in India

A CXO at a US Series B SaaS gets ~30 cold emails/day, scans them in Superhuman, and acts on observable patterns. An Indian CXO at a similar-stage company gets 50-150/day across personal Gmail + work Outlook + LinkedIn DMs + WhatsApp, and the email that gets opened is the one that does NOT pattern-match to "vendor pitch." Format and wording have to feel native to how that person already writes internal notes.

The strongest-converting Indian cold subject in 2026 is one that looks like it could have come from a colleague's Slack/internal email — not a vendor. Everything in this section is about achieving that.

### Research vectors per prospect

For top-tier prospects (Tier A — top 20% of pilot), spend 5-7 minutes per lead pulling:

1. **Their LinkedIn activity (last 90 days):** what they post about, how they write (terse vs essay-style), what hashtags or keywords recur, who they tag, whether they use first-person or third-person framing. Their writing style on LinkedIn is the closest proxy to how they read email.
2. **Public talks, podcasts, interviews:** do they speak in metrics, anecdotes, or framework-y language? Listen for 2 minutes of any podcast appearance. Their verbal cadence reveals what kind of email opener will not feel jarring.
3. **Their CEO's communication style** (founder-led companies especially): in Indian founder-led firms, communication norms cascade from the top. If the CEO writes in short, plain English on LinkedIn, the org tends to as well. If the CEO uses MBA-speak, the org speaks in MBA-speak. If the CEO is sarcastic and casual, so are their direct reports.
4. **Tenure and trajectory:** how long in current role? First-time CXO vs serial? Just-joined (0-12 months) vs long-tenured (3+ years)? New joiners want to make a mark and will take observation-led pings about a fresh look. Long-tenured leaders want validation of decisions already made and respond to comparisons with peers.
5. **Company-stage signals:** founder-led seed/Series A leans informal, peer tone. PE-backed mid-market leans numbers-led, ROI tone. Listed company leans formal, brand-conscious, references peer companies more than peer individuals.

For middle and long-tail prospects, use category defaults (next subsection) instead.

### Subject-line patterns by persona archetype (Indian B2B, 2026)

These are starting templates per archetype. Iterate based on the self-learning loop (later section). Avoid duplicating any of Rule 1's reference examples — those are public and may be pattern-detected by spam filters over time.

**Founder / CEO** (Indian, Series A to Series C, age 28-42):
- Opens what looks like a peer ping or an investor/board observation, NOT a vendor pitch
- Hates corporate language. Reads on phone between meetings. Decides in 2 seconds.
- Pattern: 3 words, lowercase, observation about a single product surface
- Examples: `your pricing page`, `your homepage hero`, `your demo cta`, `your founder letter`
- Avoid: anything with "growth," "scale," "ROI," "leverage" — these read as vendor

**Marketing / Growth leader** (CMO, VP Marketing, Head of Growth):
- Reads more emails than peers, has higher tolerance for tactical specificity
- Opens what signals "I've actually looked at your stack"
- Pattern: 3-4 words, mentions a specific channel, funnel step, or tool
- Examples: `your meta funnel`, `your post-purchase flow`, `your shopify checkout`, `your utm setup`
- Avoid: subjects that don't reference a specific thing on their site or stack

**Product leader** (CPO, VP Product, Head of Product):
- Thinks in metrics, tests, user journeys, retention curves
- Opens what reads like a quick UX observation from a fresh user
- Pattern: 3-4 words, references a specific user flow or screen
- Examples: `your onboarding step`, `your empty state`, `your activation gate`, `your aha moment`
- Avoid: subjects that are too sales-funnel-coded ("conversion lift," "demo book")

**Engineering leader** (CTO, VP Engineering, Head of Eng, Staff Engineer):
- Terse. Skeptical of marketing language. Opens technical-sounding signals only.
- Pattern: 3 words, technical vocabulary
- Examples: `your api docs`, `your status page`, `your sso flow`, `your sdk surface`
- Avoid: anything CRO-coded, anything with "user experience," anything aspirational

**Finance leader** (CFO, VP Finance, Head of Finance, Financial Controller):
- Reads for ROI signal, hates fluff, scans for numbers
- Pattern: 3-4 words, references a cost/efficiency dimension or compliance touchpoint
- Examples: `your gst flow`, `your invoicing step`, `your billing modal`, `your reco process`
- Avoid: anything that sounds like a marketing pitch

**HR / People leader** (CHRO, Head of HR, VP People, Talent leader):
- Tolerates slightly warmer/relational tone than peers
- Pattern: 3-4 words, references a candidate or employee touchpoint
- Examples: `your careers page`, `your apply flow`, `your offer letter`, `your nps loop`
- Avoid: anything cold-vendor-coded

**Operations / Supply Chain leader** (COO, VP Ops, Head of Ops, Head of Supply Chain):
- Opens what looks like a process-level observation, references workflows
- Pattern: 3-4 words, references a workflow or step
- Examples: `your dispatch flow`, `your wms step`, `your returns gate`, `your sla buffer`
- Avoid: subjects that imply you don't understand operational complexity

**Sales leader** (CRO, VP Sales, Head of Sales):
- Highest skepticism of cold outbound, since they ARE cold outbound. Pattern-matches in 1 second.
- Opens what feels like peer-to-peer observation, never vendor
- Pattern: 3 words, references a specific sales surface or motion
- Examples: `your demo form`, `your trial flow`, `your pricing tier`, `your sdr cadence`
- Avoid: anything that mimics another SDR's template — they've seen all of them

### Modifiers based on company stage

| Stage | Tone shift | Subject example pattern |
|---|---|---|
| Seed / Series A (under 100 employees, founder-led) | Most casual. Use the founder's own informal vocabulary if visible on LinkedIn. | `your hero copy`, `your nps loop` |
| Series B / C (100-500 employees) | Standard observation pattern, role-specific. | `your meta funnel`, `your kyc step` |
| Listed / large enterprise / PE-owned (500+) | More formal. Less first-person. References company-level not individual-level. | `your retail funnel`, `your branch flow` |

### Modifiers based on age cohort

| Age | Tone shift | Notes |
|---|---|---|
| Under 30 (often PMs, growth managers, junior leaders) | Shorter, lowercase, internet-native vocabulary OK | "your aha moment" works |
| 30-45 (most CXOs in modern startups) | Clean lowercase observation pattern works as-is | The default |
| 45+ (often traditional industry CXOs, BFSI, manufacturing) | Slightly more formal. Mixed case acceptable. Less internet-native. | "Quick note on your KYC step" can work, where it would fail for younger cohort |

### Modifiers based on industry culture

| Industry | Subject calibration |
|---|---|
| D2C / Ecom | Tactical, conversion-coded vocabulary works. Reference SKUs, PDPs, checkout. |
| SaaS B2B | Product-coded vocabulary works. Can use "demo," "trial," "signup," "onboarding." |
| BFSI / Banking / Insurance | More conservative tone. References trust signals, compliance touchpoints, regulatory steps. Avoid casual-startup vocabulary. |
| EdTech | References student / parent journey, fee structure, course discovery. |
| Manufacturing / Traditional / B2B Industrial | Most formal. References operational metrics, dispatch, SLA, dealer network. Avoid all startup vocabulary. |
| Health / Diagnostics / Pharma | Reference patient journey, lab flow, prescription step. Conservative tone. |
| Travel / Mobility | Reference search/booking flow, route page, fare step. Tactical OK. |

### Modifiers based on role tenure

| Tenure in current role | Reading posture | Subject angle that works |
|---|---|---|
| Under 12 months (new joiner) | Looking to make visible early wins. High openness to fresh-eyes observations. | Lead with a NEW issue ("your onboarding step") |
| 1-3 years (settling in) | Default cold-email tolerance | Standard observation pattern |
| 3+ years (long-tenured) | Pattern-matches "vendor" instantly. Wants validation, peer comparisons, market data. | Reference what peer companies are doing differently ("your peers' kyc step") |

Tenure is visible on LinkedIn and is a 30-second lookup per Tier A prospect.

### The CEO mirror hypothesis

Founder-led Indian companies tend to have communication cultures that mirror the founder. If the CEO writes in plain, short English on LinkedIn, their CXOs do too. If the CEO uses jargon, the org does. If the CEO is sarcastic, the org is. The CEO also tends to hire people who communicate the way they do, which compounds this over time.

**Operational use:** when researching a senior prospect at a founder-led company, also pull the CEO's last 5 LinkedIn posts. Match the subject line tone to the CEO's tone, not the SDR's natural tone. The buyer reads it as "feels like someone from our world."

This applies most strongly at companies under 500 employees and weakens for listed / PE-owned firms with established corporate communication standards. For listed companies, look at the CMO's or Head of Comms' public writing instead, since they shape external-facing tone more than the CEO.

### The "internal email" pattern (the strongest-converting shape)

The strongest-converting Indian cold subject in 2026 is one that looks like it could have come from a colleague's internal note. NOT a vendor pitch.

Patterns that achieve this:
- Reference a specific page/flow in lowercase: `your size guide`
- Reference a metric with no preamble: `your kyc step`
- Reference a competitor or stack tool with no preamble: `your razorpay step`
- Use a question fragment without question mark: `your demo form`
- Reference a specific number from their site: `your 24 skus`

Patterns that break this (read as vendor instantly):
- Capitalised words ("Your Size Guide")
- Adjectives in the subject ("a quick observation on your...")
- Em dashes or punctuation
- Anything with "we", "I", "our team", "our platform"
- Subjects with the seller's product name in them
- Subjects that imply a sale ("partnership," "demo," "intro")

### Workflow integration

When the lead list is finalised (after exclusion dedupe and scoring):

1. **Tier A — top 20% of leads:** Research the prospect's LinkedIn (90 days), one podcast/talk if available, and the CEO's LinkedIn for founder-led companies. 5-7 min per lead. Custom subject reflects their actual vocabulary and the CEO mirror.
2. **Tier B — middle 50%:** Use the persona archetype + stage + industry defaults from the tables above. 1-2 min per lead. Subject is a default for that archetype.
3. **Tier C — long-tail 30%:** Use the role × segment × stage default subject template only. 30 sec per lead. Skip the persona research.

Track every subject sent in the outcomes CSV (next section) so the self-learning loop can identify which patterns work for which archetype over time.

## Per-segment quick-reference (extend per engagement)

This is a starter library. Build a fresh one per client by scraping their case studies + customer pages.

| Segment | Common observable problems | Real-customer social proof to cite |
|---|---|---|
| D2C-Apparel | size guide depth, fabric/care below fold, PDP image stack, mobile checkout fields | Andaaz Fashion (125% lift), Attrangi (50% lift), Utsav Fashion |
| D2C-Beauty/Wellness | bundle vs single-SKU PDP, ingredients page depth, subscription CTA placement | Amway, "Indian D2C beauty brands at your stage" |
| Ecom Marketplace | category page density, COD-confirmation modal, cart-to-checkout drop | eBay, BigBasket, Yuppiechef |
| Fintech-Lending | KYC field count, document upload, single-use-case homepage | PayU, "Indian fintech players" |
| BFSI/Insurance/Banking | quote-page form length, hospital vs insurer messaging, lead-form persona collision | HDFC ERGO (47% CPA drop), ICICI Lombard (44% lift), HDFC Bank |
| EdTech | fee section placement, EMI calculator depth, free-to-paid step | Online Manipal, UNext |
| SaaS B2B | demo form fields, pricing depth, industry-specific landing page absence | POSist/Restroworks (52% demo lift), PayScale |
| Health Diagnostics / Hospitals | lead form for B2B vs B2C, treatment page tone, trust signals placement | "Indian healthtech brands" |
| Travel/Mobility | search-form date defaults, COD vs prepay messaging, route-page density | Virgin Holidays, Billund Airport (49.85% click lift) |

## Prospect list exclusions (strict — apply BEFORE scoring or enrichment)

This is a hard gate, not a soft preference. Before any scoring, enrichment, observation research, or stakeholder lookup, the raw prospect list MUST be filtered against the full exclusion universe below. A prospect that matches ANY source is removed completely. No "soft-flag", no "deprioritise", no "save for later" — remove from the list. Running this dedupe AFTER scoring wastes Apollo credits and Tavily searches; run it FIRST.

### The six exclusion sources (every campaign, every time)

1. **DNC list (Do-Not-Contact)** — companies the seller has explicitly flagged as off-limits, regardless of reason (legal, reputational, relationship, prior bad fit). The seller-maintained DNC tab/sheet is canonical. Pull a fresh copy at the start of every campaign.

2. **Active customer list** — every company currently paying the seller. Sourced from the seller's CRM/billing system (not a stale spreadsheet). Refresh per campaign.

3. **Past-meeting list (last 12 months)** — every company the seller has had a sales meeting, demo, discovery call, or active sales conversation with in the last 12 months, regardless of outcome (won, lost, ghosted, paused). Sourced from the seller's CRM activity log. A "lost 9 months ago" is still off-limits — the buying committee remembers.

4. **Case study / testimonial customers** — every company named in a published case study, success story, testimonial, quote, or featured customer page on the seller's website, deck, or marketing materials. These are de facto current or recent customers. Reaching out to them as new prospects signals the SDR team and CS team don't talk and is relationship-damaging.

5. **Customer logos on the seller's website** — every brand whose logo appears on the seller's homepage, "Customers" page, "Trusted by" strip, footer, pitch deck, or any marketing collateral. Even if not in the active customer list (e.g., an expired logo-only deal, a pilot, or a marquee logo for credibility), a public logo on the seller's site implies a public association the seller does not want to undermine with cold outbound.

6. **Group / parent / sister brand affiliates (the holding-company rule)** — for every company captured in sources 1–5, identify the parent/holding company and exclude ALL known sister brands under that parent. Indian conglomerates and house-of-brands D2Cs make this critical: a single brand-level exclusion often implies five to fifteen sister brands that ALSO must be excluded. Skipping this step is the single most common reason cold outbound damages an existing client relationship.

### How to apply the holding-company rule (source 6)

For every entry in sources 1–5, run a parent-and-sister-brand lookup before finalising the exclusion list:

1. **Direct check** — visit the brand's own website "About Us" / "Our Brands" / "Group Companies" / "Corporate" page. Most Indian house-of-brands disclose their portfolio openly.
2. **Tavily search** — `"<brand name>" parent company` and `"<brand name>" group of companies` and `"<brand name>" owned by`.
3. **Reverse lookup** — once the parent is identified, search `"<parent name>" brands` or `"<parent name>" portfolio` to enumerate ALL sister brands. This catches recently acquired brands and quiet sub-labels.
4. **Append everything** — add the parent company, every sister brand, every recently acquired sub-label, and any joint-venture brand to the exclusion list.

### Worked example — apparel (the user-given case)

If the seller's customer list includes **Arrow (India)**, the parent is **Arvind Fashions Ltd** — therefore also exclude U.S. Polo Assn., Calvin Klein, Tommy Hilfiger, and Flying Machine, plus Hanes (innerwear), Cole Haan (footwear), and NNNOW.com — all part of the Arvind Fashions portfolio.

If the seller's customer list includes **Rare Rabbit** OR **Rareism**, the parent is **The House of Rare** (under Radhamani Textiles) — therefore also exclude Rare Rabbit, Rareism, and Rare Ones, plus Rare'Z, and any future House of Rare label. If House of Rare or Rare Rabbit appears as a customer, then Rareism is OUT — and vice versa.

### Worked example — D2C beauty / wellness

If "Mamaearth" is a customer, also exclude The Derma Co, Aqualogica, Dr. Sheth's, Ayuga, BBlunt (all under Honasa Consumer Ltd). Verify the current portfolio per campaign — Honasa acquires aggressively.

If "MyGlamm" is a customer, also exclude POPxo, MissMalini, ScoopWhoop, BabyChakra, The Moms Co, Sirona, Organic Harvest, St.Botanica (Good Glamm Group). Same caveat — verify per campaign.

### Worked example — fintech / SaaS

If "Razorpay" is a customer, also exclude RazorpayX, Razorpay Capital, Curlec (Malaysia entity), and any Razorpay sub-product brand. Same buying committee, same conflict.

If "Zoho" is a customer, the entire Zoho Corp portfolio (Zoho One, Zoho CRM, ManageEngine, Qntrl, etc.) is off-limits as net-new outbound — cross-sell is a CS motion, not an SDR one.

### Indian conglomerate quick-reference (illustrative — verify per campaign)

This is a starter table. Brand portfolios change monthly in Indian D2C and fashion through M&A and spin-offs. Always verify against the parent's current "Our Brands" page.

| Parent / Holding | Sister brands (partial — verify before excluding) |
|---|---|
| Arvind Fashions Ltd | Arrow, U.S. Polo Assn., Calvin Klein, Tommy Hilfiger, Flying Machine, Hanes, Cole Haan, NNNOW |
| Aditya Birla Fashion & Retail (ABFRL) | Pantaloons, Van Heusen, Allen Solly, Louis Philippe, Peter England, Reebok (India), Forever 21 (India), American Eagle (India), Sabyasachi, Tarun Tahiliani, Shantnu & Nikhil, House of Masaba, plus TMRW D2C portfolio |
| The House of Rare (Radhamani Textiles) | Rare Rabbit, Rareism, Rare Ones, Rare'Z |
| Reliance Retail / Reliance Brands | AJIO, Reliance Trends, Smart Bazaar, Hamleys, JioMart, Reliance Digital, plus international licenses (Tiffany, Steve Madden, Diesel, Superdry India, etc.) |
| Trent (Tata) | Westside, Zudio, Star Bazaar, Utsa, Misbu, Samoh |
| Tata Digital / Tata Consumer | BigBasket, 1mg, Croma, Tata Neu, Tata CLiQ, Tanishq, Mia, CaratLane, Titan, Fastrack |
| Honasa Consumer | Mamaearth, The Derma Co, Aqualogica, Dr. Sheth's, Ayuga, BBlunt |
| Good Glamm Group | MyGlamm, POPxo, MissMalini, ScoopWhoop, BabyChakra, The Moms Co, Sirona, Organic Harvest, St.Botanica |
| Nykaa (FSN E-Commerce) | Nykaa, Nykaa Fashion, Nykaa Man, Dot & Key, Kay Beauty, Nudge Wellness |
| Marico | Saffola, Parachute, Livon, Set Wet, Beardo, Just Herbs, Plix, True Elements |
| Mahindra Group | M&M, Tech Mahindra, Mahindra Finance, Mahindra Lifespaces, Mahindra Logistics, Mahindra Holidays |
| Larsen & Toubro | L&T, LTIMindtree, L&T Finance, L&T Technology Services, L&T Realty |
| Adani Group | Adani Enterprises, Adani Ports, Adani Power, Adani Green, Adani Wilmar, AdaniConneX |
| Zomato | Zomato, Blinkit, Hyperpure, District (formerly Zomato Live) |
| Swiggy | Swiggy, Instamart, Swiggy Genie, Dineout, Minis |
| Razorpay | Razorpay, RazorpayX, Razorpay Capital, Curlec |
| Zoho Corp | Zoho One, Zoho CRM, ManageEngine, Qntrl, Site24x7, WorkDrive |

### Practical workflow (how to dedupe against all six sources in one pass)

1. Pull raw lead list with N = roughly 3× the final pilot size, to absorb attrition from filtering.
2. From the seller, in one sweep, pull: (a) DNC list, (b) active customer list, (c) past-12-month meetings list, (d) every company named in case studies, (e) every brand whose logo is on the seller's website. Combine into a single CSV called `exclusion_universe.csv` with one column `company_name_normalized`.
3. Normalize: lowercase, trim whitespace, strip suffixes (`pvt ltd`, `private limited`, `inc`, `india`, `.com`, `.co.in`).
4. For each row in `exclusion_universe.csv`, run the parent-and-sister-brand lookup (steps 1–4 of the holding-company rule above). Append all parents and sister brands as new rows in `exclusion_universe.csv`. The list typically grows 2–5× after this step.
5. Normalize the prospect list (same lowercase + strip + suffix removal) into a column `prospect_name_normalized`.
6. Inner-join to remove every prospect whose normalized name OR domain root OR known parent matches any row in `exclusion_universe.csv`.
7. **Spot-check 10 random survivors** from the cleaned prospect list: for each, do a 30-second sanity search (`"<brand>" parent company` on Tavily) to confirm none belongs to a holding already excluded. If even one slips through, the exclusion universe was incomplete — refresh and re-run.
8. ONLY after this dedupe is complete does scoring/enrichment begin.

### Edge cases to watch

- **Same brand name, different parent in different geographies** — "Arrow" the apparel brand (Arvind Fashions in India, PVH globally) versus "Arrow Electronics" (component distribution) are unrelated. Always confirm segment + parent before excluding or NOT excluding.
- **Recently acquired brands** — if the seller's customer list is older than 3 months, run a fresh M&A check on each customer. A brand independent at contract time may now sit inside a holding the seller is also targeting.
- **Joint ventures / minority stakes** — if the parent owns 51%+ of a brand, treat as same. If <50%, judgment call — bias toward exclusion if the buying committee overlaps (same CXOs, shared support functions).
- **Indian "house of brands" D2C plays** — Honasa, Good Glamm, Nykaa, Marico, ABFRL/TMRW are aggressive acquirers. Always re-verify their portfolios per campaign.
- **Rebrands and spin-offs** — the customer the seller signed two years ago may have rebranded or spun out. Reconcile against the seller's CRM; if unclear, ask the seller before excluding.
- **Group company employees changing brands** — if a known champion at Brand A (Arvind portfolio) has just moved to Brand B (also Arvind portfolio), the relationship moved with them. Treat as same exclusion.

### Why this matters (the relationship cost of getting this wrong)

A cold email to an active customer's sister brand reads, to that buying committee, as one of three things:

1. The seller doesn't know who their own customers are.
2. The seller's sales and CS teams don't talk to each other.
3. The seller is trying to backdoor-sell into a parent account by pinging a different brand they think the parent doesn't notice.

All three are relationship-damaging. None are recoverable with a "sorry, list error" reply — the email already sat in three inboxes by the time the SDR catches it. Treat the exclusion dedupe as a hard production gate, equivalent in seriousness to a SPF/DKIM check.

## Compliance gates (must pass before send, every campaign)

1. RFC 8058 List-Unsubscribe header live in Smartlead
2. SPF, DKIM, DMARC live on the sender domain
3. Domain warmed for 14+ days (Smartlead's warm-up tool active)
4. Max 30 sends/day per mailbox in cold ramp
5. Bounce rate <3% over rolling 24h or auto-pause
6. Spam complaint rate <0.1% — above this is a domain-burning emergency, stop and investigate
7. Pre-flight test with Mail-Tester, target 9+/10
8. **Full prospect list exclusions applied** (see "Prospect list exclusions" section above): DNC list, active customer list, past-12-month meetings, case study customers, website logo customers, AND all parent/sister brands of the above. Spot-check on 10 random survivors passed.

## When using this skill on a new client

1. Read this SKILL.md.
2. Pull the seller's customer roster from their website (case studies, customer page, success stories). Build a per-segment social-proof table specific to them. Don't reuse another client's roster.
3. **Apply the full prospect list exclusion routine** (see "Prospect list exclusions" section). This is six sources, not three: DNC list, active customer list, past-12-month meetings, case study customers, website-logo customers, AND the parent/sister-brand expansion for every name in the above five sources. Run this dedupe BEFORE scoring/enrichment, never after — running after wastes Apollo and Tavily credits on prospects you'll throw out.
4. Score the eligible pool against the seller's actual ICP (sourced from past won deals, not their stated ICP). Pick top 50.
5. Find stakeholders via Apollo (Champion priority).
6. **Tier the surviving leads A/B/C** based on score (top 20% / middle 50% / long-tail 30%). Tier A gets persona research per the Persona-tailored subject lines section. Tier B gets archetype defaults. Tier C gets role × segment × stage defaults.
7. For each lead, produce 3 emails (body_1, body_2, body_3) following all 12 rules, with the subject line calibrated to the lead's persona archetype + stage + age cohort.
8. **Pre-populate the `campaign_outcomes.csv` row for every lead** with firmographic + persona + content features (segment, stage, employee_band, funding_round, founder_led, role, role_seniority, role_tenure_months, age_cohort, score, observation_angle, subject_pattern, persona_archetype, tier_abc). This is what the self-learning loop will retrofit sentiment/reason data onto after replies come in. Skipping this step kills the learning loop for that campaign.
9. Run the validation checklist programmatically.
10. Hand 5 sample sequences to a human reviewer for tone/brand fit before sending the rest.
11. Configure Smartlead 3-step sequence with 3-day and 7-day gaps, stop on reply.
12. After 200 sends, measure: open rate target 45–60%, reply rate target 3–6%, positive reply rate (of replies) target 20–30%. If reply rate <2%, stop and re-examine the observation quality before continuing.
13. Run the self-learning loop (see Self-learning loop section) at every campaign close. ICP, scoring, observation library, subject patterns, and exclusion universe ALL get updated based on what the campaign data showed. Produce the campaign postmortem for the client.

## Self-learning loop (closing the feedback cycle across campaigns)

This skill is most valuable when it gets sharper with each campaign, not just consistent. Every reply (positive, negative, neutral, no-response) is a data point that should feed back into:

1. The ICP definition (who to target)
2. The scoring model (which features predict positive replies)
3. The observation library (which CRO angle converts per segment)
4. The subject-line library (which patterns get opened per persona archetype)
5. The exclusion universe (new DNCs, meeting-list additions, customer additions)

Without this loop, run-to-run performance plateaus. With it, by campaign 4-5, the same SDR effort books 2-3x more meetings for the same client. This is how the system compounds.

### Reply taxonomy (classify every reply within 24h of receipt)

Tag every reply on three dimensions. This classification is the foundation of every refinement loop below — it has to be done carefully, not lazily.

**Sentiment:**
- `positive` — agrees to a meeting, asks substantive question, requests deck/case study, asks for pricing
- `interested-not-now` — acknowledges relevance, asks to circle back at a specific or vague future time
- `neutral` — auto-reply (OOO, holiday), forwarded internally with no decision, simple acknowledgement
- `negative-soft` — "not a fit right now," "we're already using X," polite no
- `negative-hard` — angry, asks to be removed, complains about the email, threatens
- `bounce` — invalid email
- `no-reply` — silence after step 3 (treat as a weak negative signal, not nothing)

**Reason (for negatives, including soft):**
- `wrong-icp` — they're not in the seller's segment
- `wrong-stage` — too early or too late for the product (sub-100-employee SaaS pitched to enterprise tooling)
- `competing-vendor` — using an alternative
- `internal-build` — built in-house
- `bad-timing` — budget freeze, leadership change, recent layoffs, pre-IPO quiet period
- `bad-targeting` — wrong person at the right company (e.g., emailed CFO when CMO was the buyer)
- `tone-mismatch` — email felt off, vendor-coded, too pushy, too casual

**Persona signal (free-text 1-2 lines):**
- A short note on what the prospect actually said, in their words. Used later for pattern-mining (see Loop 4).
- Example: "asked if we work with PE-backed mid-market only" or "said our subject felt like a vendor pitch despite content being good"

### Storage schema

Maintain a `campaign_outcomes.csv` per client, appended to after every campaign:

```
campaign_id, lead_id, email, company, segment, stage, employee_band,
funding_round, founder_led, role, role_seniority, role_tenure_months, age_cohort,
score, observation_angle, subject_pattern, persona_archetype, tier_abc,
sent_at, opened, replied, step_replied_on, days_to_reply,
sentiment, reason, persona_signal
```

This is the single source of truth for learning. Don't rely on Smartlead's UI for analysis — export weekly into this CSV. Reply tagging is done by a human (the SDR or AE who handles the reply), not by an LLM at first; the human-tagged data is what the system learns from.

After ~500 outcomes are tagged, an LLM classifier can be trained on the human-tagged data to do tier-1 auto-tagging, with humans reviewing only the ambiguous middle.

### Refinement loops (run after every 200 sends OR every campaign close, whichever first)

#### Loop 1: ICP refinement

For every `positive` and `interested-not-now` reply, extract the firmographic and persona features (segment, stage, employee band, role, company age, funding round, founder-led vs not). Compare against the same features from `negative-hard` and `bad-targeting` replies.

Where positives cluster on a feature value and negatives cluster on a different value, that's a signal to tighten the ICP.

Examples:
- Positives concentrated at 50-200 employee D2C, negatives at 500+: ICP narrows to mid-market D2C
- Positives concentrated in roles "Head of Growth" and "VP Marketing," negatives in "CMO": de-prioritise CMO seniority, target one level down
- Positives concentrated at Series A/B, negatives at seed and Series C+: narrow to Series A-B
- Positives concentrated at founder-led companies, negatives at PE-owned: drop PE-owned from list

Document every ICP change in an `icp_changelog.md` per client with the date, the data behind the change, and a rollback condition. Never silently retune — future operators need to understand why a rule exists.

**Minimum data threshold:** don't change the ICP until at least 20 sentiment-tagged replies exist (positive + negative combined). Earlier than that, the noise is too high and you're chasing variance.

#### Loop 2: Scoring model refinement

If using a deterministic score (segment fit + stage fit + role fit + signal fit), reweight features quarterly based on what predicts positive reply.

**Simple approach** (works for most clients, no ML needed):
- For each feature, compute reply rate of positives among prospects with that feature value
- Reweight features so highest-reply-rate features get higher score weight
- Drop features whose correlation with positive reply is under 0.05 — they're noise

**Advanced approach** (only for clients with 1000+ outcomes logged):
- Train a simple logistic regression with features → P(positive reply)
- Use predicted probabilities as the new score
- Cross-validate on a held-out 20% to avoid overfit
- Re-train quarterly, never on every campaign (overfits to recent variance)

**Minimum data threshold:** 100 sentiment-tagged outcomes before retuning weights. 1000+ before training a model. Below 100, just track and don't change.

#### Loop 3: Observation angle refinement

For each `segment × observation_angle` combination, compute the positive reply rate. Promote winning angles into the per-segment quick-reference. Demote losing ones.

Example: for D2C apparel, if "size guide depth" angle gets a 8% positive reply rate and "PDP image stack" gets 2%, future D2C apparel campaigns should lead body 1 with size guide depth, not image stack. PDP image stack moves to body 2 or gets dropped.

The per-segment quick-reference table in this skill is updated **per-client** based on what works for that client, even if the same skill is reused across clients. Each client gets their own observation library that diverges from the starter table over time.

**Minimum data threshold:** 30 sends per `segment × angle` cell before drawing conclusions. Below 30, the cell is provisional.

#### Loop 4: Subject-line pattern refinement (per persona archetype)

For each `persona archetype × subject pattern` combination, compute open rate AND positive reply rate. Open rate alone isn't enough — a misleading subject can spike opens but tank replies. Track them jointly.

| Open rate | Positive reply rate | Action |
|---|---|---|
| High | High | Winner — promote, use more often for this archetype |
| High | Low | Misleading subject — demote, retire |
| Low | (low N) | Skip — can't tell, keep testing |
| Medium | Medium | Hold — keep in rotation |

Within each persona archetype, maintain a top-3 list of subject patterns ranked by composite score (open × positive_reply). Rotate which is used per campaign to avoid pattern fatigue with repeated buyers in the same vertical.

The persona archetype tables in this skill are updated **per client** as data accumulates. After 6-12 months, each client's subject library diverges materially from the starter library — and that divergence IS the value of the system.

**Open rate caveat:** Apple Mail Privacy Protection inflates open rates. Treat opens as a soft signal, positive replies as the hard signal. If a client's audience is heavily Apple-mail, weigh reply rate 3x higher than open rate in the composite score.

#### Loop 5: Exclusion universe maintenance

After every campaign, automatically append:

- Any prospect who replied with `negative-hard` → DNC list (permanent)
- Any prospect who replied with `negative-soft` and "remove me" language → DNC list (permanent)
- Any prospect who replied with `interested-not-now` and a date → calendared follow-up at that date, NOT in the next campaign's net-new outbound
- Any prospect who agreed to a meeting → past-meeting list (12-month cooldown from meeting date)
- Any prospect who became a paying customer → active customer list, plus parent/sister-brand expansion (per the Prospect list exclusions section)
- Any prospect who said "I left this company" → update enrichment, recheck eligibility at the new company

These updates flow back into the prospect-list-exclusions section of this skill so the next campaign automatically respects them. This loop must be automated, not relied on memory — humans forget within 2 campaigns.

#### Loop 6: Persona research feedback

For Tier A prospects who replied positively, capture in the outcomes CSV: did the custom subject (from the CEO mirror or LinkedIn-matched vocabulary) outperform the default for that archetype?

If yes for 5+ Tier A wins, the Tier A research investment is paying off — keep doing it.
If no after 20+ Tier A sends, the research isn't beating the default — reduce Tier A research time or change the research vectors.

This loop validates the cost of the Tier A 5-7 min/lead investment quarterly.

### Decay (keep learnings fresh)

The Indian B2B market shifts quickly. Specific decay rules:

- **ICP and scoring learnings older than 12 months:** downweighted by 50% in the model
- **ICP and scoring learnings older than 24 months:** dropped entirely
- **Subject-line patterns older than 6 months:** re-tested before being relied on (buyer fatigue is real, especially in concentrated verticals like Indian D2C and SaaS)
- **Observation angles older than 12 months:** re-validated against fresh data before staying in the top-3

Per quarter, run a "stale learning audit": flag any rule, pattern, or weight that hasn't been validated by data in the last 6 months. Either re-validate or drop.

### Periodic review cadence

| Frequency | What runs |
|---|---|
| Weekly (during active campaigns) | Classify replies, append to outcomes CSV. No model changes. |
| After every 200 sends | Loops 3 and 4 (observation angles + subject patterns) |
| Per campaign close | Loops 1, 2, 5, 6 (ICP, scoring, exclusions, persona research ROI) |
| Quarterly | Decay audit, full ICP redefinition if positive reply rate has shifted >2pp from baseline |
| Annually | Rebuild the persona archetype tables from fresh research; assumptions about how Indian CXOs read email won't be the same in 2027 as 2026 |

### What NOT to do

- **Don't retune after one negative reply** — n=1 is noise, not signal
- **Don't drop the entire ICP because two campaigns underperformed** — first check list quality, sender domain warmup, day-of-week timing, and seasonal effects (Indian B2B reply rates drop 30-50% during Diwali week and the last 10 days of any quarter)
- **Don't trust open rates alone** — opens are easily inflated by image-loading bots and Apple Mail Privacy Protection
- **Don't let learnings drift silently** — every change goes into the changelog with the data behind it, so future operators understand why a rule exists
- **Don't reuse one client's ICP for another** — each client's positive-reply patterns are theirs, even within the same vertical. A SaaS client and a SaaS client can have entirely different winning ICPs.
- **Don't classify replies with an LLM at the start** — until 500+ human-tagged outcomes exist, classification accuracy matters more than speed. Bad tags poison every loop.

### Campaign postmortem (the deliverable)

After every campaign, generate a one-page `campaign_postmortem.md` per client containing:

1. Sends, opens, replies, positive replies, meetings booked, conversion at each stage
2. Top 3 winning observations (segment + angle + reply rate, with sample size)
3. Top 3 winning subject patterns per persona archetype (with open and reply rates)
4. Top 3 ICP signals that predicted positive reply (with effect size)
5. Anything that broke (high bounce, spam complaint, deliverability dip, etc.)
6. Recommended changes for the next campaign (with the data each recommendation rests on)
7. Open questions where data is too thin to decide

Hand this to the client at every cycle close. It demonstrates the system is improving, gives them data to push back if recommended changes don't match their gut, and protects against the perception that "the SDR team is just sending more emails." The postmortem IS the product the client is paying for, alongside the meetings.

## Iteration history (so future runs know what was tried and rejected)

- **v1 (rejected):** US-playbook subjects ("Quick question, X"), single-touch, no spintax, generic copy. Buyer feedback: too American, too obvious AI.
- **v2 (rejected):** wrong source list (used DNC tab instead of accounts list).
- **v3 (rejected):** spintax-heavy, greeting + sign-off in body, 50–80 word bodies. Buyer feedback: spintax unnecessary when content is unique; salutation/sig should live in Smartlead variables not in CSV body.
- **v4 (rejected):** unique subjects per prospect (5–7 words), 120–150 word bodies, no spintax. Buyer feedback: news/funding openers feel AI-generated; subjects too long; bodies covered 2+ problems each.
- **v5 (accepted, draft):** 3-step sequences, 3–4 word subjects, observation-based openers, ≤120 word bodies, one problem per body. Buyer feedback: now needs paragraph formatting and em-dash removal.
- **v6 (final, sendable):** v5 + paragraph formatting + em dashes removed.
- **v7 (current):** v6 + strict prospect list exclusions section added. Six exclusion sources: DNC, active customers, past-12-month meetings, case study customers, website-logo customers, and the holding-company / sister-brand expansion. Triggered by a near-miss where a campaign almost contacted a sister brand of an active customer (House of Rare's Rareism while Rare Rabbit was an active client; Arvind Fashions' Arrow while Flying Machine was an active client). The dedupe now runs BEFORE scoring/enrichment, not after, and includes a 10-row spot-check on survivors.
- **v8 (current):** v7 + two major additions. (a) Persona-tailored subject lines: subject wording now varies by persona archetype (founder, CMO, PM, CTO, CFO, HR, Ops, Sales), company stage, age cohort, industry, role tenure, and the CEO mirror hypothesis (founder-led companies inherit the CEO's communication style). Adds a Tier A/B/C research model: 5-7 min on top 20% of leads, defaults for the rest. (b) Self-learning loop: every reply tagged with sentiment + reason + persona signal, appended to a per-client `campaign_outcomes.csv`. Six refinement loops run on cadence (ICP, scoring, observation angles, subject patterns, exclusion universe, persona research ROI) with explicit minimum data thresholds and decay rules. Output is a per-campaign postmortem given to the client. Goal: by campaign 4-5, same SDR effort books 2-3x more meetings as the system compounds.

## Common failure modes

- **Reverting to news/funding openers when research is thin** → use category-level patterns instead
- **Inflating word count with filler when bodies feel short** → keep them short, tighter is better
- **Spintax creeping back in for "deliverability"** → unique content is its own deliverability variation
- **Using em dash because it "reads cleaner"** → it doesn't to a human, it just signals AI
- **Naming the wrong customer in social proof** (one that's actually in the prospect list) → always cross-check
- **Quoting an invented metric** because the case study didn't have one → use a generic phrase instead, never invent
- **Contacting a sister brand of an active customer** (e.g., emailing Rareism when Rare Rabbit is a client, or Flying Machine when Arrow is a client) → run the holding-company expansion in the exclusion universe BEFORE scoring, not after
- **Treating "case study customer" as different from "active customer"** for exclusion purposes → both are off-limits. So is anyone whose logo is on the seller's website. So is anyone the seller had a sales meeting with in the last 12 months.
- **Refreshing the customer list once and assuming it's still current** → Indian D2C M&A is fast. A brand that was independent 3 months ago may now sit inside a portfolio you're targeting. Re-pull the customer + parent map every campaign.
- **Using a CMO subject for a CTO** (or any persona-archetype mismatch) → CTOs read terse technical pings, not CRO-coded subjects. Match archetype before sending. Tier B exists precisely so this match isn't skipped on time-pressure.
- **Skipping the CEO mirror research for senior prospects at founder-led companies** → at companies under 500 employees, the CEO's communication style is the dominant cultural variable. Subjects calibrated to it materially outperform defaults. 5 minutes per Tier A lead is the cheapest research investment in this entire skill.
- **Sending without pre-populating the outcomes CSV row** → kills the self-learning loop for that campaign. Retrofitting features after replies come in is error-prone and partial. Pre-populate at send time, every time.
- **Tagging replies inconsistently** (one operator says "negative-soft," another says "wrong-icp" for the same kind of reply) → poisons every refinement loop. Hold a 30-min calibration session every time a new operator starts tagging, with 20 example replies and the correct tags.
- **Retuning the ICP after one bad campaign** → market timing, sender domain dips, Diwali week, quarter-end budget freezes, and leadership transitions all dent reply rates without invalidating the ICP. Always check these confounders BEFORE retuning.
- **Reusing one client's learnings as another's starting point** → same vertical, same role, different winning patterns. Each client's learnings stay with that client.

## Cost / time targets per 50-lead pilot

Apollo credits: ~600 enrichment + ~50 stakeholder = ~650 credits.
Tavily searches: ~26 (one per lead for observation refresh) + ~10 for Tier A persona research (LinkedIn + CEO mirror lookups) + ~10 for parent/sister-brand expansion in the exclusion universe = ~46 total.
Subagent runtime: ~25 min for the linear pipeline (enrich → score → stakeholder → research → draft → format) + ~50-70 min for Tier A persona research on top 10 leads (5-7 min each) = ~75-95 min total.
Human review time: ~30 min on the 5-10 sample emails before mass send + ~20 min per campaign close on reply-tagging calibration and postmortem generation.

After campaign 3-4, the per-campaign cost drops by ~20% as the self-learning loop reduces wasted Apollo credits on prospects who would have been negative-tagged anyway, and as the observation library narrows to known winners (less Tavily research needed). This compounding cost reduction is one of the secondary returns of the learning loop.

## Maintenance and operator handover

Every client engagement maintains four living artefacts that this skill operates on:

1. `exclusion_universe.csv` — the six-source exclusion list, refreshed per campaign
2. `campaign_outcomes.csv` — the append-only learning data, growing over time
3. `icp_changelog.md` — every ICP change with the data behind it
4. `persona_subject_library.md` — per-archetype top-3 subjects for THIS client, diverged from the starter

When an operator (SDR, AE, or analyst) hands off a client to another operator, these four files plus the latest campaign postmortem ARE the handover. Without them, the new operator restarts from scratch and burns 3-4 campaigns of accumulated learnings.
