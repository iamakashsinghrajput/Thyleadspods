---
name: india-cold-email
description: Use this skill for all Thyleads outbound work — drafting B2B cold email campaigns aimed at Indian buyers (D2C founders, growth/marketing/product/HR leaders at Indian SaaS, BFSI, EdTech, Health, Travel, MarTech, HRTech, Series A and Series B companies). India-only geography by design. Triggers include any mention of Indian outbound, India SDR campaign, Smartlead campaign for India, cold emails to Indian companies, campaigns targeting India D2C/Ecom/Fintech/MarTech/HRTech ICP, account scoring or lead scoring for Indian B2B, persona-tailored subject lines for Indian CXOs, ICP refinement from campaign reply data, intent signal scoring (hiring, funding, leadership change, growth, expansion, employee count change), behavioral signals (page changes, pricing updates, careers page deltas), competitive intelligence as buying-window indicator, per-lead signal graph as the unified intelligence layer, signal-to-insight engine with the four-stage pipeline (Signal Collection → Signal Selection → Insight Generation → Email Writing), the deterministic signal selection formula, the signal-to-angle library, timing-aware scoring tied to the Indian fiscal calendar, observation diversity and the three-axis observation model (company-level, lead-level, activity-level), self-learning outbound loops, decisions on which tool to use when (Apollo vs Crustdata vs Coresignal vs Tavily vs Visualping), site-targeted Tavily queries for Indian press and conferences, cold-start campaigns where no TAL or account list exists, building target account lists from scratch, finding decision-makers via Apollo + Sales Nav + Coresignal, contact enrichment waterfalls (Apollo → Hunter → LeadMagic → ZeroBounce), or any task involving the Thyleads Dashboard as the orchestration layer. Produces emails that follow India outbound conventions (subject lines that include the prospect's first name and feel like internal-team communication, attention-catching plain-language first sentences with no marketing jargon, observation-based openers across three axes — company-level / lead-level / activity-level — with batch-level diversity enforcement and signal-graph-driven hook selection via the angle library, 5th-grade reading level English with banned corporate-vocabulary list, conversational warmth and empathy markers tuned for Indian buyer register, average 10-12 word sentences with no US-style staccato, generous mobile-first whitespace with 4-6 paragraphs of 1-3 sentences each, 80-130 word bodies for body 1, three-step sequences with axis rotation, social proof from the seller's roster, generous peer-tone CTAs not vendor imperatives, prose constrained by structured insight briefs not free-form drafting), strict prospect-list exclusions including holding-company sister-brand expansion, a five-layer account scoring model (Fit + Intent + Engagement + Why-Now + Timing/Penalty multipliers) tuned per Thyleads product line (Seed-Series A, Series B, MarTech, HRTech), per-client behavioral watcher infrastructure for prospect and competitor page changes, a per-lead signal graph that consolidates Apollo + Tavily + Coresignal + Crustdata + behavioral signals into one weighted view, tool-intelligence decision trees that pick the minimum tool set per task based on project documents, and a closing-the-loop self-learning system that refines ICP, scoring weights, observation angles, observation axes per persona, signal-to-angle mappings, and subject patterns from each campaign's tagged replies.
---

# India Cold Email — Style, Structure, and Sequence Skill (v12)

## Why this skill exists

Default LLM cold email templates ("Quick question," "Idea for X," "I came across your work") and the funding/news-event opener ("Saw your Series C," "Congrats on the acquisition") underperform with Indian buyers in 2026. Two reasons:

1. **The patterns are recognized as AI-generated.** Indian D2C founders and growth heads see dozens of these per week. News/funding openers in particular have been overused by automated tools since 2024 and signal "this person hasn't actually looked at my product."
2. **They don't answer "why me, why now."** A real prospect wants to know what the sender SAW that made them reach out specifically. Not what they read in the press.

The patterns in this skill are calibrated based on iteration with a real Indian SaaS engagement (VWO outbound pilot) where v1–v4 versions were rejected by the buyer's team and v5/v6 were accepted as ready-to-send.

## Geographic scope: India only (hard constraint)

Thyleads serves the Indian market exclusively. Every campaign assumes Indian-headquartered prospects, the Indian fiscal year (April-March), Indian buying behaviour, Indian holiday calendar, Indian language norms, and Indian compliance frameworks (DPDPA, RBI/SEBI for fintech, IRDAI for insurance). Prospects headquartered outside India are auto-excluded at the scoring layer regardless of any other signal. This is not a tunable preference — it is the operating constraint of the business.

Subsidiaries of foreign parents (Google India, Salesforce India, Microsoft India) are eligible only if the buying decision is made in India for India operations; if the budget owner sits in Singapore, Dublin, or San Francisco, the prospect is out. Default assumption: foreign-parent India subsidiaries are out unless the campaign brief explicitly confirms India-decisioned buying.

This India-only frame influences every other section of this skill — observation libraries, customer roster building, timing windows, persona archetypes, subject patterns, scoring weights, and the self-learning data corpus. Reusing patterns from US/UK outbound playbooks fails reliably enough that we have stopped trying.

## The 12 rules

### 1. Subject line: first-name + 2–4 word observation, internal-team feel

**The format:** `FirstName, [2-4 word observation]`

The prospect's first name must appear in the subject. This is non-negotiable in v8. First name in subject lifts open rate materially in Indian B2B because:

1. It signals the email is personally addressed, not a blast
2. It pattern-matches to internal team emails (a colleague writing to them)
3. It survives the 3-second triage test in a 100-email inbox

**Total subject length:** 3 to 5 words including the first name. ≤32 characters total.

**Capitalization:** First name capitalized normally. The observation that follows is lowercase. Comma separates them.

**Good (v8 patterns):**
- `Danial, MediGence homepage`
- `Vijit, your signup flow`
- `Gaurav, your cart cod`
- `Priya, your kyc step`
- `Rohit, three different visitors`
- `Anjali, your demo form`
- `Karan, your fee section`
- `Sneha, your emi step`

**The internal-team test:** read the subject aloud. Does it sound like how a colleague at the prospect's own company would write to them? Or like an SDR doing volume?

`Danial, MediGence homepage` → sounds like a colleague flagging something
`your homepage hero` → sounds like a vendor pitch

**The curiosity test:** would the recipient open this subject at 11pm on their phone among 80 other unread emails? The subject must spark a "what about my homepage?" or "what three different visitors?" reaction without being clickbait.

**Curiosity sources that work:**
- A specific number ("Danial, three different visitors")
- A specific page or flow ("Vijit, your signup flow")
- A specific tradeoff or tension ("Gaurav, your cart tradeoff")
- A specific element ("Priya, your kyc step")

**Banned:**
- Subject without first name
- "Quick question," "Idea for X," "X — one observation" (US-playbook tells)
- Subjects with `!`
- Subjects with em dashes
- News/funding openers in the subject ("congrats on series c", "saw your acquisition")
- ALL CAPS or Title Case ("Your Size Guide" feels corporate)
- Misleading or clickbait subjects (no fake "Re:" prefix, no false urgency, no implied prior conversation)
- Anything over 5 words or 32 characters
- Generic words that don't reference the prospect's specific surface ("your business", "your company", "your team" — these feel cold)

**For 3-step sequences:** the three subjects connect to three different observations. All three include the first name. None are reused.

**Sequence example (citymall.live, recipient Gaurav):**
- Step 1: `Gaurav, your cart cod`
- Step 2: `Gaurav, your category page`  
- Step 3: `Gaurav, citymall.live` (lighter touch for breakup)

The rule above is the format. For wording calibrated to specific personas (founder vs CMO vs CTO vs CFO), company stage, age cohort, and the CEO mirror hypothesis, see the section "Persona-tailored subject lines" below.

### 2. Opener: observation-based, never news-based

**The first sentence carries the entire email.** If the first sentence doesn't earn the second, nothing else matters — the prospect closes the tab. This is the highest-leverage sentence in the entire campaign.

**The first sentence must do three things at once:**

1. **Be plain-language.** No jargon. Even functional industry terms (`hero`, `CTA`, `CTR`, `aha moment`, `aov`, `ltv`) are off-limits in the FIRST sentence. They can appear later, but the opener must be readable by a smart 12-year-old. The buyer scanning at 11pm on their phone should not have to translate anything to understand the first line.

2. **Spark curiosity.** The reader must finish the first sentence wanting to read the second. Specificity does this — a number, a named element, an unexpected pairing, a tradeoff hinted at. Vague openers ("your homepage stood out") fail; specific openers ("three very different visitors land on your homepage") work.

3. **Be observation-not-diagnosis.** Open with what you SAW, not what's WRONG. "Was on your homepage and noticed three very different visitors landing in the same place" is observation. "Your homepage doesn't segment your visitors well" is diagnosis. Indian buyers respond to observation; diagnosis triggers defensiveness.

**Strong first-line patterns for v8:**
- "Was on [domain] and noticed three very different visitors all landing in the same place."
- "Spent five minutes on [domain]'s checkout, and one moment stood out."
- "[domain]'s [page] has an interesting tradeoff that's probably costing you signups."
- "[N specific items] on [domain] all share the same [thing]."
- "Was looking at how [domain] handles [specific scenario], and a question came up."

**Weak first-line patterns to avoid:**
- "Your homepage stood out" (too vague — what stood out?)
- "Your hero is doing a lot of work" (uses jargon `hero`)
- "I was checking out your website and noticed your X is doing Y" (boring, vendor-coded)
- "Hope you're doing well" (irrelevant filler)
- "Quick question for you" (US-playbook tell)
- "Saw you're hiring" / "Saw your Series B" (news-based, not observation)

**The 5-second test for the first line:** show the email to someone who has never heard of the prospect company. Can they understand the first line in 5 seconds without context? Are they curious enough to read the second line? If both yes → ship it. If either no → rewrite.

The first sentence is short (under 18 words) and concrete. The second sentence expands or pivots. By the third sentence, the reader should know what the email is about.

After the first sentence, lead with a specific OBSERVATION about the prospect's own product, page, funnel, or UX pattern. Not a press release reference.

**Good observation patterns (sentences 2-4 of body 1):**
- "Your size guide on [domain] sits two clicks deep on every PDP, and your fabric/care detail is collapsed under a tab below the fold."
- "On [domain], your KYC step asks for PAN, Aadhaar OTP, bank linkage and a selfie liveness check across four near-back-to-back screens."
- "Your cart shows COD as your default, but your pincode-confirmation modal blocks the cart for nearly 2 seconds on every load."
- "Your category page on [domain] shows 24 SKUs above the mobile fold with a fairly dense grid and small thumbnails."
- "On [domain], your demo form serves both your hospital and your insurer leads with the same set of fields."
- "Your course detail pages put the fee section at the very bottom, after curriculum, faculty, schedule and testimonials."

**Banned opener patterns (never lead with these):**
- "Saw your Series A/B/C/D"
- "Congrats on the [funding round]"
- "Read about your acquisition / new CEO / launch"
- "Noticed you raised"
- "Your recent [news event]"
- Anything that quotes a press release in the first two sentences
- Anything with marketing jargon in the first sentence (`hero`, `CTA`, `CTR`, `aov`, `ltv`, `mau`, `dau`, `nps`)

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
| Body 1 | 80 | 130 | ~110 |
| Body 2 | 70 | 110 | ~90 |
| Body 3 | 45 | 75 | ~60 |

Count rigorously before writing the CSV. The cap is a ceiling, not a target — most good body 1 emails sit around 100-115 words. Going below 80 risks losing the warmth that makes Indian buyers feel addressed, not pitched at. Going above 130 risks losing them on a phone screen.

**Sentence length:**
- Average sentence length: 10-12 words. This is the conversational sweet spot.
- Maximum sentence length: 18 words, and only when listing 3+ items naturally (e.g., "speaking to an international patient seeking treatment, a family member coordinating travel, and a hospital partner").
- Default sentence length: 8-12 words. Long enough to feel like writing, short enough to scan.
- **Avoid 4-6 word staccato.** Strings of "Same headline. Same button. So they leave." read as US-coded punch lines, not Indian conversational tone. Indian buyers find this jarring and salesy.
- Run-on sentences with 3+ clauses joined by "and" / "but" / "so" / "which" → split, but keep enough words in each piece that it sounds like writing, not bullet points.

**Reading-pace target:** the email should read like a thoughtful note from a peer, not a sequence of declarative bullet points. Read aloud — does it sound like you're talking to a colleague, or like you're reading off a slide?

### 5. Paragraph formatting — mobile-first, generous whitespace

Indian buyers read email on phone first, desktop second. Format for the phone screen, but maintain conversational flow.

**The reference style (from a sample real Thyleads email).** Body looks like this on the screen:

```
[Paragraph 1 — opener observation, 1-2 sentences]

[Paragraph 2 — observation expanded with specifics, 2-3 sentences]

[Paragraph 3 — why-it-matters / empathy, 2-3 sentences]

[Paragraph 4 — solution context with social proof, 2-3 sentences]

[Paragraph 5 — CTA, 1-2 sentences]
```

Each paragraph is one block of thought. Blank lines separate them. The eye lands on each idea separately, then moves on.

**Paragraph rules:**
- Each paragraph = 1, 2, or 3 sentences. Three is the cap, not the default.
- Single-sentence paragraphs are fine for the opener and the CTA. Don't force them everywhere.
- Blank line (`\n\n`) between every paragraph — non-negotiable.
- Body 1: 4-6 paragraphs, average ~2 sentences each.
- Body 2: 3-5 paragraphs.
- Body 3: 2-3 paragraphs.

**Vertical-stacked fragments are allowed but used sparingly** — only when listing distinct items that genuinely benefit from visual separation. Don't break a normal flowing sentence into vertical fragments just to add white space.

**The white-space test.** Open the body on a phone screen mentally. Can you see the boundary between every distinct idea? Does each paragraph have visible breathing room above and below? If the body looks like a wall of text, even with 80 words, it has failed. If the body has visible breaks every 2-3 lines on phone width, it has passed.

**The over-fragmenting test.** Read the body aloud. Does it sound like a thoughtful note from a peer? Or like a sequence of bullet points read off a slide? If the second, you've over-fragmented. Trust paragraph rhythm.

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

### 10. Simpler English + conversational warmth (Indian buyer register)

Two halves to this rule. Both matter.

#### Half 1: 5th-grade English (vocabulary discipline)

Could a smart 12-year-old read this email once and understand what it's saying? If no, simplify.

This is the single most-violated rule in cold email. The temptation to sound "professional" produces text that signals "I'm a marketer trying to seem credible," not text that signals "I'm a person who looked at your site." The latter converts; the former gets deleted.

**Banned vocabulary** — replace every instance with the simpler version. These are corporate/SaaS-speak words that immediately mark the email as a vendor pitch.

| Banned | Replace with |
|---|---|
| leverage / leveraging | use |
| optimize / optimization | improve, fix, make better |
| scale / scaling | grow |
| iterate / iteration | try again, test again |
| robust / comprehensive | strong, full, complete (or just delete) |
| strategic / strategically | (delete entirely) |
| operationalize | set up, run |
| implementation / deployment | rollout, setup, launch |
| framework | system, way, approach |
| ecosystem | tools, world (or delete) |
| synergies / synergistic | (delete entirely — never use) |
| alignment | match, fit |
| actionable | (delete) |
| high-impact / best-in-class | big, top, great |
| value proposition | what you do, what you offer |
| go-to-market | GTM (only if truly necessary) |
| vertical / verticals | industry, industries |
| segmentation | groups |
| validated changes | tested tweaks, small tested changes |
| measurable improvements | real lifts, more signups, better numbers |
| heavy dev effort | much dev work, lots of dev time, big engineering work |
| persona-based hero tests | small tweaks to your hero copy, different headlines for different visitors |
| inflection point | turning point |
| compound | stack up, add up |
| cohort | user group (unless it's the prospect's own jargon) |
| compression | less time |
| unparalleled / world-class / game-changing | (delete entirely) |
| delight | make happy (or delete) |
| inquiry rates / signup rates | inquiries, signups |
| holistic | full, complete (or delete) |
| seamless / seamlessly | smooth, easy (or delete) |
| empower / empowering | help, let |
| streamline | simplify, speed up |
| cutting-edge | new |
| state-of-the-art | top, latest (or delete) |
| paradigm | shift, change (or delete) |
| ROI-driven | (delete) |
| at scale | as you grow |
| double-click on | look closely at, dig into |
| circle back | follow up |
| bandwidth | time |

**Jargon banned in the FIRST sentence specifically** (allowed later in the body if needed):

| First-line ban | Why |
|---|---|
| hero / hero copy / hero section | Marketing jargon. Even most CMOs recognise it but it brands the email as a marketing audit, not a peer note. |
| CTA | Industry term. Use "button", "the action they take", or just describe it. |
| CTR / CVR / AOV / LTV / MAU / DAU / NPS | Acronyms force translation. The buyer should not have to decode anything in the first sentence. |
| funnel | Marketing jargon. Use "signup flow", "checkout flow", "the path from X to Y". |
| persona / personas | Marketing jargon. Use "visitor", "buyer", "the people who come to your site". |
| aha moment / activation / north star metric | Product-team jargon. Use plain descriptions. |
| GTM / SDR / AE / ICP | Sales jargon. The reader is not on your sales team. Avoid. |
| vertical | "Industry" is the simpler word. |

These terms can appear later in the body if the buyer's role makes them functional vocabulary (a CMO knows "hero", a CFO doesn't). But never in the first sentence.

Industry terms ARE OK and add credibility AFTER the first sentence, but only the ones the buyer actually uses internally: A/B test, heatmap, PDP, checkout, KYC, signup, demo, EMI, COD, SKU, headline. These are functional vocabulary, not jargon.

**The 5-second test for vocabulary:** if a word made you feel smart when you typed it, delete the word. Cold email is not where you prove you know SaaS vocabulary.

#### Half 2: Conversational warmth — the Indian buyer register

Simpler English alone makes an email punchy. That's not enough. Indian buyers expect warmth, empathy, and peer-to-peer respect. A US-style declarative cold email ("Same headline. Same button. So they leave.") feels jarring, salesy, and impersonal to an Indian CXO. The buyer wants to feel HEARD before being TOLD.

**Lead with empathy, then diagnose.** Acknowledge the difficulty before pointing out the problem.

| US-style (avoid) | Indian conversational (use) |
|---|---|
| "Your hero is broken." | "Your hero is doing a lot of work right now." |
| "The visitor it fits least just leaves." | "Each visitor is there for very different reasons. So that single message likely costs you signups from the personas it fits least." |
| "Fix this with VWO." | "VWO helps Indian healthtech and wellness teams work through this." |
| "Run a test. Lift signups." | "Often it's not a full redesign. Even small, tested tweaks to your hero copy can lift signups for each visitor type." |
| "20-min walkthrough?" | "Would a quick 20-min walkthrough of your signup funnel be useful? Happy to share where small tests could move the needle for your team." |

**Empathy markers that signal "I see this is hard":**
- "Your X is doing a lot of work right now"
- "I imagine balancing X across Y audiences is tricky"
- "There's a real tension here between X and Y"
- "Often this isn't about X, it's about Y" (reframes without diagnosing)
- "Many teams in your space find this hard"

**Hedges that soften assertions** (use them — Indian buyers find unhedged claims aggressive):
- "often" / "tends to" / "usually" / "many teams find"
- "likely" / "probably" / "may"
- "small" / "quick" / "short" (qualifies the ask)
- "would" / "could" / "might" (modal verbs over imperatives)

**Generosity markers in the CTA** (the offer should feel like a peer sharing, not a vendor pushing):
- "Happy to share..."
- "Worth a quick 20-min walkthrough?" (not "Let's set up a call.")
- "Would it be useful to..."
- "If helpful, I can..."
- "Move the needle for your team" (peer language, not "drive results")

**What to avoid (US-style declarative tones):**
- Single-word "Period." or "Exactly." sentences
- "Just leaves." "Game over." "Period." declaratives
- Imperatives without softening ("You need to fix this." "Do a test." "Run this.")
- Confidence without empathy ("Here's what's wrong with your site:")
- Unhedged absolutes ("This always works." "This is the answer.")

**The peer-not-vendor test:** would a senior person in the same role at a peer Indian company write to this prospect this way? If the email sounds like an SDR doing volume, rewrite. If it sounds like a colleague pointing something out over coffee, you're there.

**The "feel heard" test:** does the email show you understand what it's like to be the prospect? If it just diagnoses without acknowledging the difficulty, the prospect feels lectured at. If it shows you understand the trade-offs they're navigating, the prospect feels heard. The second one converts.

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
email, first_name, last_name, company_short, subject_1, body_1, subject_2, body_2, subject_3, body_3, domain, company_full, industry, employees, country, contact_title, score_final, score_bucket, fit_score, intent_score, intent_hiring, intent_leadership, intent_funding, intent_growth, intent_news, intent_techstack, engagement_score, whynow_score, timing_multiplier, penalty_multiplier, composite_multiplier, segment, observation_angle, observation_axis_b1, observation_axis_b2, observation_source_b1, observation_source_b2, observation_signal_age_days, persona_archetype, tier_abc, stage, age_cohort, role_tenure_months, founder_led, lead_id
```

The expanded scoring fields (`fit_score` through `composite_multiplier`) are what Loop 2 (scoring model refinement) reads from. Without the decomposition, the system cannot tell which signal sub-category drove a prediction — it only sees the final score and the outcome, which is too coarse to learn from.

The `observation_angle` column captures what observation body 1 led with — useful for QA and post-campaign learning.

The `observation_axis_b1` and `observation_axis_b2` columns capture which axis was used in body 1 and body 2 respectively: `lead_level` (axis 2), `activity_level` (axis 3), or `company_level` (axis 1). Used by self-learning Loop 3 (observation angle refinement) to identify which axis converts best per persona archetype × segment.

The `observation_source_b1` and `observation_source_b2` columns capture the URL or signal source that the axis 2/3 observation traces to (LinkedIn post URL, podcast URL, press URL, job posting URL). Empty for axis 1 observations. Required for axis 2 and axis 3 observations — unverifiable observations are downgraded.

The `observation_signal_age_days` column captures how old the body 1 observation signal was at send time. Used by Loop 3 to validate whether axis-2 freshness threshold (≤30 days) is calibrated correctly.

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
21. **Scoring breakdown logged:** every prospect carries the full score decomposition (L1 Fit, L2 Intent sub-categories, L3 Engagement, L4 Why-Now, L5 Timing multiplier, L6 Penalty multiplier, composite multiplier, final score, bucket). This is what Loop 2 (scoring model refinement) reads from. Skipping this kills scoring learning.
22. **Geography hard gate:** every prospect's HQ is India OR the prospect is an India-decisioned subsidiary explicitly confirmed in the campaign brief. No exceptions.
23. **Timing window check:** the campaign send window is checked against the Layer 5 fiscal calendar table. Sends scheduled inside Diwali blackout, year-end quiet, or last-3-days-of-quarter are flagged for review or rescheduled. Industry seasonality also checked for D2C apparel (wedding season heads-down) and EdTech (admission season buying spikes).
24. **Penalty trigger check:** any prospect with a known penalty trigger (layoffs, down round, acquisition, PR crisis, recent competitor signing) is multiplied accordingly. Prospects with effective score below 35 after multipliers are dropped from the campaign even if base score was high.
25. **Recency check:** all intent signals fed into scoring are dated and decay-weighted (signals >180 days old contribute 0). No stale signal can promote a prospect into Top Priority.
26. **Sentence length:** average sentence ~10-12 words, no sentence >18 words (and 18 only for natural list-of-items sentences). Run a word-count check programmatically before send.
27. **Banned vocabulary scan:** automated check for the banned-vocabulary list in Rule 10 (leverage, optimize, scale, validated changes, measurable improvements, persona-based hero tests, robust, comprehensive, strategic, synergies, etc.). Any hit fails the body.
28. **Paragraph density:** no paragraph longer than 3 sentences. Most paragraphs 1-2 sentences. Programmatic check.
29. **No-staccato check:** no string of 3+ consecutive sentences ≤6 words each. This pattern reads as US-coded punch lines and breaks Indian conversational tone.
30. **Empathy marker present:** body 1 contains at least one empathy or hedging marker — "doing a lot of work," "tends to," "often," "many teams find," "I imagine," "there's a real tension" — that signals the writer understands the buyer's situation. Without it, the email reads as diagnosis-only.
31. **Generous CTA check:** the CTA is phrased as a peer offer, not a vendor ask. Hits at least one of: "Happy to share," "Would it be useful," "Worth a quick look," "If helpful." Imperatives ("Let's set up a call," "Book time") fail.
32. **Read-aloud test:** read the email aloud before send. Does it sound like a colleague at a peer Indian company writing? Or like a salesperson reading off a script? If script, rewrite.
33. **First name in subject:** every subject line contains the prospect's first name. Subject pattern is `FirstName, [2-4 word observation]`. ≤5 words total, ≤32 chars. No first name = fail, even if the rest is good.
34. **First-line jargon scan:** the first sentence of body 1 contains zero items from the first-line jargon banlist (`hero`, `CTA`, `CTR`, `funnel`, `persona`, `aha moment`, `activation`, `north star`, `GTM`, `SDR`, `AE`, `ICP`, `vertical`). Programmatic check.
35. **First-line attention test:** the first sentence is concrete, specific, and curiosity-sparking. Vague openers ("your homepage stood out", "your site looks great", "I came across your work") fail. The first sentence must earn the second.
36. **Whitespace pattern check:** body has at minimum 4 paragraph breaks (`\n\n`) for body 1, 3 for body 2, 2 for body 3. No paragraph longer than 60 words. Mobile-screen scan-test passes.
37. **Observation axis logged:** every lead's `observation_axis` field in the outcomes CSV is set to `lead_level` (axis 2), `activity_level` (axis 3), or `company_level` (axis 1). The same field captures the source URL or signal that the axis is based on. Without this, the self-learning loop cannot tell which axis converted best per persona.
38. **Observation axis source verifiable:** for every axis 2 or axis 3 observation, a source URL is logged (LinkedIn post URL, podcast URL, press URL, job posting URL). Unverifiable axis 2/3 observations are downgraded to axis 1 before send. No invented signals.
39. **Batch-level observation diversity:** within a 50-lead campaign, no single observation type (e.g., "homepage hero", "checkout COD", "category density") used in more than 30% of leads. No more than 5 consecutive leads (in send order) use the same observation axis. Programmatic check before CSV write.
40. **Sequence-level axis rotation:** within a 3-step sequence per lead, body 1 and body 2 use different observation axes when both are sourceable. If only axis 1 is available, body 2 uses a different surface (different page/flow) than body 1. Body 3 is breakup, no axis required.
41. **Axis-2 freshness check:** if body 1 leads with axis 2 (lead-level observation), the source signal must be ≤30 days old. Older signals are stale and risk being overtaken by newer activity the lead remembers more vividly. Programmatic check on source date.
42. **Signal graph built per lead:** every Tier A and Tier B lead has a `signal_graph.json` artifact with all axis signals, weights, ages, and decay state recorded. The email-drafting step reads from the graph, not from scattered enrichment fields. Without the graph, signals get silently dropped and the email leads with whatever is most prominent in the CSV row, not necessarily the strongest signal.
43. **Signal conflict check:** if the signal graph contains contradictory signals for a lead (e.g., axis 2 "scaling 3x" + axis 3b "careers page added layoff notice"), the lead is held for human review before send. Sending into a conflict reads as "you didn't actually look."
44. **Behavioral watcher coverage:** for any client with active campaigns, behavioral watchers (Visualping or custom crawler) cover the top 100-200 in-pipeline accounts for the standard pages (`/pricing`, `/careers`, `/customers`, `/product`, homepage). Coverage gap is logged per campaign.
45. **Competitive watcher coverage (axis 3c):** for any client whose ICP is competitive-density-sensitive (most B2B SaaS, most D2C), watchers cover the prospect's top 3 competitors as well. Refresh competitor list quarterly.
46. **Four-stage pipeline executed:** every Tier A and Tier B email has a logged Stage 1 (signal_graph), Stage 2 (signal scores + selection rationale), Stage 3 (insight_brief with implication, risk, angle, hook for body 1 and body 2), and Stage 4 (final prose). Skipping stages produces inconsistent output. Each stage's output exists as an artifact.
47. **Signal selection formula applied:** for every lead, the primary_signal_score and secondary_signal_score are computed and logged. Picks where score < 0.30 are flagged or downgraded to Tier C category default. No "the model picked this" without showing the formula output.
48. **Angle library mapping verified:** every body 1 and body 2 has an `angle` value that traces to an entry in the angle library. Custom angles outside the library are flagged for human review (they may be valid; they may be drift).
49. **Insight chain present:** every body 1 has all four chain elements logged (signal, implication, risk, angle, hook). Same for body 2. Missing any element fails the email.
50. **Axis 2 leverage check:** if body 1 leads with axis 2, the email demonstrates the leverage test — removing the LinkedIn-post reference would change what the email says, not just dress it up. Compliments without leverage ("great insights," "loved your point") fail.

## Anatomy of a good body 1 (annotated, ~115 words)

Subject: `Gaurav, your cart cod`

> [Hook — observation in plain language, attention-catching, no jargon]
> Was on citymall.live's checkout this morning, and one moment kept tripping me up.
>
> [Specific observation, 2-3 sentences]
> Your COD-default makes sense for your tier-2/3 buyer. But the pincode-confirmation modal blocks the cart for nearly 2 seconds on every load. On a 5-inch phone with patchy data, those 2 seconds tend to feel like 4.
>
> [Why it matters with empathy + hedging]
> The buyers it hits hardest are often the ones you most want to keep. So the friction probably costs you the most exactly where you can least afford it.
>
> [Test idea + social proof]
> Often this is something a quick test can isolate. Moving the pincode check to checkout step 1 typically lifts cart-to-checkout by 8-15% on tier-2/3 commerce. BigBasket has run similar cart-flow tests with VWO.
>
> [Generous CTA]
> Would a quick 20-min look at your cart flow be useful? Happy to share where small tests could move the needle for your team.

Notice:
- Subject `Gaurav, your cart cod` — first name + 3-word observation, sounds like internal team
- First sentence is plain language: "one moment kept tripping me up" sparks curiosity, no jargon
- 5 paragraphs, average ~2 sentences each, blank line between every paragraph
- Average sentence length ~12 words, max 18
- Empathy markers: "makes sense for your tier-2/3 buyer", "tend to feel like 4", "often the ones you most want to keep", "exactly where you can least afford it"
- Hedges throughout: "often", "typically", "probably", "tend to"
- Generous CTA: "Happy to share", "move the needle"

## Anatomy of a good body 2 (annotated, ~95 words)

Subject: `Gaurav, your category page`

> [Light reference + new observation, plain language]
> One more thing I noticed on citymall.live, this time on the category page.
>
> [Specific observation, 2-3 sentences]
> Your grid shows 24 SKUs above the mobile fold, with fairly small thumbnails. For a first-time tier-2/3 shopper on a 5-inch device, that density tends to scan very differently from how a metro buyer would experience it.
>
> [Test idea + social proof]
> A test reducing the grid to 12 SKUs with bigger thumbnails and clearer price strikes typically lifts category-to-PDP by 15-25%. Yuppiechef saw a 100% conversion lift on a similar grid rework with VWO.
>
> [Soft CTA]
> Happy to share the exact test plan if it would be useful for your category page.

## Anatomy of a good body 3 (annotated, ~55 words)

Subject: `Gaurav, citymall.live`

> [Warm breakup, 1-2 paragraphs]
> Wrapping up here on citymall.live, Gaurav. If cart and category testing isn't a focus right now, completely understand. These things go in cycles.
>
> [Open door + warm close]
> If your tier-2/3 CVR plateaus, or your CAC on new geos starts to climb, my note is here whenever it might be useful. Wishing you and the team a strong scale-up ahead.

## Tool intelligence: Claude as the brain, tools as the hands

This is the section that turns Claude from a copywriter into the orchestrating intelligence of the Thyleads outbound system. Every other section assumes Claude is making smart decisions about which tool to use, when, and why. This section makes those decisions explicit.

### The principle

Claude is not "a copywriter that calls tools." Claude is **the decision layer** that reads project documents to understand the client's product, ICP, and learnings, then decides for each task which tool to reach for, in which sequence, with which inputs, and how to combine outputs. Tools are dumb — they return data. Claude is what makes the data into intelligence.

This means before any account pull, scoring, enrichment, or drafting begins, Claude reads the project knowledge base for:

1. The client's product type and value proposition (e.g., from `why_thyleads.html`, the client's onboarding questionnaire, their case studies)
2. The client's segment positioning (e.g., `Series_B_.html`, `MarTech.html`, `HRTech.html`)
3. The client's active customer list and case study customers (defines what "fit" looks like AND what's excluded)
4. The client's past meetings, DNC list, customer-logo list (exclusions)
5. Prior `campaign_outcomes.csv` for the client (what's worked, what hasn't)
6. The `client_learnings.md` file (qualitative learnings the operator has flagged)
7. The `scoring_rubric.json` for this client (per-product weights, calibrated)

Only after reading these does Claude make tool decisions. Reading the docs IS the work — skipping this step is the single most common reason output feels generic.

### The tool stack at Thyleads (as of 2026-Q2)

| Tool | What it's good at | What it's NOT good at | Cost shape |
|---|---|---|---|
| **Apollo** | Bulk firmographic data, contact mining at scale, departmental headcount, basic intent (Buying Intent filter) | Real-time signals, deep persona-level data, India-specific deep firmographics | Per-credit ($220/mo for 1-2 seats currently) |
| **Crustdata** | India-specific firmographics, hiring velocity, headcount growth trends, tech-stack signals, account-discovery by signal | Person-level depth, exact contact emails | Subscription-based |
| **Coresignal** | LinkedIn person + post data via API (for axis 2 — lead-level observations), strongest India coverage | Anything LinkedIn doesn't expose | Per-credit subscription (~$300-500/mo recommended) |
| **Tavily** | Web research, India press, conferences, blogs, podcasts, public articles, Substack/Medium, Twitter/X (with site-targeting) | LinkedIn (blocked), some paywalled sites | Per-call, generous free tier |
| **LinkedIn Sales Navigator** | Manual stakeholder verification ("does this person still work here?"), persona language sourcing for Tier A research | Bulk anything, programmatic anything | Per-seat |
| **Clay** | Orchestration — connecting Apollo + Coresignal + Crustdata + Hunter + ZeroBounce + signal scoring into one pipeline | Originating signals; it's connective tissue | Subscription |
| **Hunter / LeadMagic** | Email finding fallback when Apollo doesn't return a verified email | Primary contact data | Per-credit |
| **ZeroBounce** | Final email verification before send (last firewall against bounces) | Anything else | Per-credit |
| **Visualping or custom crawler** | Behavioral signals — page/pricing/careers/product changes on prospect domains and on competitor domains (axes 3b, 3c) | Anything that's not a website diff | Per-watcher subscription, or free if custom |
| **Listen Notes** | Podcast metadata API (find appearances by lead) | Transcripts (use Tavily for show notes) | ~$15-50/mo, optional |
| **Tracxn / Inc42 / MoneyControl** | Indian funding, M&A, news. Inc42 is best for D2C, Tracxn for SaaS | Anything outside India | Subscription, but Tavily site-targeting gets ~80% for free |

### Thyleads Dashboard as the orchestration layer

The Thyleads Dashboard is the operational hub. It connects the tool stack via webhooks and stores per-client artifacts (the seven living artefacts listed in Maintenance and operator handover). Claude does not call tools directly from the dashboard — Claude's role is to:

1. **Read the dashboard's project knowledge** (which files are uploaded for this client)
2. **Decide which tools to use and in what sequence** based on the task and the client's documents
3. **Call tools via Claude's MCP integrations** (Apollo MCP, Tavily MCP, Google Drive MCP, etc.)
4. **Write artifacts back to the dashboard** via the per-client storage (signal graphs, outcomes CSV, etc.)
5. **Surface decisions to the operator** for review at the gates defined in the operations playbook

When the operator says "build a campaign for VWO," Claude reads the VWO project knowledge, decides whether a TAL exists or a cold-start is needed, picks tools per the decision trees in this section, executes through MCP integrations, and produces the campaign-ready CSV plus updated artifacts. The dashboard is where everything lives; Claude is what makes the dashboard intelligent.

**What this means for tool selection:** Claude does NOT default to "use every available tool." Claude defaults to "use the minimum set of tools needed to do this task well, given what the project documents say about this client's ICP, learnings, and constraints." Often this means using 2-3 tools instead of 8.

### Project documents reading protocol

Every task begins with reading the project documents. This is not optional — it's the input that turns generic tool decisions into client-specific ones. The reading protocol:

**Tier 1 documents (always read at task start):**

1. The client's onboarding questionnaire / signed ICP brief — defines firmographics, anti-ICP, sweet-spot stage, persona archetypes for THIS client
2. `client_learnings.md` (if it exists) — qualitative learnings the operator has flagged from prior campaigns
3. `scoring_rubric.json` (if it exists) — per-product weights, calibrated per Loop 2 of self-learning
4. The client's case studies and customer-logo export — defines what "fit" looks like AND what's excluded
5. The client's segment doc (e.g., `MarTech.html`, `HRTech.html`, `Series_B_.html`, `Seed-Series_A.html`) — Thyleads's view of how to sell into this segment
6. `why_thyleads.html` or equivalent — Thyleads's positioning across products

**Tier 2 documents (read when task involves their content):**

7. Past `campaign_outcomes.csv` for this client — read when retuning weights, picking observation angles, or validating tier assignments
8. `exclusion_universe.csv` — read when building any prospect list
9. `persona_subject_library.md` — read when drafting subjects
10. Past `campaign_postmortem.md` files — read when planning the next campaign or doing the quarterly audit
11. `signal_graphs/` directory entries for active leads — read when drafting emails

**Tier 3 documents (read on operator request or when relevant):**

12. The Thyleads master `Thyleads_Operations_Playbook_v2.md` — for cross-client operating norms
13. `OUTBOUND_PIPELINE_PLAYBOOK.md` — for technical pipeline details
14. `Thyleads_AI_Agent_Architecture.md` — for the inter-agent contract

**What Claude extracts from each document:**

- From the ICP brief: firmographics + persona archetypes + anti-ICP triggers
- From `client_learnings.md`: which signals worked, which axis converted best per archetype, which subject patterns won
- From `scoring_rubric.json`: per-product layer weights, calibrated multipliers
- From case studies / customer-logo export: the social-proof library AND the exclusion list
- From the segment doc: positioning, common objections, language to mirror
- From past outcomes CSVs: per-feature reply rates, validating which signals predict positives

**The signal these documents send to tool decisions:**

- ICP brief defines which Crustdata/Apollo filters to use
- `client_learnings.md` flags axes/tools that have or haven't worked for THIS client (don't burn Coresignal credits where axis 2 has been validated to underperform)
- `scoring_rubric.json` tells which intent dimension to spend more enrichment on (e.g., a HRTech client's high `intent_growth` weight means more Crustdata calls for headcount data)
- Case studies define the customer roster — both for social proof AND exclusion universe

**When project documents conflict:**

Defer to the most recent operator-signed document (signed ICP brief, latest scoring rubric). If a conflict is material (e.g., the ICP brief says "Series B" but `client_learnings.md` shows Series A converts 2x better for this client), surface it to the operator for decision rather than resolving silently.

### Decision tree: which tool for which task

When asked to do an outbound task, Claude decides between tools based on the task shape, not user request phrasing. The decision tree:

#### Task: "Build me an account list for [client]"

```
Is the client's TAL (Target Account List) already mined and in the dashboard?
├── YES → Skip to scoring step. Use Apollo bulk_enrich on existing list.
└── NO → Build the TAL. Decision tree:
        Is the ICP firmographic-tight (specific industry + employee band + stage)?
        ├── YES → Crustdata for signal-based discovery is faster
        │         (e.g., "Indian D2C apparel, 100-500 employees, raised in last 12 months")
        └── NO → Apollo saved-search filters with the firmographic criteria from the ICP brief

Always: cross-check against exclusion universe BEFORE moving to enrichment
        (DNC, active customers, past meetings, case studies, customer logos, parent/sister brands)
```

#### Task: "Score these accounts"

```
Read scoring_rubric.json for this client (per-product weights from MarTech / HRTech /
Series B / Seed-Series A template, retuned per Loop 2 of self-learning).

For each account, gather signals:
├── Firmographics → Apollo bulk_enrich (run AFTER exclusion dedupe)
├── Hiring velocity → Crustdata (best India coverage)
├── Headcount growth → Crustdata + Apollo's headcount_six_month_growth field
├── Funding → Tracxn / Inc42 search via Tavily (site:inc42.com, site:tracxn.com,
│            site:entrackr.com)
├── Leadership change → Apollo (recently_joined filter) + Crustdata
├── Tech stack → BuiltWith via Clay, OR Apollo's keywords field as proxy
├── Page/pricing changes → Visualping/custom crawler delta log
└── News/awards → Tavily with Indian press site-targeting
                  (site:moneycontrol.com, site:livemint.com, site:economictimes.indiatimes.com,
                   site:yourstory.com, site:inc42.com, site:entrackr.com, site:ken.in)

Apply five-layer model: (Fit + Intent + Engagement + Why-Now) × Timing × Penalty × Composite
Output: scored CSV with full decomposition (per the validation checklist requirements)
```

#### Task: "Find decision-makers for these accounts"

```
For each account in the priority list:
├── Apollo people_search with the persona archetype from the scoring rubric
│   (e.g., for MarTech client: "VP Marketing", "Head of Growth", "CMO")
├── Validate via Apollo's person enrichment for current title + tenure
├── Cross-check via Sales Navigator for "still works here?" — automated where possible,
│   manual for Tier A leads
└── Coresignal lookup for senior contacts where Apollo title data is unclear

Bucket each contact:
├── Champion (most likely to respond, decision influencer)
├── Economic Buyer (signs the contract)
└── Technical Buyer (validates the fit)

Goal: 3-5 stakeholders per account, 95%+ coverage rate.
```

#### Task: "Enrich these contacts for outbound"

```
For each contact:
├── Email finding waterfall: Apollo → Hunter → LeadMagic
├── Email verification: ZeroBounce (drop catch-all and unknown)
├── Clay orchestrates the waterfall and writes back to dashboard
└── Reject any contact whose email comes back unverifiable

For Tier A contacts specifically:
├── Coresignal lookup → last 90 days of LinkedIn posts (axis 2 source)
├── Tavily site-targeted searches for the person's name:
│   ├── site:saasboomi.in OR site:nasscom.in (conferences)
│   ├── site:substack.com OR site:medium.com (articles)
│   ├── site:x.com (Twitter)
│   └── site:ethrworld.com OR site:etbrandequity.com OR site:etcio.com
│       (function-specific Indian press)
├── Listen Notes API search by name (podcast appearances)
└── Build per-lead signal graph JSON aggregating everything with weights and ages
```

#### Task: "Write the email sequence for this lead"

```
Read the lead's signal graph (NOT the scattered CSV columns).

For body 1:
├── Pick the highest-weighted fresh signal (≤30 days old) regardless of axis
├── If signal age > 30 days, downgrade — pick next-strongest fresh signal
├── If no fresh signals exist, default to axis 1 (company-level via Tavily extract on homepage)
└── Apply the persona-archetype subject pattern with first-name personalization

For body 2:
├── Pick a different-axis signal than body 1 used
├── If only one axis available, pick a different surface within axis 1
│   (e.g., body 1 was homepage → body 2 is checkout)

For body 3:
├── Breakup, no observation needed

Apply all 12 rules. Run validation checklist. Log axis decisions to outcomes CSV.
```

### Site-targeted Tavily queries (the India intelligence layer)

When using Tavily for axis 2 (lead-level) or axis 3 (activity-level) research, default to site-targeted queries instead of open web search. Open web returns too much US/global noise; site-targeting returns India-specific, higher-quality matches.

**The standard Indian site-target list:**

```
General B2B press:
  site:inc42.com, site:entrackr.com, site:moneycontrol.com,
  site:economictimes.indiatimes.com, site:livemint.com, site:yourstory.com,
  site:ken.in, site:tech.economictimes.indiatimes.com, site:thearcweb.com

SaaS / startup conferences:
  site:saasboomi.in, site:nasscom.in, site:saastr.com

Function-specific Indian media:
  site:ethrworld.com (HR/CHRO)
  site:etcio.com (CIO/CTO)
  site:etbrandequity.com (CMO/marketing)
  site:etcfo.com (CFO/finance)
  site:etretail.com (retail/D2C)

Lead-level publishing platforms:
  site:substack.com, site:medium.com, site:x.com
```

**Query templates by signal type:**

| Signal sought | Tavily query template |
|---|---|
| Lead's recent thinking on a topic | `"<Lead Name>" <topic-keyword> site:linkedin.com OR site:substack.com OR site:medium.com` |
| Lead's conference appearance | `"<Lead Name>" speaker OR keynote site:saasboomi.in OR site:nasscom.in` |
| Lead's function-specific opinions | `"<Lead Name>" site:etbrandequity.com` (or function-appropriate site) |
| Company funding | `"<Company Name>" funding OR raise OR Series site:inc42.com OR site:entrackr.com OR site:moneycontrol.com` |
| Company product launch | `"<Company Name>" launches OR launched OR unveils site:inc42.com OR site:yourstory.com` |
| Company hiring announcement | `"<Company Name>" hires OR appoints OR hired site:economictimes.indiatimes.com OR site:livemint.com` |
| Industry-specific recent moves | `"<Company Name>" site:etretail.com` (or function/industry-appropriate site) |

**When NOT to use site-targeting:** when looking for the lead's own website (`tavily_extract` on the domain directly), or when looking for global SaaS news that wouldn't be in Indian press.

### Coresignal: when to call it

Coresignal is expensive per-lookup but uniquely valuable. Reserve it for:

1. **Tier A leads only** (top 10-20 leads per campaign). Tier B and Tier C don't justify the cost.
2. **Senior personas** — CXOs, VPs, Heads, Directors. Junior personas (managers, ICs) often don't post enough on LinkedIn to make the lookup worth it.
3. **Founder-led companies under 500 employees** — for the CEO mirror hypothesis lookup (the lead's CEO's last 5 posts to calibrate tone).
4. **When the persona archetype is one Loop 3b has shown axis 2 outperforms for** — e.g., MarTech CMOs (validated to convert 1.8-2.5x better on axis 2 than axis 1). Don't burn credits on Engineering CTOs where axis 1 dominates.

When NOT to use Coresignal:
- Junior IC roles
- Engineering personas (use axis 1 instead)
- Bulk pulls — Coresignal isn't designed for "give me 1000 leads"; that's Apollo + Crustdata
- When budget is tight and the campaign has only 1-2 Tier A leads — use Tavily site-targeted queries instead

### Apollo vs Crustdata: when to use which

These two overlap heavily on firmographics. Decision rules:

**Use Apollo when:**
- Pulling contact data (people, emails, titles)
- Bulk enrichment of an existing domain list
- The ICP is firmographic-defined ("Indian D2C, 100-500, Series A-B")
- You need the buying-intent filter

**Use Crustdata when:**
- Pulling accounts by SIGNAL ("hired 5+ growth marketers in last 90 days," "added a Senior Performance role last month")
- India-specific firmographics where Apollo's coverage is shallow
- Hiring velocity by department over time
- Tech-stack discovery beyond what Apollo's keywords field captures

**Use both when:**
- Building an account universe from scratch — Crustdata for signal-based discovery, Apollo for firmographic enrichment
- Validating a contact's tenure (Apollo's title vs Crustdata's tenure tracking)

### Decision rules: when project documents override defaults

Default tool choices (above) are starting points. Project documents override when:

1. **The client's onboarding questionnaire flags a tool preference** — e.g., "client has Apollo seats already, use those" overrides Crustdata-first discovery.
2. **The client's `client_learnings.md` shows a tool failed for this client** — e.g., "Coresignal axis-2 yielded 0 conversions across 30 Tier A sends" → axis 2 demoted for that client, Coresignal usage dropped.
3. **The campaign brief specifies a constraint** — e.g., "stay within 100 Apollo credits this campaign" → fewer enrichment calls, more Tavily/free-source fallbacks.
4. **The scoring rubric for this client weights a particular intent dimension heavily** — e.g., HRTech client with `intent_growth: 12` weight → spend extra Crustdata calls on headcount-growth signals specifically.

Claude reads these documents at the start of every task and silently incorporates their guidance into tool decisions. The operator should never have to remind Claude to read them.

### Cost-aware tool sequencing (the "do exclusion first" principle)

The single most expensive mistake in the pipeline is enriching prospects who get excluded later. Apollo bulk_enrich at 1 credit per match × 500 matches × wasted on 200 excluded prospects = 200 credits burned. Always:

```
1. Pull raw account universe (Apollo or Crustdata, cheap)
2. Apply six-source exclusion dedupe (free; reads existing lists)
3. ONLY THEN enrich with Apollo (expensive)
4. Score
5. Pick top 50
6. Enrich contacts and run Tavily/Coresignal on top 50 only
```

This sequencing alone saves 30-50% of Apollo credits per campaign. The exclusion dedupe section enforces this; this tool-intelligence section reinforces why.

### When to recommend a tool the client doesn't currently have

Sometimes the right answer is "the current toolstack can't do this well; the client should add X." Claude should flag this rather than producing weak output. Triggers for recommending a tool addition:

- Client wants axis 2 (lead-level) signals, no Coresignal/Proxycurl access → flag Coresignal recommendation with cost estimate
- Client wants behavioral signals (axis 3b), no watcher infrastructure → flag Visualping or custom crawler recommendation
- Client's Apollo coverage on Indian D2C is <60% match rate → flag Crustdata recommendation
- Campaign needs podcast research at scale, no Listen Notes access → flag Listen Notes recommendation

Don't silently produce a weaker output. Surface the tool gap to the operator with the cost-benefit so they can make the call.

## Signal-to-insight engine: the deterministic middle layer

This section is the missing connective tissue between "we have a signal" and "we have an email." Without it, Claude has to re-derive the implication, the angle, and the hook from scratch on every draft, and the same signal can become wildly different emails across a batch — not because the leads are different, but because Claude's inference path wandered.

The fix is a four-stage pipeline with explicit input/output contracts at each stage, plus deterministic rules where determinism is possible (signal selection, angle picking) and clear judgment guidance where it isn't (prose writing).

### The four-stage pipeline (every email goes through this)

```
STAGE 1: Signal Collection
  Input:    lead identity (email, domain, title, persona archetype, segment, score)
  Process:  pull all available signals from all sources (Apollo, Crustdata, Coresignal,
            Tavily, behavioral watcher) per the Tool Intelligence section
  Output:   raw signal_graph.json with every signal logged, weighted, dated

STAGE 2: Signal Selection
  Input:    signal_graph.json
  Process:  apply the signal selection formula to rank signals
  Output:   primary_signal (for body 1) + secondary_signal (for body 2),
            both with axis labels and source URLs

STAGE 3: Insight Generation
  Input:    primary_signal, secondary_signal, lead's persona archetype, segment,
            client's value prop
  Process:  apply signal → insight chain pattern using the angle library
  Output:   structured insight brief — implication, risk, angle, hook for body 1 +
            same for body 2

STAGE 4: Email Writing
  Input:    insight brief from Stage 3, all 12 rules from this skill, persona
            archetype subject pattern
  Process:  write the email applying all 12 rules
  Output:   subject_1/2/3 + body_1/2/3 ready for the validation checklist
```

**Critical rule: Claude executes one stage at a time, not all four in one pass.** Each stage has a defined output; the next stage reads only that output. This keeps cognitive load manageable and makes failures debuggable (you can see whether Stage 2 picked the wrong signal, or Stage 3 picked the wrong angle, or Stage 4 wrote bad prose). When all four are crammed into one prompt, the model goes inconsistent — picking the easiest signal, complimenting instead of leveraging, and falling back to safe-generic output.

When invoked through subagents, each stage is its own subagent invocation. When invoked inline by Claude in a chat, Claude explicitly labels each stage's output before moving to the next.

### Stage 2 in detail: the signal selection formula

The formula resolves "which signal becomes the body 1 hook" deterministically. No more inference-path-dependent picks.

**For each signal in the graph, compute:**

```
signal_score = base_weight × recency_factor × persona_relevance × axis_priority × business_impact
```

Where:

- **base_weight** (0.0–1.0): from the per-source weight table (axis 2 LinkedIn post on a topic relevant to seller's value prop = 0.9; axis 3b page change = 0.7; axis 1 generic homepage observation = 0.5).
- **recency_factor** (0.0–1.0): 1.0 if 0–7 days, 0.85 if 8–14 days, 0.7 if 15–30 days, 0.4 if 31–60 days, 0.0 if >60 days. Stricter than the scoring rubric's 0–30/30–90/90–180 because email hooks decay faster than account fit.
- **persona_relevance** (0.0–1.0): from the per-archetype axis priority learned by Loop 3b. For MarTech CMOs, axis 2 gets 1.0, axis 1 gets 0.6. For Engineering CTOs, axis 1 gets 1.0, axis 2 gets 0.4. Loaded from `client_learnings.md` per client; falls back to the v9 starter table when no learnings yet exist.
- **axis_priority** (0.0–1.0): tiebreaker when two signals score equally — axis 2 > axis 3 > axis 1 by default, because the more specific the source, the more it feels like the writer actually looked. Adjusts per `client_learnings.md`.
- **business_impact** (0.0–1.0): does the signal tie to the seller's value prop? A "hired Senior Performance Marketing Manager" signal scores 1.0 for a MarTech seller, 0.3 for an HRTech seller, 0.5 for a Series-B SaaS seller. This is the layer that prevents picking a high-weight signal that has nothing to do with what the seller actually offers.

**Selection rules:**

- **primary_signal** = signal with the highest `signal_score`. Used for body 1.
- **secondary_signal** = signal with the highest `signal_score` whose `axis` differs from primary's axis. Used for body 2. (Enforces sequence-level axis rotation from v9.)
- If two signals tie within 0.05 points, pick the one with the more recent timestamp. If still tied, pick the more specific axis (axis 2 over axis 3 over axis 1).
- If no signal scores above 0.30, downgrade to axis 1 category default (Tier C-style observation). Don't try to force a weak signal into a hook.
- If `business_impact` < 0.4 for the highest-scoring signal, demote it and pick the next signal — even high-relevance signals fail if they don't connect to what the seller offers.

**Worked example.** Lead is Danial, CMO at MediGence. Three signals in graph:

| Signal | base_weight | recency_factor | persona_relevance | axis_priority | business_impact | signal_score |
|---|---|---|---|---|---|---|
| LinkedIn post on hospital-partner GTM (axis 2, 13d old) | 0.9 | 0.85 | 1.0 | 1.0 | 0.9 | 0.689 |
| Hiring Senior PMM (axis 3a, 7d old) | 0.85 | 1.0 | 1.0 | 0.85 | 1.0 | 0.722 |
| Homepage serves 3 visitors (axis 1, 1d old) | 0.5 | 1.0 | 0.6 | 0.6 | 0.7 | 0.126 |

Primary = Hiring Senior PMM (axis 3a, score 0.722). Secondary = LinkedIn post (axis 2, score 0.689) — different axis, second-highest score. Body 3 is breakup, no signal needed.

Without this formula, Claude might have picked the homepage observation because it's the freshest (1 day) — an inferior choice. The formula corrects this.

### Stage 3 in detail: the signal → insight chain pattern

For every primary and secondary signal, build the insight before writing prose. The chain has four steps that Claude fills in deterministically:

```
Signal:        what was observed (the raw fact)
Implication:   what it usually means about the buyer's state
Risk / tension: what's likely off because of this state — the friction the seller can address
Angle:         the framing the email will take
Hook:          the specific opener phrasing that ties signal → angle into a single sentence
```

**Worked example with the MediGence Hiring Senior PMM signal:**

```
Signal:        Danial's company posted a Senior Performance Marketing Manager role 7 days ago

Implication:   they're investing in paid acquisition; the funnel is about to get fresh scrutiny;
               the new hire's first 90 days will involve auditing every conversion surface

Risk:          the homepage currently serves 3 different visitor types (international patient,
               family caregiver, hospital partner) with one CTA — the new PMM will flag this in
               their first audit, but right now it's silently costing signups

Angle:         "your funnel is about to get fresh eyes — here's what they'll find first"

Hook:          "Saw the Senior PMM role you posted last week, Danial. Those hires usually start
               with a homepage audit, and one thing on yours might be the first flag."
```

That's the input to Stage 4. The email writes around this insight.

**Compare to the failure mode (no chain):**

Without the chain, Claude has the raw signal and writes:
> "Saw you're hiring a Senior PMM — exciting time! VWO helps marketing teams optimize their funnels..."

This is the "complimenting instead of leveraging" failure ChatGPT correctly diagnosed. The signal is referenced but not USED. The chain forces Claude to extract implication and risk before writing, so the prose actually leverages the signal instead of just acknowledging it.

### Stage 3 — the angle library

This is the missing artifact. For every signal type the system catches, this table defines the standard angle(s) it can become. Same signal can map to multiple angles; the choice is determined by the seller's value prop and the lead's persona.

| Signal type | Default angle (most clients) | Alternative angle (when default doesn't fit seller) | Picking rule |
|---|---|---|---|
| **Hiring marketing roles (PMM, growth, brand)** | "funnel about to get scrutinized" | "messaging audit incoming" | Default for CRO/funnel sellers; alternative for messaging/brand sellers |
| **Hiring sales roles (SDR, AE)** | "pipeline scaling, current tooling about to feel the strain" | "outbound infrastructure stress test" | Default for sales-tooling sellers |
| **Hiring engineering roles (Backend, DevOps)** | "stack scaling, technical debt surfacing" | "infrastructure inflection" | Default for dev-tooling sellers |
| **Hiring product roles (PM, design)** | "product surface about to be re-examined" | "UX audit incoming" | Default for product-analytics or research sellers |
| **Hiring HR roles (recruiter, HR generalist)** | "people processes scaling" | "compliance/policy hardening" | Default for HRTech sellers |
| **Hiring CXO (CMO, CRO, CPO)** | "first-90-days mandate to deliver wins" | "honeymoon-window decisions" | Always primary signal; this is the highest-conversion archetype |
| **Funding raise (Series A-B sweet spot)** | "deploying capital, tooling decisions active" | "scaling team, scaling stack" | Default; rarely use as primary because every SDR pings on this |
| **Funding raise (recent — 0-3 months)** | weak signal, money in bank but not deployed | — | Avoid as primary; mention only if combined with other signals |
| **Funding bridge / down round** | NEGATIVE; demote or skip | — | Drop as a signal; consider as a penalty trigger instead |
| **New CXO joined (0-90 days)** | "fresh eyes about to find what's been overlooked" | "first-quarter wins mandate" | Always strong primary; maps to the buyer's own "make-a-mark" mindset |
| **CXO joined (90-180 days)** | "settling in, evaluating tooling now" | "team built, stack next" | Strong primary, slightly weaker than 0-90d |
| **CXO departed (no replacement)** | NEGATIVE; demote | — | Drop; the buyer has gone |
| **Page change: pricing** | "positioning shifting" | "tier strategy update implies different funnel routing" | Default for pricing/billing tooling; alternative for CRO sellers |
| **Page change: careers** | "team expansion implies process maturation" | "specific role hire reveals strategic intent" | Default for HRTech/recruiting sellers |
| **Page change: customers/case-studies** | "go-to-market story is sharpening" | "social proof strategy maturing" | Default for marketing/branding sellers |
| **Page change: product/features** | "product story is being repositioned" | "new launch implies new buyer segments" | Default for product-tooling sellers |
| **Page change: hero copy** | "messaging being tested" | "positioning experiment in progress" | Default for messaging/CRO sellers |
| **Competitor launched a feature** | "market category is shifting; lead should know how peers are responding" | "competitive table-stakes rising" | Use carefully; never frame as comparison-shopping |
| **Competitor priced lower / repriced** | "lead's positioning under pressure" | — | Use only if seller has a margin advantage to offer |
| **Competitor hired aggressively** | "category heat, win-rate window narrowing" | — | Frame as market context, not as direct comparison |
| **LinkedIn post: tactical/operational topic** | "tie the post's belief to a product reality on their site" | — | Always extract their stated belief, then find the gap on their own surface that contradicts it |
| **LinkedIn post: strategic/POV topic** | "their POV implies a downstream operational tension" | — | Same — extract belief, find the gap |
| **LinkedIn post: hire announcement** | "the post itself reveals what they're prioritizing" | — | Don't congratulate; use the prioritization as the hook |
| **LinkedIn post: customer story / win** | "what made this customer succeed is what your other prospects need" | — | Use the win as the social-proof angle, not as flattery |
| **Conference talk** | "their stated framework vs their site's current state" | — | Strongest axis 2 source — frameworks reveal buying logic |
| **Substack/Medium article** | "their published thinking vs their site's implementation" | — | Read the article, find one specific implementation gap |
| **Podcast appearance** | "what they said in the interview vs what their site shows" | — | Same pattern as articles |
| **Award / recognition** | weak; treat as social proof, not as primary signal | — | Avoid as primary; only mention if directly relevant to seller's value prop |
| **Customer-win announcement** | "growth implies infrastructure/funnel stress" | — | Default; tie growth to the operational tension growth creates |
| **Layoffs (last 90 days)** | NEGATIVE; auto-demote campaign-wide | — | Penalty multiplier kicks in; do not send |
| **Acquisition (as acquirer)** | "integration imminent; tooling decisions ahead" | — | Use carefully; many post-M&A buying freezes |
| **Acquisition (as acquired)** | NEGATIVE; parent likely consolidating | — | Drop; pause for 12 months |
| **Generic homepage observation** | category-default angle (per per-segment quick-reference) | — | Tier C only; avoid as primary for Tier A/B |

**The picking rule when the seller's value prop doesn't match the default angle:**

If the default angle doesn't tie to what the seller actually offers, switch to the alternative. If neither fits, demote the signal in Stage 2 and pick the next highest-scoring signal. Never force a signal into an angle that doesn't connect — the email becomes obviously bolted-together.

### Stage 3 — the axis 2 operationalization recipe

Axis 2 (LinkedIn posts, articles, talks, podcasts) is the most common source of "saw your post — great insights!" failure. The recipe to convert a piece of content into a hook:

```
1. Read the content. Identify the lead's stated belief in one sentence.
   Example: "Tier-2/3 acquisition needs a fundamentally different funnel,
   not just a translation of metro creative."

2. Map the belief to one specific surface on the lead's own product.
   Example: their homepage hero serves all geographies with one creative
   variant — directly contradicts the belief they wrote about.

3. Frame the gap as observation, not accusation.
   Example: NOT "your homepage doesn't follow your own advice" (accusation)
   YES "saw your post on tier-2/3 needing different creative — was on your
   homepage right after, and noticed one creative serves everyone"
   (observation that ties belief to reality)

4. The hook becomes: "[content reference], [observation that creates tension
   between their belief and their site]"
```

**Anti-patterns to NEVER do with axis 2:**

- "Saw your post on X — great insights" (compliment, no leverage)
- "Loved your point about Y" (compliment, no leverage)
- "Your post made me think about Z" (vague, doesn't tie to product)
- Restating their post back at them (no value added)
- Quoting their post verbatim with no commentary (slightly creepy)

**The leverage test:** if the email could be sent without the LinkedIn-post reference and lose nothing, the reference is decorative — rewrite. The reference must change what the email says, not just dress it up.

### Stage 4 in detail: the constrained writing template

Stage 4 receives the insight brief and writes the email. The constraint here is not "follow all 12 rules" (Claude already does that) — it's that the prose follows the brief. Stage 4 is where determinism gives way to judgment, but the judgment is bounded by the brief.

**The body 1 template (fill in from the insight brief):**

```
[Hook from brief — Stage 3 output, ties signal to angle in plain language]

[Implication expanded — 1-2 sentences making the implication concrete and specific
 to this lead's site/product]

[Risk made specific with empathy — 1-2 sentences naming the friction without diagnosis;
 use empathy markers from Rule 10 ("doing a lot of work right now," "tends to," "many
 teams find," "exactly where you can least afford it")]

[Solution context with social proof — 1-2 sentences naming the seller's product and
 ONE customer from the seller's verified roster who's solved this same friction]

[Generous CTA — 1-2 sentences offering a specific, time-bounded look at the
 lead's funnel; "Happy to share," "Would it be useful to," etc.]
```

This is not a fill-in-the-blanks form. It's a structural map. Claude writes prose, but the prose follows the five beats. If a beat is missing in the output, the email is incomplete — flag for rewrite.

**The body 2 template:**

```
[Light bridge from body 1 — "One more thing I noticed on [domain]..." or similar]

[Secondary signal hook — Stage 3 output for the secondary signal, different axis from body 1]

[Implication + risk in 2-3 sentences]

[Test idea + social proof in 1-2 sentences]

[Soft CTA — "Happy to share the test plan if useful"]
```

**The body 3 template:**

```
[Warm breakup — "Wrapping up here on [domain], [first name]..."]

[Open door + warm close — "If [specific scenario], my note is here whenever it might be
 useful. Wishing you and the team a strong [season/quarter/launch] ahead."]
```

These templates lock the structure so Stage 4 isn't trying to invent shape AND fill content simultaneously. Shape is given; content is judgment.

### What gets logged at each stage

Each stage's output is logged to the `signal_graph.json` (Stage 1, 2) or to a per-lead `insight_brief.json` (Stage 3) or to the campaign CSV (Stage 4). This makes failures debuggable.

**signal_graph.json adds (after Stage 2):**
```json
"primary_signal_id": 1,
"primary_signal_score": 0.722,
"secondary_signal_id": 0,
"secondary_signal_score": 0.689,
"selection_rationale": "Hiring PMM scored higher than LinkedIn post (0.722 vs 0.689)
                         due to fresher recency (7d vs 13d). LinkedIn post selected as
                         secondary because axis differs from primary."
```

**insight_brief.json (output of Stage 3):**
```json
{
  "lead_id": "vwo_2026q2_023",
  "body_1": {
    "signal": "Hiring Senior Performance Marketing Manager, posted 7 days ago",
    "implication": "investing in paid acquisition, funnel about to be audited",
    "risk": "homepage serves 3 visitor types with one CTA — first thing PMM will flag",
    "angle": "your funnel is about to get fresh eyes — here's what they'll find first",
    "hook": "Saw the Senior PMM role you posted last week, Danial. Those hires usually start with a homepage audit, and one thing on yours might be the first flag."
  },
  "body_2": {
    "signal": "LinkedIn post on hospital-partner GTM, 13 days old",
    "implication": "thinking about partner-channel acquisition specifically",
    "risk": "homepage hero treats hospital-partner the same as patient and family",
    "angle": "tie the partner-channel belief to the homepage gap",
    "hook": "Going back to your post on hospital-partner GTM — was on your homepage right after, and the partner-channel buyer lands in the same place as the patient and family."
  },
  "body_3": "warm breakup, no signal"
}
```

**campaign_outcomes.csv adds:**
```
primary_signal_score, primary_signal_axis, primary_signal_age_days,
secondary_signal_score, secondary_signal_axis, secondary_signal_age_days,
angle_b1, angle_b2
```

These let Loop 3 (observation-angle refinement) learn which angles convert per persona × segment, not just which axes.

### When the engine fails — fallback hierarchy

Sometimes the pipeline can't produce a strong primary signal. Hierarchy:

```
1. Primary signal scores ≥ 0.30 → use it
2. Primary signal scores 0.15-0.30 → use, but flag for human review before send
3. Primary signal scores < 0.15 → drop to Tier C category default for this lead;
   do not try to force a weak signal into a hook
4. No signals at all → drop the lead from this campaign; flag for re-research
   in next cycle
```

The engine's job is to fail visibly, not silently. A weak email is worse than no email.

### What this engine does NOT solve

- It doesn't make Claude's prose voice consistent — that's Rule 10 (warmth, hedging, generous CTA) and the read-aloud test.
- It doesn't replace the validation checklist — all 45 checks still run.
- It doesn't eliminate the need for human review on Tier A leads — the engine gets you to a 90% draft; the operator's 30 minutes of sample review is what gets to ship-quality.
- It doesn't substitute for the self-learning loops — Loop 3 still refines which angles convert per client over time. The engine just makes the inputs to Loop 3 cleaner.

### Why this is the unlock

ChatGPT's diagnosis was correct on this point: v11 had the inputs (signals, weights, axes, tools) and the outputs (the 12 email rules) but the middle layer (signal → insight → angle → hook) was implicit. Claude was forced to re-derive it on every draft, which is why the same signal could become wildly different emails across a batch.

v12 makes the middle layer explicit. Stage 1 collects signals deterministically from tools. Stage 2 selects them deterministically by formula. Stage 3 converts them to insight via the angle library and the chain pattern. Stage 4 writes prose constrained by the insight brief and the body templates. Each stage has typed inputs and outputs. The whole pipeline is debuggable — when output is bad, you can identify which stage failed.

This is what separates "skill file with 45 rules" from "production system that produces consistent output." The 45 rules are still there; v12 just gives them a runtime.

## Observation depth: the three-axis model

The single biggest quality lever in this skill — and the most-missed when output starts feeling templatey across a 50-lead batch — is observation diversity. There are three observation axes available, not one. Most campaigns over-rely on axis 1, which is why every email opens with "Was on [domain] and noticed [page] does [pattern]." Mixing axes across a batch removes the structural sameness even when each individual email keeps full personalisation depth.

### The three axes

**Axis 1 — Company-level observation.** A page, flow, or pattern on the prospect's own product. Sourceable by Tavily and direct browse. The default in v1-v8 of this skill.
- Examples: "your size guide sits two clicks deep on every PDP," "your KYC asks for 4 documents across 4 screens," "your homepage hero serves 3 different visitors."

**Axis 2 — Lead-level observation.** Something the PERSON has personally written, posted, said, or just changed. Tied to the human, not the company.
- Examples: "saw your LinkedIn post last Thursday on hospital-partner GTM — got me curious about how your homepage handles those visitors," "you spoke at SaaSBoomi about retention being a north-star — wondered if your trial flow reflects that," "you joined as VP Marketing 6 weeks ago, and the homepage still leans old-product positioning," "your Substack piece on KYC drop-off matched exactly what I noticed on your own KYC step."
- Strongest single-axis converter when the signal is fresh (under 30 days).

**Axis 3 — Activity-level observation.** Something specific is happening RIGHT NOW that ties to this person's mandate. The window is 0-30 days, ideally 0-14.

Axis 3 has four sub-categories, each sourced differently:

- **3a. Hiring activity** — recent job postings, especially ones the lead personally posted as the hiring manager. Often the strongest axis 3 sub-signal because it ties directly to the lead's mandate.
  - Example: "Saw the Senior Performance Marketing Manager role you posted 8 days ago — those hires usually mean the funnel is about to get a fresh look."

- **3b. Product / page changes (behavioral signals)** — the prospect's own website just changed in a way that creates a buying-window hook. Pricing-page updates, new landing pages, careers-page additions, hero-copy changes, new feature-launch pages. These are gold because they signal "something is shifting on their side" in real time, and almost no other outbound system catches them.
  - Example: "Noticed Cleartrip launched the new corporate-travel landing page on the 18th — the demo form there still serves both your enterprise and SMB leads with the same fields."
  - Example: "Saw your pricing page added an enterprise tier last week — wondered if the demo flow above it has been updated to route enterprise leads differently."

- **3c. Competitive activity** — a direct competitor of the prospect just launched, hired, repriced, or got acquired. Creates an "insider observation" hook.
  - Example: "Noticed [competitor] just rolled out their tier-2/3 cash-on-delivery flow last week — curious how that lands for citymall.live's positioning."
  - Caveat: use with care. Naming a competitor in a cold email can backfire if the relationship between the two is sensitive. Best when the competitor is mentioned neutrally as market context, not as a comparison.

- **3d. Press / launch / leadership announcements** — funding, awards, customer wins, new exec hires (the prospect themselves OR their direct boss). Conventional axis 3.
  - Example: "Saw Razorpay's new VP Engineering announcement last Wednesday — the hire usually shifts API-docs priorities for a quarter or two."

### Why this matters

When axis 1 is the only axis used:
- Every opener starts with "Was on [domain] and noticed..."
- The recipient pattern-matches all 50 emails as variations of the same template
- Personalisation depth doesn't save the structural sameness
- Reply rate plateaus around 3-4% even when individual emails are well-crafted

When axes 1, 2, and 3 are mixed across a batch:
- 30-40% of emails open with lead-level (axis 2) when the signal exists
- 20-30% open with activity-level (axis 3) when fresh signals exist
- Remainder use company-level (axis 1)
- Same depth per email, but no two openers feel structurally alike
- Reply rate ceiling rises — observed 5-7%+ in similar Indian B2B stacks that operationalise the multi-axis model

### Per-tier observation protocol

| Tier | Axes used | Signal strength threshold | Time per lead |
|---|---|---|---|
| **Tier A** (top 20%) | Lead-level (axis 2) IF fresh signal exists, else activity-level (axis 3) IF fresh, else company-level (axis 1). Body 2 of sequence rotates to a different axis. | Axis 2 used when the lead's LinkedIn post / talk / article is under 30 days old. Axis 3 used when the activity (hire posting, launch, award) is under 30 days old. | 7-10 minutes per lead (up from 5-7 in v8 — the extra 2-3 min is the lead-level research) |
| **Tier B** (middle 50%) | Company-level (axis 1) primary, with rotation across the batch (no two consecutive leads use the same observation type). Activity-level (axis 3) used opportunistically if visible without extra research. | Axis 3 used only when the activity is so visible (e.g., a job posting on Apollo) that no extra research is needed. | 2-3 minutes per lead |
| **Tier C** (long-tail 30%) | Company-level (axis 1) only, default to category-level CRO patterns (Indian fintech KYC, D2C size-guide, EdTech fee placement). | None — pure category default. | 30 seconds per lead |

### Observation diversity rule (per 50-lead batch)

Even with the per-tier protocol, force batch-level diversity:
- No more than 30% of leads in a single batch use the same observation type (e.g., "homepage hero", "checkout flow", "category density")
- No more than 5 consecutive leads (in the campaign send order) use the same observation axis
- Within a 3-step sequence, body 1 and body 2 use different axes (body 3 is a breakup, no observation needed)

The observation diversity check runs as part of the validation checklist before CSV write.

### Observation rotation across the 3-step sequence

Body 1 → Body 2 → Body 3 should not all open with the same axis. Default rotation patterns by tier:

**Tier A rotation:**
- Body 1: Lead-level (axis 2) — strongest, freshest signal about the person
- Body 2: Company-level (axis 1) — different page/flow than body 1
- Body 3: Breakup — no axis needed, warm close

**Tier B rotation:**
- Body 1: Company-level (axis 1) — page/flow observation
- Body 2: Activity-level (axis 3) if visible, else Company-level on a different surface
- Body 3: Breakup

**Tier C rotation:**
- Body 1: Company-level category default
- Body 2: Company-level different category default
- Body 3: Breakup

## How to source observations efficiently (per axis)

Time per lead matters. Tools matter even more. Tavily alone handles axis 1 and partial axis 3. Axis 2 (lead-level) requires LinkedIn-derived data that Tavily cannot reliably reach because LinkedIn blocks scraping.

### Tools per observation axis

| Axis | Primary tool | Backup tool | Notes |
|---|---|---|---|
| **Axis 1: Company-level** | Tavily search + extract | Manual browse for Tier A | Tavily alone sufficient |
| **Axis 2: Lead-level — LinkedIn posts** | Coresignal (via Clay) OR Proxycurl | PhantomBuster, Crustdata | LinkedIn blocks Tavily; need API-based access |
| **Axis 2: Lead-level — articles/Substack/Medium** | Tavily with `site:` filters | Direct Google search | Tavily catches these well |
| **Axis 2: Lead-level — podcasts/talks** | Listen Notes API + Tavily for show notes | Otter for transcript if URL known | Show notes contain enough usually |
| **Axis 2: Lead-level — Twitter/X** | Tavily with `site:x.com` | Twitter API (paid, limited) | Hit rate is variable |
| **Axis 2: Lead-level — conference speaking** | Tavily with `site:saasboomi.in`, `site:nasscom.in`, `site:inc42.com`, `site:ethrworld.com`, `site:etcio.com`, `site:yourstory.com` | Direct event-site browse | Indian-specific event sites work |
| **Axis 3: Activity-level — hiring posts (3a)** | Apollo (departmental headcount + hiring filter) + Crustdata | LinkedIn Jobs via Coresignal | Crustdata strongest for India |
| **Axis 3: Activity-level — page/pricing changes (3b)** | Visualping or custom watcher on `/pricing`, `/careers`, `/product`, `/customers` pages | Wayback Machine for retroactive checks | Set up per-client watchers; cheap and high-signal |
| **Axis 3: Activity-level — competitive moves (3c)** | Same Visualping watchers but pointed at the prospect's top 3 competitors | Tavily site-targeted on competitor sites | Manual quarterly competitor-list refresh per client |
| **Axis 3: Activity-level — product launches / press (3d)** | Tavily with `site:` filters (Indian press) | Direct press-page browse | Tavily fine |
| **Axis 3: Activity-level — funding/news (3d)** | Tavily + Tracxn + Inc42 search | Crunchbase | Tavily fine |
| **Axis 3: Activity-level — leadership change (3d)** | Apollo (recently joined filter) + Crustdata | LinkedIn Sales Navigator alerts | Crustdata best |

### Recommended Indian site-target list for Tavily searches (axis 2 and axis 3)

Save these as the standard set for Indian B2B research:

**Indian B2B press:**
- `site:inc42.com`
- `site:entrackr.com`
- `site:moneycontrol.com`
- `site:economictimes.indiatimes.com`
- `site:livemint.com`
- `site:yourstory.com`
- `site:thearcweb.com`
- `site:ken.in`
- `site:tech.economictimes.indiatimes.com`

**Indian SaaS / startup conferences:**
- `site:saasboomi.in`
- `site:nasscom.in`
- `site:saastr.com`

**Indian function-specific media:**
- `site:ethrworld.com` (HR)
- `site:etcio.com` (CIO/CTO)
- `site:etbrandequity.com` (CMO/marketing)
- `site:etcfo.com` (CFO/finance)
- `site:etretail.com` (retail/D2C)

**General lead-level:**
- `site:substack.com`
- `site:medium.com`
- `site:x.com` (Twitter posts)

### Tier A observation research workflow (7-10 min per lead)

1. **Lead-level scan (3-4 min)** — pull the lead's LinkedIn last 90 days via Coresignal/Proxycurl. Look for: posts they wrote (not just liked), comments they made on others' posts, articles they were tagged in, talks they gave, awards/promotions/wins they announced. If a fresh post or activity (under 30 days) directly relates to the seller's value prop, that's the axis 2 hook.
2. **Activity-level scan (1-2 min)** — pull the company's last-30-day activity: hiring posts (especially ones the lead personally posted as the hiring manager), product launches, customer wins, press mentions. If something is fresh and tied to the lead's mandate, that's the axis 3 hook.
3. **Company-level scan (2-3 min)** — Tavily extract on homepage + one specific funnel page. Note one observable thing.
4. **Pick the strongest axis** for body 1. The strongest signal wins, not the most prestigious axis. A 14-day-old LinkedIn post about exactly the seller's category beats a generic homepage observation.
5. **Pick a different axis** for body 2.

### Tier B observation research workflow (2-3 min per lead)

1. One Tavily extract on the homepage + one Tavily search for `<domain> signup OR checkout OR pricing OR demo`.
2. Check the Apollo enrichment for visible activity-level signals (recent funding, hiring, headcount growth) that show up without extra research.
3. Pick the strongest of the two axes for body 1.

### Tier C observation research workflow (30 sec per lead)

Use category-level CRO patterns. No per-lead research:
- Indian fintech: KYC always too long, document upload always painful
- Indian D2C apparel: size guide depth, fabric/care below fold, PDP image stacking
- Indian D2C beauty: bundle vs single-SKU PDP, ingredients depth, subscription CTA placement
- Indian EdTech: fee placement, EMI calculator depth, free-to-paid step
- Indian SaaS: demo form segmentation, industry-specific landing page absence
- Indian Health/Diagnostics: lead form for B2B vs B2C, treatment page tone, trust signals placement
- Indian Travel: search-form date defaults, COD vs prepay messaging, route-page density

In all cases, the observation should be specific enough that the prospect could agree it's true, but generic enough that it doesn't require deep site knowledge.

### Behavioral signal infrastructure (axis 3b setup, one-time per client)

Axis 3b — page/pricing/careers/product changes on the prospect's own site — requires per-client setup but pays back across every campaign for that client. The setup:

**Per client, week 1 of engagement:** identify the top 100-200 in-pipeline accounts. For each, register watchers on these standard pages:
- `/pricing` (or pricing-equivalent, varies by site)
- `/careers` or `/jobs` (especially the page where job listings live)
- `/customers` or `/case-studies` (catches new logo additions)
- `/product` or `/features` (catches positioning changes)
- The homepage itself (hero copy and CTA changes)

**Tooling for the watcher:**
- **Visualping** (~$50-200/mo per client at this volume) — set up once, runs forever, alerts when changes detected. Works for non-technical operators.
- **Custom Python crawler** (free, ~200 lines) — weekly scrape of the 5 standard URLs per account, diff against last week's snapshot, log changes to a per-client `behavioral_signals.csv`. Required if you're tracking 200+ accounts per client (Visualping gets expensive at scale).

**Per campaign, week of send:** pull the last-30-day delta from `behavioral_signals.csv` for every account in the prospect list. Any account with a fresh page change auto-promotes axis 3b as the candidate observation, especially if the change ties to the seller's value prop (e.g., a pricing-page change for a CRO-tooling seller, a careers-page change for an HRTech seller).

**Watcher hygiene:**
- Quarterly review of the watcher list — drop accounts that have been excluded from outreach (DNC, customer, etc.), add newly-scored accounts.
- The seller's own competitor list (3-5 competitors per client) gets the same watcher set — drives axis 3c (competitive activity) signals.
- Don't try to crawl LinkedIn job postings via custom scraper — LinkedIn blocks this; use Coresignal or Crustdata for hiring signals.

This is the layer that catches what nothing else in the stack catches. A pricing-page update is a near-certain "they're rethinking positioning right now" signal that no amount of Tavily or Apollo data surfaces.

### Per-lead signal graph (the connective tissue)

Once a lead has been enriched across Apollo, Tavily, Coresignal, Crustdata, and the behavioral watcher, all those signals need to live in one queryable place — not as separate fields scattered across CSVs. Per-lead signal graph is a JSON artifact that consolidates everything with weights, ages, and decay state.

**Schema** (one JSON file per lead in the active campaign, stored alongside `campaign_outcomes.csv`):

```json
{
  "lead_id": "vwo_2026q2_023",
  "first_name": "Danial",
  "company": "MediGence",
  "domain": "medigence.com",
  "persona_archetype": "marketing",
  "tier_abc": "A",
  "score_final": 92,
  "score_bucket": "Top Priority",
  "signals": [
    {
      "axis": "lead_level",
      "type": "linkedin_post",
      "source_url": "https://linkedin.com/posts/danial-...",
      "extracted_at": "2026-04-22T08:14:00Z",
      "age_days": 13,
      "decay_multiplier": 1.0,
      "raw_text_excerpt": "Hospital partnerships scaling 3x at MediGence...",
      "topic_tags": ["hospital_partnerships", "growth"],
      "relevance_to_seller": "high",
      "weight": 0.9
    },
    {
      "axis": "activity_level",
      "subtype": "hiring",
      "source_url": "https://linkedin.com/jobs/...",
      "extracted_at": "2026-04-28T09:00:00Z",
      "age_days": 7,
      "decay_multiplier": 1.0,
      "role_posted": "Senior Performance Marketing Manager",
      "posted_by_lead": true,
      "weight": 0.85
    },
    {
      "axis": "activity_level",
      "subtype": "page_change",
      "source_url": "https://medigence.com/pricing",
      "detected_at": "2026-05-02T10:30:00Z",
      "age_days": 3,
      "decay_multiplier": 1.0,
      "change_type": "new_section_added",
      "change_summary": "added enterprise tier",
      "weight": 0.7
    },
    {
      "axis": "company_level",
      "type": "homepage_pattern",
      "source_url": "https://medigence.com",
      "observed_at": "2026-05-04T14:00:00Z",
      "age_days": 1,
      "decay_multiplier": 1.0,
      "pattern": "single hero serves international patient + family caregiver + hospital partner",
      "weight": 0.6
    }
  ],
  "winning_signal_id": 0,
  "axis_b1": "lead_level",
  "axis_b2": "activity_level",
  "axis_b1_source": "https://linkedin.com/posts/danial-...",
  "axis_b2_source": "https://medigence.com/pricing",
  "graph_built_at": "2026-05-04T14:30:00Z"
}
```

**How the graph is used:**

1. **Email drafting input.** When the email-drafting subagent picks up a lead, it reads the signal graph instead of separate enrichment fields. The `winning_signal_id` (highest-weighted fresh signal) is the body 1 hook. The next-highest different-axis signal is the body 2 hook.

2. **Decay update.** Every time the graph is read, signals get their `age_days` recomputed and `decay_multiplier` updated per Layer 5 of the scoring rubric (1.0 for 0-30d, 0.7 for 30-90d, 0.3 for 90-180d, dropped at 180d). Stale signals fall off automatically.

3. **Conflict resolution.** When two signals contradict (e.g., axis 2 says "scaling 3x" but axis 3b says careers page just added a layoff notice), the graph flags the conflict and the email is held for human review rather than sent.

4. **Loop 3b learning.** The graph captures which axis was used per send. When the reply comes back tagged, Loop 3b (axis comparison) reads from the graph + the outcome to learn which axis converts best for this persona × segment.

**Storage.** Per-client `signal_graphs/` directory containing one JSON per active lead. Updated weekly; archived when the lead exits the active campaign list. Becomes part of the maintenance handover artifacts.

**Why this matters more than adding more tools.** ChatGPT's framing in the v10 review was right on this point: tools without a unified graph means each enrichment source produces its own scattered fields, the email-drafting agent picks one signal (usually whatever's most prominent in the CSV row), and other valuable signals are silently dropped. The graph forces every signal into a single weighted view so the strongest one always wins, regardless of source. This is the single highest-leverage upgrade in v10.



Some prospects don't post on LinkedIn, don't write articles, don't speak at conferences, don't have a Substack. For these, axis 2 is simply unavailable. Don't fabricate an axis 2 observation. Drop to axis 3 (recent activity at the company) or axis 1 (company-level).

The validation checklist enforces: no observation is invented. Every axis 2 or axis 3 claim must trace to a verifiable URL (a LinkedIn post URL, a podcast URL, a press article URL, a job posting URL). If no source exists, the observation defaults to axis 1.

### Examples of body 1 openers per axis (Indian buyer register, v9 style)

**Axis 2 — Lead-level (LinkedIn post, fresh):**
> Saw your LinkedIn post last Thursday on hospital partnerships scaling 3x at MediGence, Danial — a great problem to have, and one that usually shows up first on the homepage.
>
> Was looking at your homepage right after, and noticed three different visitors all landing in the same place...

**Axis 2 — Lead-level (conference talk):**
> Was listening to your SaaSBoomi talk last month, Vijit, where you mentioned retention as the north-star at Razorpay.
>
> Looked at your trial flow this morning, and one moment in the activation step caught me — wondered if it ties to what you spoke about...

**Axis 3 — Activity-level (recent hiring post):**
> Saw the Senior Performance Marketing Manager role you posted on LinkedIn 8 days ago, Priya.
>
> Those hires usually mean the funnel is about to get a fresh look. Was on Cleartrip's checkout this morning, and one moment kept tripping me up...

**Axis 3 — Activity-level (product launch):**
> Noticed Cleartrip launched the new corporate-travel landing page on the 18th, Karan.
>
> The demo form there still serves both your enterprise and SMB leads with the same fields. For an enterprise prospect on a 5-inch phone, that density tends to scan very differently...

**Axis 1 — Company-level (default, when no fresh axes 2/3 signal):**
> Was on Cleartrip's checkout this morning, and one moment kept tripping me up.
>
> Your COD-default makes sense for your tier-2/3 buyer. But the pincode-confirmation modal blocks the cart for nearly 2 seconds on every load...

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

These are starting templates per archetype. All examples use the v8 format `FirstName, [observation]`. Iterate based on the self-learning loop (later section). Avoid duplicating any of Rule 1's reference examples — those are public and may be pattern-detected by spam filters over time.

**Founder / CEO** (Indian, Series A to Series C, age 28-42):
- Opens what looks like a peer ping or an investor/board observation, NOT a vendor pitch
- Hates corporate language. Reads on phone between meetings. Decides in 2 seconds.
- Pattern: `Name, [2-3 word observation]` about a single product surface
- Examples: `Vijit, your pricing page`, `Rohit, your homepage`, `Karan, your demo button`, `Ananya, your launch page`
- Avoid: anything with "growth," "scale," "ROI," "leverage" — these read as vendor

**Marketing / Growth leader** (CMO, VP Marketing, Head of Growth):
- Reads more emails than peers, has higher tolerance for tactical specificity
- Opens what signals "I've actually looked at your stack"
- Pattern: `Name, [observation referencing a channel, page, or tool]`
- Examples: `Priya, your meta ads`, `Aakash, post-purchase flow`, `Sneha, your shopify checkout`, `Karan, your utm setup`
- Avoid: subjects that don't reference a specific thing on their site or stack

**Product leader** (CPO, VP Product, Head of Product):
- Thinks in metrics, tests, user journeys, retention curves
- Opens what reads like a quick UX observation from a fresh user
- Pattern: `Name, [observation referencing a user flow or screen]`
- Examples: `Rahul, your onboarding step`, `Meera, your empty state`, `Karthik, signup screen`, `Tanvi, your trial gate`
- Avoid: subjects that are too sales-coded ("conversion lift," "demo book")

**Engineering leader** (CTO, VP Engineering, Head of Eng, Staff Engineer):
- Terse. Skeptical of marketing language. Opens technical-sounding signals only.
- Pattern: `Name, [3 words technical]`
- Examples: `Arjun, your api docs`, `Vivek, your status page`, `Kabir, your sso flow`, `Rohan, your sdk surface`
- Avoid: anything marketing-coded, anything with "user experience," anything aspirational

**Finance leader** (CFO, VP Finance, Head of Finance, Financial Controller):
- Reads for ROI signal, hates fluff, scans for numbers
- Pattern: `Name, [observation on cost/efficiency/compliance touchpoint]`
- Examples: `Sandeep, your gst flow`, `Aditi, your invoicing step`, `Manish, your billing screen`, `Naveen, your reco process`
- Avoid: anything that sounds like a marketing pitch

**HR / People leader** (CHRO, Head of HR, VP People, Talent leader):
- Tolerates slightly warmer/relational tone than peers
- Pattern: `Name, [observation on candidate or employee touchpoint]`
- Examples: `Riya, your careers page`, `Suresh, your apply flow`, `Pooja, your offer letter`, `Vikram, your engagement loop`
- Avoid: anything cold-vendor-coded

**Operations / Supply Chain leader** (COO, VP Ops, Head of Ops, Head of Supply Chain):
- Opens what looks like a process-level observation, references workflows
- Pattern: `Name, [observation on a workflow or step]`
- Examples: `Anil, your dispatch flow`, `Bhavna, your wms step`, `Jatin, your returns gate`, `Smita, your sla buffer`
- Avoid: subjects that imply you don't understand operational complexity

**Sales leader** (CRO, VP Sales, Head of Sales):
- Highest skepticism of cold outbound, since they ARE cold outbound. Pattern-matches in 1 second.
- Opens what feels like peer-to-peer observation, never vendor
- Pattern: `Name, [observation on sales surface or motion]`
- Examples: `Aman, your demo form`, `Tanya, your trial flow`, `Vishal, your pricing tier`, `Neha, your sdr cadence`
- Avoid: anything that mimics another SDR's template — they've seen all of them

### Modifiers based on company stage

| Stage | Tone shift | Subject example pattern |
|---|---|---|
| Seed / Series A (under 100 employees, founder-led) | Most casual. Use the founder's own informal vocabulary if visible on LinkedIn. | `Karan, your homepage`, `Riya, your nps loop` |
| Series B / C (100-500 employees) | Standard observation pattern, role-specific. | `Priya, your meta ads`, `Vivek, your kyc step` |
| Listed / large enterprise / PE-owned (500+) | More formal. Less first-person. References company-level not individual-level. | `Sandeep, your retail flow`, `Aditi, your branch step` |

### Modifiers based on age cohort

| Age | Tone shift | Notes |
|---|---|---|
| Under 30 (often PMs, growth managers, junior leaders) | Shorter observation OK after the first name. Lowercase casual. | `Aman, your trial gate` |
| 30-45 (most CXOs in modern startups) | Clean first-name + lowercase observation works as-is | The default |
| 45+ (often traditional industry CXOs, BFSI, manufacturing) | Slightly more formal. Sentence case acceptable in observation. Less internet-native. | `Mr. Sharma, your KYC step` may convert better than lowercase for very senior traditional industry buyers — verify per client |

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

## Account scoring methodology (India-only, per-product, timing-aware)

### How this section relates to existing Thyleads scoring

Thyleads's existing rubric (documented in `OUTBOUND_PIPELINE_PLAYBOOK.md` and `Thyleads_GTME_14Day_Onboarding_Playbook.md`) uses a 100-point scale across four dimensions: Base Fit (30) + Signals (40) + Engagement (20) + Why-Now (10). The 8-dimension implementation in the playbook (Geo 20 + Industry 22 + Employees 12 + Keywords 12 + Hiring 12 + Traffic 10 + Maturity 6 + Engagement 6) is the deterministic Python rubric.

This section EXTENDS that rubric, it does not replace it. Two additions: timing as a multiplier (not a flat add), and explicit penalty multipliers. Plus per-product weight tuning across the four Thyleads client segments (Seed-Series A, Series B, MarTech, HRTech) and an expanded intent signal taxonomy.

### The five-layer scoring model

```
Final score = (Fit + Intent + Engagement + Why-Now) × Timing_multiplier × Penalty_multiplier
            = base_score (0-100)            × (0.6 to 1.3)    × (0.0 to 1.0)
```

A prospect with a base score of 85 (Priority bucket) but emailed during Diwali week (timing 0.7×) with recent layoffs (penalty 0.5×) has an effective score of 85 × 0.7 × 0.5 = 29.75 (Excluded). Same prospect, emailed in mid-April with no penalties: 85 × 1.2 × 1.0 = 102 (Top Priority). Timing and penalties are first-class — they decide whether to send NOW vs. WAIT, not just whether the prospect is good in the abstract.

Buckets after multipliers applied:
- **Top Priority** (95+): send this week, full Tier A persona research
- **Priority** (75-94): send this campaign, full Tier B archetype defaults
- **Active** (55-74): send next campaign cycle, Tier C defaults
- **Nurture** (35-54): hold; re-score monthly; send only if score climbs
- **Excluded** (<35): drop from this campaign; re-evaluate quarterly

### Layer 1: Fit (30 points)

Firmographic and psychographic match. This is the existing rubric's Base Fit dimension — not changed materially, summarised here for completeness.

| Sub-signal | Max | Notes |
|---|---|---|
| Geo: India HQ + India-decisioned | 10 | Non-India HQ = score 0 across the entire model (auto-exclude). India HQ but offshore-decisioned = 5. |
| Industry primary fit | 8 | Calibrated from past won deals. Top-converting industry = 8. Adjacent = 4. Anti-ICP = -10 (penalty, not zero). |
| Employee band fit | 6 | Sweet spot per product (see per-product table below) = 6. Adjacent band = 3. Outside = 0-2. |
| Stage / funding fit | 4 | Sweet stage = 4. Adjacent = 2. Outside = 0. |
| Tech stack / vertical keyword fit | 2 | Existing keyword scoring, capped at 2. |

### Layer 2: Intent signals (40 points)

This is where most of the new richness goes. Six signal sub-categories, each with multiple specific triggers. Recency-weighted (signals 0-30 days old count fully; 30-90 days at 70%; 90-180 days at 30%; older drops out).

#### 2a. Hiring signals (12 points)

The strongest single-category predictor for B2B intent in India in 2026.

| Sub-signal | Max | Notes |
|---|---|---|
| Hiring the ICP role itself | 5 | E.g., for HRTech selling to CHRO, prospect is hiring CHRO right now. Strongest signal — they're literally building the team that buys. |
| Hiring direct reports of ICP | 3 | Hiring "VP People" under a CHRO. Implies team build-out, budget exists. |
| Hiring proxies / adjacent roles | 2 | Hiring "Performance Marketing Manager" for a MarTech client. Indicates investment in the function. |
| Hiring volume (>5 open roles in the relevant function) | 1 | Volume signal regardless of specific titles. |
| Hiring velocity (>3 roles posted in last 30 days) | 1 | Speed signal — they're scaling now, not eventually. |

Source: LinkedIn Jobs API, Naukri, Hirect, the company's own careers page.

#### 2b. Leadership change signals (8 points)

The single most actionable timing signal in B2B. New leaders make changes in their first 100 days.

| Sub-signal | Max | Notes |
|---|---|---|
| ICP / decision-maker joined in last 0-90 days | 8 | The "honeymoon window." 90-day-old CMOs have an explicit mandate from the CEO to change things. Highest-converting cohort across every Thyleads campaign. |
| ICP joined 90-180 days ago | 5 | Settling in, stabilising team, may now be ready to evaluate. Second-best window. |
| ICP joined 180-365 days ago | 2 | Decisions made, vendor stack chosen, harder to displace. |
| ICP departed in last 90 days, no replacement yet | -3 | Penalty. No buyer = no decision. Wait for replacement. |
| Recent organisational restructure announced | 2 | Implies budget reallocation, fresh decisions. |

Source: LinkedIn (most reliable), company press releases, news.

**Why this matters more than funding:** Indian B2B buyers don't open the wallet because they raised money. They open the wallet because a new leader needs to deliver wins fast. Tracking leadership changes is more predictive than tracking funding rounds.

#### 2c. Funding & financial signals (5 points)

| Sub-signal | Max | Notes |
|---|---|---|
| Raised in last 0-3 months | 2 | Money in bank, but they haven't deployed it operationally yet. Watch, don't push. |
| Raised 3-12 months ago (sweet spot) | 5 | Operationalising — actively buying tooling, hiring, expanding. **Best buying window.** |
| Raised 12-24 months ago | 3 | Productivity hunting — they're past the easy hires, now optimising. |
| Raised 24+ months ago, no fresh round | 1 | Capital-constrained or pre-fundraise. Caution: budgets locked. |
| Bridge round / extension round | 0 | Defensive capital. Conservative buying. |
| Down round | -5 | Penalty. Cost-cutting mode, vendors get culled. |
| Listed company beat earnings recently | 2 | Good macro confidence. |
| Listed company missed earnings | -2 | Penalty. |

Source: Tracxn, Inc42, Crunchbase, MoneyControl, BSE/NSE filings.

#### 2d. Growth & expansion signals (5 points)

| Sub-signal | Max | Notes |
|---|---|---|
| Employee growth >10% in last 6 months | 3 | Strong scale signal. |
| Employee growth 5-10% in last 6 months | 2 | Healthy scale. |
| Office / new geography expansion announced | 2 | Implies infrastructure budget. |
| New product line / business unit launched | 2 | Implies stack expansion budget. |
| Major partnership or M&A as acquirer | 1 | Implies bigger budget. |
| Headcount flat (0 to 5%) | 0 | Neutral. |
| Headcount shrinking | -5 | Penalty. |

Source: LinkedIn employee count trends, company press releases, Crustdata, similarweb.

#### 2e. News / brand signals (4 points)

| Sub-signal | Max | Notes |
|---|---|---|
| Won a major industry award in last 6 months | 1 | Validation, marketing budget signal. |
| CEO/CXO speaking at major Indian conferences (SaaSBoomi, Inc42, ETBrandEquity, ETCIO, Mint, ETHRWorld, etc.) | 2 | Active in their professional community = open to outreach from peers in that community. |
| Published thought-leadership content on relevant topic | 1 | Marketing investment signal for MarTech buyers especially. |
| Major customer-win announcement | 1 | They're growing. |
| Acquired by another company | -3 | Penalty. Parent likely consolidating tools. Pause for 12 months. |
| PR crisis / litigation in last 90 days | -5 | Penalty. Wrong time. |
| Founder / CEO departure | -3 | Penalty. Vacuum. |

Source: Google Alerts, Inc42, ETtech, MoneyControl, Linkedin posts.

#### 2f. Tech stack / competitor signals (6 points) — NEW

The single most valuable addition to the existing rubric. What tools they currently use predicts whether you can displace, integrate with, or wait out their incumbent.

| Sub-signal | Max | Notes |
|---|---|---|
| Currently uses a direct competitor (poach signal) | 3 | If renewal date is within 90 days = +6 score. If unknown date = 3. Competitor list maintained per Thyleads client. |
| Currently uses a complementary tool we integrate with | 2 | "Add to your stack" angle is easier than "replace." |
| Currently uses a legacy tool in this category | 3 | Modernisation angle. |
| No tooling in this category (greenfield) | 1 | Greenfield is harder than people think — no urgency = no purchase. Score lower than competitor displacement. |
| On a competitor's published case study / customer page | -2 | Penalty. Publicly committed to incumbent for at least the case study lifetime. |
| Recently switched FROM seller's category (last 12 months) | -10 | Penalty. Won't re-evaluate until 18-24 months out. |

Source: BuiltWith, Wappalyzer, Clay/Crustdata enrichment, the prospect's own website footers, partner pages, press releases.

### Layer 3: Engagement & buying-committee (20 points)

The existing rubric has Engagement at 20. This section reframes it to include buying-committee completeness — which materially improves scoring accuracy in mid-market and enterprise.

| Sub-signal | Max | Notes |
|---|---|---|
| Engaged with seller's content in last 90 days (website visit, gated content download, webinar) | 6 | Hottest engagement signal. |
| Engaged on social with seller / seller's CEO content | 4 | Champion-friendly behaviour. |
| **Buying committee completeness:** all expected ICP roles present and tenured at the company | 5 | Enterprise sale needs Champion + Economic Buyer + Technical Buyer all to exist. Missing any = stuck deal. |
| **Investor overlap:** seller's investors are also prospect's investors | 2 | Warm intro path. |
| **Champion mobility:** known champion at past customer just joined this prospect | 5 | The single highest-converting individual signal. Tracks per-client. |
| Mutual LinkedIn connections >10 with the SDR / AE | 2 | Warm path. |

The "champion mobility" signal compounds over time and is one of Thyleads's most defensible data assets — track every champion at every customer; when they change companies, the new company auto-promotes to Top Priority.

### Layer 4: Why-now (10 points)

Existing rubric. The single sentence in the AI Research Agent's why-now snippet. Score reflects how strong the trigger is.

| Sub-signal | Max | Notes |
|---|---|---|
| Specific current-week trigger (e.g., "they just launched a new product line yesterday") | 10 | Strongest. |
| Specific current-month trigger | 7 | Strong. |
| Recent (last 90 days) but not weekly trigger | 4 | Moderate. |
| No specific trigger, only firmographic fit | 0 | Why-now is empty. |

Why-Now is the column that goes into the email opener. A strong why-now correlates with reply rate ~2x more than firmographic fit alone.

### Layer 5: Timing multiplier (0.6× to 1.3×)

Timing is not just "send on Tuesday at 11am IST" — it is a calendar-aware multiplier on the entire score. A perfect prospect contacted in Diwali week converts worse than a 70-score prospect contacted in mid-April.

#### 5a. Indian fiscal calendar windows

The Indian fiscal year runs April-March. This dictates buying behaviour at every Indian company that operates on Indian GAAP (which is most of them).

| Window | Multiplier | Rationale |
|---|---|---|
| **Mar 15 – Apr 30 (FY transition)** | 1.3× | Highest-converting window. New FY budgets just deployed. CXOs have line items to spend against. |
| **May 1 – Jun 30 (Q1 deployment)** | 1.2× | Budget is fresh, deals close fast. |
| **Jul 1 – Sep 30 (Q2 normal)** | 1.1× | No major holidays, steady buying. |
| **Oct 1 – Oct 15 (Pre-Diwali push)** | 1.0× | Last push before quiet period. |
| **Oct 15 – Nov 15 (Diwali blackout)** | 0.6× | Approximate dates, varies year to year. Replies drop 40-50%. Almost nothing closes. |
| **Nov 15 – Dec 20 (Post-Diwali recovery)** | 1.0× | Slow restart. |
| **Dec 20 – Jan 5 (Year-end quiet)** | 0.7× | Corporate Christmas, NRIs visiting. |
| **Jan 5 – Mar 15 (FY-end caution)** | 0.9× | Budgets exhausted. Some Q4 closes from FY budgets, but most "let's wait for new FY." |

For 2026 specifically: Diwali falls on **November 8, 2026** (verify per year). Treat October 25 – November 15 as the practical blackout window.

#### 5b. Industry-specific seasonality (multiplied with 5a)

| Industry | Strong window | Weak window |
|---|---|---|
| D2C apparel / jewellery / beauty | Aug-Sep (pre-festive prep), Feb-Mar (wedding pre-season) | Oct-Mar wedding season — operating heads-down |
| D2C food / FMCG | Mar-Jun (pre-summer), Aug-Oct (festive prep) | Jan-Feb |
| EdTech | Apr-Jul (admission season buy), Nov-Jan (Q4 / planning) | Aug-Oct, March |
| BFSI / Fintech | Apr-Jun (FY start), Oct-Dec (festive credit demand) | Last 10 days of each quarter (regulatory quiet) |
| SaaS B2B | Apr-Jun, Oct (pre-Diwali), Jan-Feb | Diwali blackout, Dec 20 – Jan 5 |
| Manufacturing / Industrial | Apr-Jul, Oct-Dec | Mar (year-end), Diwali, Aug (monsoon impact) |
| Healthcare / Pharma | Year-round, less seasonality | Diwali only |
| Travel / Mobility | Sep-Nov (peak season prep), Jan-Mar | Apr-Jun (peak operating) |

#### 5c. Sender-side dead zones (zero-multiplier)

Do not send during these windows regardless of prospect timing:

- Diwali day + 2 days before/after (3 days hard-blackout)
- Holi week (regional impact)
- Eid (regional impact, especially for Muslim-majority owned businesses)
- Onam week (Kerala-headquartered companies)
- Republic Day (Jan 26), Independence Day (Aug 15), Gandhi Jayanti (Oct 2) — and the day before/after if it creates a long weekend
- Last 3 days of every quarter (sales freezes, no decisions made)
- During major IPL match days for D2C/sports/fintech prospects (afternoon-evening sends underperform)

#### 5d. Day-of-week and time-of-day

From Thyleads's own outcomes data (per `Thyleads_AI_Agent_Architecture.md`): Tuesday 11am IST sends have 1.6× open rate vs Thursday 4pm. Apply per persona archetype:

| Archetype | Best window (IST) | Worst window |
|---|---|---|
| Founder / CEO | Tue-Thu, 7-9am OR 8-10pm (around their gym / family time, when they read personal email) | Mon 9am, Fri 4pm+ |
| Marketing / Growth | Tue-Thu, 10am-12pm | Mon, Fri afternoon |
| Product | Tue-Thu, 11am-1pm | Mon morning |
| Engineering | Tue-Thu, 2-4pm (after standup, before deep work afternoon block) | Mon, Fri |
| Finance | Tue-Wed, 10-11am (avoid month-end days) | Last 5 days of any month |
| HR | Tue-Thu, 10am-12pm | Mon (interview-heavy day) |
| Ops | Tue-Thu, 10am-12pm OR 4-5pm | Fri, weekends |
| Sales | Tue-Thu, 8-9am OR 6-7pm (when they're not in meetings) | Mon morning, Fri afternoon |

#### 5e. Combining the multipliers

Multiply the three components:
```
Timing_multiplier = fiscal_window × industry_season × send_time_match
```
Cap the result at 0.6 minimum and 1.3 maximum to avoid runaway scoring.

### Layer 6: Penalty multiplier (1.0× down to 0×)

Penalties multiply, they don't add. A prospect with three penalty triggers gets multiplied three times.

| Trigger | Multiplier | Notes |
|---|---|---|
| Layoffs announced in last 90 days | 0.5× | Budget freeze, hiring freeze — deep penalty. |
| Down round or distressed financing | 0.6× | Cost-cutting active. |
| Recently went through CEO/founder departure (last 60 days) | 0.6× | Vacuum. |
| In active acquisition / merger negotiation | 0.4× | Parent decides tooling. |
| Recently acquired (last 6 months) | 0.5× | Tool consolidation underway. |
| Pre-IPO quiet period (60 days before listing) | 0.5× | No new vendors signed. |
| In the middle of a public PR / regulatory crisis | 0.3× | Wrong time. |
| Major customer churn announced (>20% revenue) | 0.6× | Survival mode. |
| Recently hired competitor's product (signed contract last 90 days) | 0.2× | They just bought; won't re-evaluate for 18-24 months. |
| Public DPDPA/RBI/SEBI compliance investigation | 0.4× | Internal focus. |

If multiple penalties apply, multiply them: layoffs (0.5×) AND CEO departure (0.6×) = 0.30× total.

A penalty multiplier of 0.3× or below is effectively a soft DNC for the next 6 months. Re-evaluate quarterly. Document the penalty trigger in the prospect's row in `campaign_outcomes.csv` so the next campaign auto-respects it.

### Per-product weight calibration

Thyleads's four client segments have materially different ICP buyers, sales cycles, and signal weights. The base 100 points are redistributed per segment.

#### Seed-Series A clients (Thyleads sells lead-gen to early-stage founders selling to SMBs/D2C/early-stage)

End ICP: Founder / CEO / first GTM hire. Decisions are fast, founder-led. Best signals are recent funding + founder accessibility + growth velocity.

| Layer | Weight | Notes |
|---|---|---|
| Fit | 25 | Stage fit matters most. Sweet spot: 10-50 employees, recent seed round. |
| Intent | 35 | Hiring (15 — first marketing/sales hire is a huge signal), Leadership (5), Funding (10), Growth (5). |
| Engagement | 15 | Champion mobility weighted heavily. |
| Why-Now | 25 | Why-now matters more here than at later stages — founders care about specificity. |

#### Series B clients (Thyleads sells lead-gen to growth-stage clients selling to mid-market)

End ICP: VP / Director Marketing / Sales / Growth. Buying committee starts to form. Cycle: 6-12 weeks.

| Layer | Weight | Notes |
|---|---|---|
| Fit | 30 | Standard rubric. |
| Intent | 40 | Hiring (10), Leadership change (12 — this is the strongest signal at this stage), Funding (5), Growth (8), News (2), Tech stack (3). |
| Engagement | 20 | Buying committee completeness weighted heavily. |
| Why-Now | 10 | Standard. |

#### MarTech clients (end ICP: CMO, VP Marketing, Head of Growth at mid-market and enterprise)

| Layer | Weight | Notes |
|---|---|---|
| Fit | 25 | Marketing team size > 5 is a hard floor. Below that, no buyer. |
| Intent | 45 | Hiring marketing roles (15 — outsized weight), New CMO/CMRO in last 90 days (15), Marketing tech-stack signals (10), Growth (5). |
| Engagement | 20 | CMO accessible via stakeholder map = +5 (per `Thyleads_AI_Agent_Architecture.md` learning loop). |
| Why-Now | 10 | Standard. |

#### HRTech clients (end ICP: CHRO, VP People, Head of HR at mid-market and enterprise)

| Layer | Weight | Notes |
|---|---|---|
| Fit | 30 | HR team size > 3 is a hard floor. Headcount > 100 typically required for HR-tooling spend. |
| Intent | 45 | Employee growth velocity (12 — outsized for HRTech specifically), Hiring HR roles (10), New CHRO in last 90 days (10), Compliance/policy news (5), Tech stack (8). |
| Engagement | 15 | Standard. |
| Why-Now | 10 | Standard. |

These weight tables are starting points. The self-learning loop (Loop 2: Scoring model refinement) re-tunes them per client over time.

### Recency weighting and decay

Every intent signal carries a freshness multiplier:

| Signal age | Multiplier on the signal's score contribution |
|---|---|
| 0-30 days | 1.0× (fully fresh) |
| 30-90 days | 0.7× |
| 90-180 days | 0.3× |
| 180+ days | 0.0× (drops out of scoring entirely) |

A new CMO who joined 200 days ago contributes nothing to today's score; the same CMO joined 25 days ago contributes the full 8 points. This forces the system to prioritise prospects where the signal IS active right now.

### Composite multipliers (when 3+ positive signals stack)

Three or more strong fresh signals (each 0-30 days, each contributing >50% of its category cap) trigger a 1.15× composite bonus on the base score. This recognises that buying behaviour is non-linear: a prospect with 3 stacked triggers (new CMO + recent funding + competitor displacement signal) is exponentially more likely to convert than a prospect with one triple-strength trigger.

Cap the composite bonus at 1.20× — beyond that, you are over-fitting on noise.

### Re-scoring cadence

| Pool | Cadence | Trigger |
|---|---|---|
| Active campaign list (currently sending) | Weekly | Signal change check; if score drops below threshold, pause sequence |
| Top Priority pool | Weekly | New why-now signal detection |
| Priority pool | Bi-weekly | Standard refresh |
| Active pool | Monthly | Signal scan |
| Nurture pool | Monthly | Promotion check (signal accumulation) |
| Excluded pool | Quarterly | Eligibility re-check (penalties may have decayed, leadership may have changed) |

Auto-promote any prospect on detection of:
- New ICP-role hire in the last 30 days at a previously-Active prospect → instant Top Priority
- Penalty trigger expiry (e.g., layoffs >180 days ago) → re-score from scratch
- Champion mobility (known champion joined the prospect) → instant Top Priority

These automatic promotions are how the system catches buying windows that point-in-time scoring misses.

### What you might be missing — additional signals to consider

You listed: company type, active client lists, historical database, industry best practices, competitor's customers, hiring signals, expansion, news, ICP recently joined, employee count growth, funding news. Beyond those, several signal categories materially improve scoring accuracy that are easy to miss:

1. **Tech stack & competitor renewal timing** — knowing the prospect uses a competitor is half the signal. Knowing WHEN their contract renews is the other half. BuiltWith/Wappalyzer + LinkedIn signals (Solutions Engineer hires, RFP postings, "Vendor Manager" hires) help triangulate renewal windows.

2. **Champion mobility tracking** — every champion at every Thyleads customer should be tracked. When they change jobs, their new company is auto-Priority. This single signal compounds more than any other over time.

3. **Buying committee completeness** — a 10-person company has no committee. A 5,000-person company has 8 stakeholders. Scoring should penalise prospects where the buying committee is incomplete (missing CFO sign-off path, no Champion identified, no Technical Buyer).

4. **Investor overlap** — if Thyleads's investors also invested in the prospect, there is a warm-intro path. Track the cap tables of the top 100 prospects per quarter.

5. **Negative signals as multipliers, not flat penalties** — current rubric implicitly does flat scoring. Penalty MULTIPLIERS (this section's Layer 6) better model how Indian buyers actually behave: layoffs don't subtract 30 points, they cut effective intent in half.

6. **Recency decay on every signal** — a hire 30 days ago is not equivalent to a hire 90 days ago. Most rubrics ignore this and over-score stale signals.

7. **Composite signal multipliers** — three stacked fresh triggers convert 5-10× a single trigger. Linear addition under-scores these compounding cases.

8. **Glassdoor / customer-review trend signals** — declining employee satisfaction or app/G2 review trends are pain signals that often predict tooling-evaluation behaviour 60-90 days before it happens.

9. **Speaking circuit / event attendance** — CXOs at SaaSBoomi, Inc42, ETBrandEquity, ETHRWorld, ETCIO, NASSCOM events are publicly active and disproportionately responsive to peer-toned outreach.

10. **Compliance / regulatory triggers (India-specific)** — DPDPA enforcement deadlines, RBI circular changes for fintech, IRDAI for insurance, SEBI for listed companies all force buying decisions on calendar deadlines. Tracking these as positive signals (forced-buy windows) is uniquely valuable for India.

11. **Promoter family generation (founder-led firms)** — first-generation promoters buy differently from second-generation (more cautious) and from professional CEOs (more procurement-driven). For traditional industries (manufacturing, BFSI, retail conglomerates), this is a real signal.

12. **Tier-1/2/3 city HQ as a sophistication proxy** — Bengaluru / Mumbai / Delhi / Pune / Hyderabad HQ companies typically have shorter cycles for SaaS purchases. Tier-2/3 HQ companies (Indore, Coimbatore, Kochi, Jaipur) often have longer cycles and more relationship-led buying. Score and approach accordingly.

13. **Listed status & quarterly disclosure rhythm** — listed Indian companies (NSE/BSE) have predictable budget release cycles tied to board meetings (typically ~10 days after each quarter close). Schedule outreach to land 5-10 days BEFORE board meetings.

14. **Lookalike modelling off won deals** — instead of independent feature scoring, compute the cosine similarity of each prospect's feature vector to the average feature vector of won deals. This catches non-obvious composite patterns the rubric misses. Requires 30+ won deals before it works.

15. **Confidence scores per feature** — every signal has a confidence interval. "Hired CMO (LinkedIn-confirmed)" is high-confidence; "Likely hiring CMO (job posting referenced 'senior marketing leader')" is medium-confidence. Weight contributions by confidence to avoid over-counting low-confidence signals.

16. **Repeat-buyer signal** — if any individual at the prospect has previously bought from Thyleads's client at a prior employer, the prospect is auto-Top Priority. This is a near-certain conversion signal and should never be missed.

17. **Funding-source warmth** — if the prospect's lead investor is one of Thyleads's customers' lead investors, there is implicit social proof. Investor portfolios are public on Tracxn / Crunchbase.

### Worked example: scoring a single MarTech prospect

Prospect: a Series B Indian D2C apparel brand, 200 employees, raised Series B 5 months ago, just hired a new CMO 45 days ago, hiring 4 marketing roles, currently using a legacy email tool. Thyleads's client is selling MarTech to CMOs. Date today: April 20.

**Layer 1 (Fit):** India HQ (10) + D2C apparel (top-converting industry, 8) + 200 employees (sweet spot for MarTech client, 6) + Series B (4) + keyword fit (2) = **30/30** ✓

**Layer 2 (Intent):**
- 2a Hiring: hiring marketing roles (3 + 2 for direct reports + 1 volume + 1 velocity) = 7/12
- 2b Leadership: new CMO 45 days ago = 8/8 (with recency multiplier 0.85, so ~6.8) → call it 7
- 2c Funding: raised 5 months ago (sweet spot) = 5/5
- 2d Growth: employee growth ~12% = 3/5
- 2e News: nothing major = 0/4
- 2f Tech stack: legacy email tool, modernisation angle = 3/6
- Total Intent: 7 + 7 + 5 + 3 + 0 + 3 = **25/40**

**Layer 3 (Engagement):** No prior content engagement (0) + buying committee complete (5) + no investor overlap visible (0) + no champion mobility (0) + 5 mutual connections (1) = **6/20**

**Layer 4 (Why-Now):** New CMO 45 days ago, hiring 4 marketing roles right now = strong current-month trigger = **8/10**

**Base score:** 30 + 25 + 6 + 8 = **69**

**Layer 5 (Timing):** April 20 = FY transition window (1.3×) × D2C apparel pre-festive ramp (1.0×) × Tuesday 11am IST sending (1.0×) = **1.3×**

**Layer 6 (Penalty):** None apply = **1.0×**

**Composite:** 3 stacked fresh signals (new CMO + funding sweet spot + hiring volume), all <60 days = **1.15×**

**Final score:** 69 × 1.3 × 1.0 × 1.15 = **103** → Top Priority. Tier A persona research. Send this week.

Compare: same prospect, same date but in late October (Diwali approaching, timing 0.7×): 69 × 0.7 × 1.0 × 1.15 = 55.6 → Active. Hold for post-Diwali.

Compare: same prospect, same April date, but with layoffs announced 2 weeks ago (penalty 0.5×): 69 × 1.3 × 0.5 × 1.15 = 51.6 → Active. Hold for the layoff dust to settle.

This is what the multipliers buy you: the SAME firmographic prospect is priced differently based on when and what's happening around them. That's how you nail timing.

### Integration with the self-learning loop

Every entry in `campaign_outcomes.csv` carries the score breakdown at send time (Layer 1, 2, 3, 4, Timing multiplier, Penalty multiplier, composite, final). When replies come in, the self-learning Loop 2 (Scoring model refinement) checks:

- Did Top Priority prospects actually reply at Top Priority rates?
- Which sub-signal contributed most to false-positive Top Priorities?
- Which sub-signal was most predictive of true positives?
- Are timing multipliers calibrated correctly, or is e.g., the FY transition window over-weighted for this client?
- Are penalty multipliers too aggressive (excluding prospects who would have replied)?

Quarterly, weights are re-tuned based on the data. Per-product templates evolve per client over 6-12 months. By campaign 5-6, the rubric for each client's segment has materially diverged from the starter.

## Compliance gates (must pass before send, every campaign)

1. RFC 8058 List-Unsubscribe header live in Smartlead
2. SPF, DKIM, DMARC live on the sender domain
3. Domain warmed for 14+ days (Smartlead's warm-up tool active)
4. Max 30 sends/day per mailbox in cold ramp
5. Bounce rate <3% over rolling 24h or auto-pause
6. Spam complaint rate <0.1% — above this is a domain-burning emergency, stop and investigate
7. Pre-flight test with Mail-Tester, target 9+/10
8. **Full prospect list exclusions applied** (see "Prospect list exclusions" section above): DNC list, active customer list, past-12-month meetings, case study customers, website logo customers, AND all parent/sister brands of the above. Spot-check on 10 random survivors passed.

## Cold-start workflow: building from scratch (no TAL, no account list)

This section covers the case where the operator says "we don't have an account list yet" — common at client kickoff or when expanding into a new sub-segment for an existing client. The full pipeline from zero to campaign-ready, with explicit tool decisions at each step.

### Step 0: Read the project documents

Before pulling a single account, Claude reads:
- The client's onboarding questionnaire (defines ICP firmographics, anti-ICP, sweet-spot stage)
- Any existing `why_thyleads.html`-equivalent client positioning doc
- The client's case studies and customer-logo page (defines what "fit" looks like)
- The client's segment doc (`Series_B_.html`, `MarTech.html`, `HRTech.html`, etc.)
- `scoring_rubric.json` if it exists; otherwise use the per-product template from this skill
- Any `client_learnings.md` from prior campaigns

If these are absent, Claude flags to the operator that the cold-start cannot run cleanly without them. Don't proceed on guesswork.

### Step 1: Define the account universe (firmographics first, signals second)

**Pure firmographic universe (when ICP is well-defined):**
```
Tool: Apollo (saved search filters)
Inputs: industry tags, employee band, country=India, founded year range,
        revenue band if available
Output: domain list, typically 500-3000 raw accounts
```

**Signal-augmented universe (when ICP has a "why now" component):**
```
Tool: Crustdata (signal-based discovery)
Inputs: hiring velocity filters ("hired 5+ marketing roles in last 90 days"),
        funding filters ("Series A-B in last 12 months"),
        headcount-growth filters (">10% in last 6 months")
Output: domain list, typically 200-1000 accounts (smaller because signal-filtered)
```

**Combined universe (most campaigns):**
```
1. Crustdata pull on signal criteria → 500 domains
2. Apollo saved-search pull on firmographic criteria → 2000 domains
3. Union the two lists (dedupe by domain)
4. Output: ~2200 raw account list
```

### Step 2: Apply the six-source exclusion dedupe

**Read from project knowledge:**
- DNC list
- Active customer list
- Past 12-month meetings list
- Case study customer list
- Website-logo customer list

**Build the exclusion universe (per the existing exclusion section):**
- Normalize names (lowercase, strip suffixes)
- For each entry, run holding-company / sister-brand expansion
  - Tavily query: `"<brand>" parent company` and `"<parent>" brands`
- Append all parents and sister brands

**Dedupe the raw account list against the expanded exclusion universe.** Drop matches.

Typical attrition: 10-25% of raw list excluded.

### Step 3: Enrich the surviving universe (Apollo bulk)

Only after exclusion. Apollo bulk_enrich on the surviving domain list. Run in batches of 10 per call (per the operations playbook).

For Indian-heavy lists, expect ~70-75% match rate. Domains that don't match are usually parked or recently changed; flag for manual review or drop.

Output: enriched CSV with firmographics, headcount, growth, secondary industries, keywords, and departmental headcount.

### Step 4: Pull intent signals per account

For each enriched account, gather signals before scoring:

**Hiring (Crustdata + Apollo):**
- How many open roles in the relevant function in last 30/60/90 days?
- Is the lead's specific role being hired right now?
- Hiring velocity (new postings per month)?

**Leadership change (Apollo + Crustdata):**
- Did anyone in the ICP role join in the last 0-90 days? (Highest signal)
- Did anyone leave without replacement?

**Funding (Tavily site-targeted):**
- `"<Company>" funding OR raise site:inc42.com OR site:entrackr.com OR site:moneycontrol.com`
- Pull the most recent funding event with date

**Growth (Apollo headcount fields + Crustdata):**
- 6-month and 12-month headcount growth
- Office expansion announcements

**Tech stack / competitor (BuiltWith via Clay, Apollo keywords as proxy):**
- Currently using a competitor of the seller?
- Currently using a complementary tool?

**Page/pricing changes (Visualping/custom crawler delta log):**
- If watcher infrastructure exists for this client and these accounts, pull the last-30-day delta
- If not, this signal is unavailable for cold-start; flag to the operator

**News/awards (Tavily site-targeted):**
- `"<Company>" award OR launch OR partnership site:moneycontrol.com OR site:livemint.com`

Each signal carries: type, source URL, date, weight (per the scoring rubric for this client), recency-decay multiplier.

### Step 5: Score with the five-layer model

Apply Layer 1 (Fit) + Layer 2 (Intent) + Layer 3 (Engagement) + Layer 4 (Why-Now) + Layer 5 (Timing) + Layer 6 (Penalty) per the scoring methodology section.

Use the per-product weight table for the client's segment (Seed-Series A / Series B / MarTech / HRTech).

Bucket: Top Priority (95+) / Priority (75-94) / Active (55-74) / Nurture (35-54) / Excluded (<35).

Pick top 50 for the pilot, with industry-diversity guard (no >5 from a single sub-segment unless the campaign is sub-segment-focused).

### Step 6: Find decision-makers

For each top-50 account:

**Apollo people_search:**
- Filter by persona archetype titles (e.g., for MarTech: "VP Marketing", "Head of Growth", "CMO", "Marketing Director")
- Filter by company domain
- Pull 3-5 stakeholders per account (per the playbook 95% coverage target)

**Validation pass:**
- Apollo enrichment for current title and tenure
- Sales Navigator quick-check for "still works here?" — programmatic where possible, manual for Tier A

**Bucketing:**
- Champion (most reachable, decision influencer)
- Economic Buyer (signs the contract)
- Technical Buyer (validates technical fit)

### Step 7: Enrich contacts (email + Tier A persona research)

**For all 50 leads:**
- Email finding waterfall: Apollo → Hunter → LeadMagic
- Email verification: ZeroBounce (drop catch-all and unknown — never email these)
- Apply the persona archetype based on title + seniority

**For Tier A leads only (top 10):**
- Coresignal lookup: last 90 days of LinkedIn posts
- Tavily site-targeted searches per the standard Indian site list
- Listen Notes API search by name (if podcast appearances are signal-relevant for this client)
- For founder-led companies <500 employees: also pull the CEO's last 5 LinkedIn posts (CEO mirror hypothesis)

### Step 8: Build the per-lead signal graph

For each Tier A and Tier B lead, aggregate every signal from every source into the per-lead `signal_graph.json` artifact (per the schema in the signal graph section). Include:
- All axis 1 signals (homepage observations, page-level patterns)
- All axis 2 signals (LinkedIn posts, articles, talks, podcasts) — Tier A only
- All axis 3 signals (hiring, page changes, competitor moves, press)
- Weights, ages, decay multipliers
- The picked `axis_b1` and `axis_b2` for the email sequence

Tier C leads skip the signal graph; they use category defaults.

### Step 9: Draft emails

Per the email drafting workflow above, reading from each lead's signal graph rather than scattered CSV columns. Apply all 12 rules. Pick the strongest fresh signal for body 1; pick a different-axis signal for body 2.

### Step 10: Validation + send

Run the full 45-check validation checklist. Flag any failures for the operator. ZeroBounce final pass. Smartlead upload via the Phase 9 schema. Pre-flight Mail-Tester check.

### Cold-start time budget (for a 50-lead pilot from zero)

| Step | Time | Notes |
|---|---|---|
| Step 0 (read docs) | 15-30 min | Cannot skip |
| Step 1 (account universe) | 30-60 min | Apollo + Crustdata pulls |
| Step 2 (exclusion dedupe) | 30-45 min | Includes parent/sister-brand expansion |
| Step 3 (Apollo enrich) | 60-90 min | Bulk in batches of 10, subagent-delegated |
| Step 4 (intent signals) | 45-60 min | Mostly automated with Crustdata + Tavily |
| Step 5 (score + bucket) | 15-30 min | Deterministic rubric |
| Step 6 (find DMs) | 60-90 min | Apollo people_search + Sales Nav verification |
| Step 7 (contact enrichment) | 60-90 min | Includes Tier A Coresignal/Tavily research |
| Step 8 (signal graphs) | 20-30 min | Mostly automated aggregation |
| Step 9 (draft emails) | 90-120 min | Tier A custom, B archetype, C category |
| Step 10 (validate + send) | 30-45 min | Includes Mail-Tester, ZeroBounce |
| **Total** | **~7-10 hours** | For a 50-lead pilot from cold-start |

By campaign 3-4, this drops to ~4-6 hours as the exclusion universe is pre-built, the scoring rubric is calibrated, and the per-segment observation library is mature.

### When to NOT cold-start (use existing TAL)

If the client already has a Target Account List (e.g., from prior agency work, internal CRM, ABM list), skip Steps 1-2 and go straight to Step 3 (enrich the provided list). Always run the exclusion dedupe though — even client-provided TALs can include current customers or DNC entries by accident.



1. Read this SKILL.md.
2. Pull the seller's customer roster from their website (case studies, customer page, success stories). Build a per-segment social-proof table specific to them. Don't reuse another client's roster.
3. **Apply the full prospect list exclusion routine** (see "Prospect list exclusions" section). This is six sources, not three: DNC list, active customer list, past-12-month meetings, case study customers, website-logo customers, AND the parent/sister-brand expansion for every name in the above five sources. Run this dedupe BEFORE scoring/enrichment, never after — running after wastes Apollo and Tavily credits on prospects you'll throw out.
4. **Score the eligible pool against the five-layer scoring model** (see "Account scoring methodology" section). Apply the per-product weight calibration for the client's segment (Seed-Series A, Series B, MarTech, or HRTech). Compute base score (Fit + Intent + Engagement + Why-Now), apply Timing and Penalty multipliers, apply composite bonus where 3+ fresh signals stack. Bucket into Top Priority / Priority / Active / Nurture / Excluded. Pick top 50 by final score, with industry-diversity guard (no >5 from a single sub-segment unless the campaign is sub-segment-focused).
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

Refines the five-layer scoring model (see "Account scoring methodology" section). Applied per-product (Seed-Series A, Series B, MarTech, HRTech each get their own weight refinement).

If using the deterministic five-layer model, retune feature contributions quarterly based on what predicts positive reply.

**Per-layer questions to ask:**
- **Fit:** Are firmographic features predicting positives, or did one industry over-perform and skew the weights? Should employee-band sweet-spots tighten or widen?
- **Intent — Hiring:** Which hiring sub-signal converted best (ICP role, direct reports, proxies, volume, velocity)? Are the weights calibrated correctly?
- **Intent — Leadership:** Did the 0-90 day window outperform 90-180? Should the Honeymoon weight rise or fall for this client?
- **Intent — Funding:** Did the 3-12 month sweet spot hold up? Was raised-in-last-3-months over-weighted (money-not-deployed-yet trap)?
- **Intent — Tech stack:** Did competitor displacement convert better than greenfield? Should we increase weight on poach signals?
- **Engagement — Champion mobility:** Did this signal convert at the predicted rate? It's the highest-confidence individual signal — never under-weight it.
- **Why-Now:** Are current-week triggers actually outperforming current-month? Calibrate weights.
- **Timing multiplier:** Did the FY transition window (1.3×) actually deliver 1.3× reply rates? Or is the effect smaller? Re-calibrate.
- **Penalty multiplier:** Did penalty-flagged prospects convert worse, as expected? Or are some penalties (e.g., recent acquisition) less severe than scored? Adjust.
- **Composite multiplier:** Did 3-stacked-signal prospects actually convert non-linearly better? If yes, keep the bonus. If no, drop it.

**Simple approach** (works for most clients, no ML needed):
- For each sub-signal, compute reply rate of positives among prospects scoring within that sub-signal's range
- Reweight features so highest-reply-rate sub-signals get higher score weight
- Drop sub-signals whose correlation with positive reply is under 0.05 — they're noise

**Advanced approach** (only for clients with 1000+ outcomes logged):
- Train a logistic regression with all 6 layers' sub-features → P(positive reply)
- Use predicted probabilities as the new score
- Cross-validate on a held-out 20% to avoid overfit
- Retrain quarterly, never on every campaign (overfits to recent variance)

**Lookalike modelling extension** (after 30+ won deals): compute the cosine similarity of each prospect's feature vector to the centroid of won-deal feature vectors. Use this similarity as an additional signal weighted alongside the deterministic score. Catches non-obvious composite patterns the rubric misses.

**Minimum data threshold:** 100 sentiment-tagged outcomes per Thyleads product segment before retuning weights. 1000+ before training a model. Below 100, just track and don't change.

#### Loop 3: Observation angle and axis refinement

Two-level learning, not one.

**Level 3a: Angle within axis.** For each `segment × observation_angle` combination, compute the positive reply rate. Promote winning angles into the per-segment quick-reference. Demote losing ones.

Example: for D2C apparel, if "size guide depth" angle gets an 8% positive reply rate and "PDP image stack" gets 2%, future D2C apparel campaigns should lead body 1 with size guide depth, not image stack. PDP image stack moves to body 2 or gets dropped.

**Level 3b: Axis comparison (new in v9).** For each `segment × persona_archetype × observation_axis` combination, compute the positive reply rate. Identify which axis converts best for which buyer profile.

Example outcomes from Loop 3b that have been observed in similar Indian B2B stacks:
- For **MarTech CMO leads**, axis 2 (lead-level — their LinkedIn posts about marketing strategy) outperforms axis 1 (homepage observation) by 1.8-2.5x positive reply rate. Push Tier A toward axis 2.
- For **HRTech CHRO leads**, axis 3 (activity-level — recent hiring posts they personally posted) outperforms both axis 1 and axis 2. Push Tier A and Tier B toward axis 3 when fresh signals exist.
- For **Founder/CEO leads at sub-100-employee companies**, axis 1 (homepage observation) outperforms axis 2 because most Indian founders at that stage don't post regularly enough on LinkedIn to give axis 2 a fresh signal.
- For **Engineering leaders (CTO/VP Eng)**, axis 1 (technical surface like API docs, SDK, status page) outperforms axis 2 by a wide margin — engineers don't read emails about their own LinkedIn posts.

These are illustrative — the actual mapping is learned per-client over 200+ sends. The Tier A research workflow is then customised: which axis to prioritise for each persona archetype × segment cell.

The per-segment quick-reference table in this skill is updated **per-client** based on what works for that client, even if the same skill is reused across clients. Each client gets their own observation library AND their own per-archetype axis priority that diverges from the starter table over time.

**Minimum data thresholds:**
- Loop 3a (angle within axis): 30 sends per `segment × angle` cell
- Loop 3b (axis comparison): 50 sends per `segment × archetype × axis` cell

Below those thresholds, treat results as provisional.

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
- **v9 (current):** v8 + a full account scoring methodology section that EXTENDS Thyleads's existing 100-point rubric (Base Fit 30 + Signals 40 + Engagement 20 + Why-Now 10) with three operational additions: (a) Timing as a first-class multiplier (0.6× to 1.3×) tied to the Indian fiscal calendar, industry seasonality, sender-side dead zones (Diwali blackout, year-end quiet, last-3-days-of-quarter), and persona-specific send-time windows. (b) Penalty multipliers (1.0× down to 0×) for recent layoffs, down rounds, acquisitions, PR crises, recent competitor signings — multiplied not subtracted. (c) Per-product weight tuning across all four Thyleads client segments (Seed-Series A, Series B, MarTech, HRTech). Plus expanded intent taxonomy (six sub-categories), recency decay on every signal, composite multipliers for stacked fresh signals, and 17 additional signal categories the user did not initially mention (champion mobility, investor overlap, lookalike modelling, regulatory triggers, promoter generation, tier-2/3 city HQ, etc.). India-only constraint formalised at the top of the skill. The five-layer model: Final = (Fit + Intent + Engagement + Why-Now) × Timing × Penalty.
- **v10 (current):** v9 + a major readability tightening triggered by a real VWO/MediGence email that was too dense to read in one shot. Three rule-level changes: (a) Rule 4 now caps average sentence length at 10 words, max 14 words, with a 15-second scan-time target — and word counts dropped from 90-120 to 60-100 for body 1. (b) Rule 5 now requires paragraphs of 1-2 sentences max, single-sentence paragraphs encouraged, with explicit mobile-first whitespace formatting (vertical-stacked fragments, breathing room as functional). (c) Rule 10 expanded to a "5th-grade reading level" mandate with a banned-vocabulary table covering 35+ corporate/SaaS-speak words (leverage, optimize, scale, validated, measurable, persona-based, robust, comprehensive, strategic, synergies, etc.) plus a speak-like-a-friend test. Anatomy examples rewritten to demonstrate the new style — 7-paragraph body 1, ~75 words, average 9-word sentences. Five new validation checks (sentence-length scan, banned-vocab scan, paragraph density, read-aloud test, 15-second scan test).
- **v11 (current):** v10 corrected after the rewrite of the VWO/MediGence email tested too short, too punchy, and too American in tone. Indian buyers want warmth and empathy, not US-style declarative punch sequences. Three rebalances: (a) Rule 4 sentence length recalibrated to average 10-12 words and max 18 (was 10/14) — 4-6 word staccato now explicitly flagged as US-coded and discouraged. Word counts bumped back up to 80-130 for body 1 (was 60-100). (b) Rule 5 paragraph rules eased to 1-3 sentences per paragraph with explicit guidance against over-fragmenting. (c) Rule 10 split into two halves: vocabulary discipline (kept) AND a new "conversational warmth — Indian buyer register" half covering empathy markers, hedging, generous CTA framing, and the lead-with-empathy-then-diagnose principle. Anatomy examples rewritten again with empathy markers and hedging throughout. Three new failure modes added: US-style punch sequences, diagnosing without empathizing, imperative CTAs. Three new validation checks: no-staccato check, empathy marker present, generous CTA check.
- **v12 (current):** v11 + three more refinements after a second pass on the VWO/MediGence email. The opener used "hero" (marketing jargon), the subject lacked the prospect's first name, and the whitespace was insufficient versus a sample reference Thyleads email. Three rule-level changes: (a) Rule 1 (Subject line) reformatted — first name now mandatory in every subject, format becomes `FirstName, [2-4 word observation]`, total 3-5 words and ≤32 chars, internal-team-feel test added, curiosity test added, anti-clickbait clause added. (b) Rule 2 (Opener) restructured around "the first sentence carries the entire email" — three new requirements: plain language (no jargon, even functional terms like `hero`, `CTA`, `funnel`, `persona` banned in line 1), curiosity-sparking specificity, observation-not-diagnosis. New strong/weak first-line pattern lists. (c) Rule 5 strengthened with the "reference style" pattern (5-paragraph block diagram) and explicit minimum paragraph-break counts. New first-line jargon banlist added to Rule 10 covering 13 marketing/sales/product jargon items that are banned in line 1 but allowed later. Anatomy examples rewritten yet again with `Gaurav, your cart cod` style subjects and "one moment kept tripping me up" style openers. Five new validation checks: first-name-in-subject, first-line jargon scan, first-line attention test, whitespace pattern check.
- **v13 (current):** v12 + three-axis observation model triggered by a real campaign test where output started feeling templatey across a 50-lead batch despite individual emails being well-personalised. Diagnosis: every email opened with axis 1 (company-level surface — homepage, checkout, KYC, category page) creating structural sameness. Three additions: (a) Three-axis model formalised — Axis 1 (company-level, default), Axis 2 (lead-level — the person's LinkedIn posts/articles/talks), Axis 3 (activity-level — fresh hiring posts/launches/awards). (b) Per-tier observation protocol with axis priority: Tier A combines axes 2/3/1 with sequence-level rotation; Tier B uses axis 1 with batch-level diversity; Tier C category defaults. (c) Observation diversity rule at the batch level — no observation type used in >30% of leads, no >5 consecutive same-axis leads, sequence-level body 1 ↔ body 2 axis rotation. Tooling additions: Tavily alone cannot reach axis 2 (LinkedIn blocks scraping); Coresignal (or Proxycurl/PhantomBuster) added for axis 2, Crustdata for axis 3, with site-targeted Tavily searches for Indian press/conference/Substack content. CSV schema extended: `observation_axis_b1`, `observation_axis_b2`, `observation_source_b1`, `observation_source_b2`, `observation_signal_age_days`. Loop 3 (self-learning) split into 3a (angle-within-axis) and 3b (axis comparison per persona × segment) with 50-send threshold for axis comparisons. Five new validation checks (axis logged, source verifiable, batch diversity, sequence rotation, axis-2 freshness). Cost/time per 50-lead pilot rises ~35-55 min for the additional axis 2/3 research; offset by Loop 3b dialling axis effort per client over time.
- **v14 (current):** v13 + three v10-level upgrades after stress-testing the v13 architecture against a "best outbound system on the planet" review. Three additions: (a) Axis 3 expanded into four sub-categories (3a hiring, 3b page/pricing/careers changes, 3c competitive activity, 3d press/launches/leadership). 3b and 3c are entirely new — they catch website changes and competitor moves that nothing else in the stack catches. (b) Per-client behavioral watcher infrastructure (Visualping at <200 accounts, custom Python crawler at scale) covering 5 standard pages per top-200 in-pipeline accounts plus the prospect's top 3 competitors. One-time setup, weekly delta log, becomes the source for axes 3b and 3c. (c) Per-lead signal graph as a JSON artifact aggregating ALL signals (Apollo + Tavily + Coresignal + Crustdata + behavioral) into one weighted view with age, decay, and conflict-detection. The email-drafting subagent reads from the graph instead of scattered CSV columns, so the strongest fresh signal always wins regardless of source. This is positioned as the single highest-leverage upgrade in v10 — without it, more enrichment tools just create more scattered fields. Five new validation checks (signal graph built, conflict check, behavioral watcher coverage, competitive watcher coverage, axis-2 freshness reinforced). Maintenance artifacts grow from 5 to 7 (signal graphs directory + behavioral signals CSV added). Cost/time rises ~20 min per campaign for graph building, plus 3-4 hours one-time-per-client for watcher setup. Explicit decisions to NOT add Clearbit (sunset), Crayon/Kompyte (overkill at current scale), or PDL identity stacking (premature).
- **v15 (current):** v14 + tool intelligence layer making Claude the orchestrating brain of the system rather than a copywriter that calls tools. Three additions: (a) Tool intelligence section with the full Thyleads tool stack table (Apollo, Crustdata, Coresignal, Tavily, Sales Nav, Clay, Hunter/LeadMagic, ZeroBounce, Visualping, Listen Notes, Tracxn/Inc42/MoneyControl) defining what each is good at, what it's NOT good at, and cost shape. Plus decision trees per task shape (build account list, score, find DMs, enrich, write emails) showing exactly which tools to chain in which order. Plus site-targeted Tavily query templates for Indian press and conferences (inc42.com, entrackr.com, moneycontrol.com, livemint.com, economictimes.indiatimes.com, yourstory.com, ken.in, saasboomi.in, nasscom.in, ethrworld.com, etcio.com, etbrandequity.com, etcfo.com, etretail.com). (b) Project documents reading protocol — Tier 1 docs (always read at task start: ICP brief, client_learnings.md, scoring_rubric.json, case studies, segment doc, why_thyleads), Tier 2 docs (read when task involves them), Tier 3 docs (read on operator request). Defines what Claude extracts from each and how it influences tool decisions. (c) Cold-start workflow — full pipeline from zero to campaign-ready when no TAL exists, with explicit tool decisions at each of 10 steps and a 7-10 hour total time budget for a first 50-lead pilot. Plus Thyleads Dashboard integration framing — Claude reads project knowledge, decides tools, calls via MCP, writes artifacts back, surfaces gates to the operator. Decision rule: use minimum set of tools needed (2-3 typically), not all available tools. Tool recommendations to the operator when current stack can't do the job (e.g., flag Coresignal need when axis 2 demanded but no LinkedIn API access).
- **v16 (current):** v15 + the deterministic middle layer that v15 was missing. Diagnosis (from a structured external review): v15 had inputs (signals, weights, axes, tools) and outputs (the 12 email rules) but no signal-to-insight conversion layer, so Claude had to re-derive implications/angles/hooks from scratch on every draft, and the same signal could become wildly different emails across a batch. Five additions: (a) Four-stage pipeline contract with explicit input/output per stage — Stage 1 Signal Collection, Stage 2 Signal Selection, Stage 3 Insight Generation, Stage 4 Email Writing. Each stage runs separately. (b) Deterministic signal selection formula: signal_score = base_weight × recency_factor × persona_relevance × axis_priority × business_impact. Resolves ties, prevents Claude from picking the easiest or freshest signal when a better-tied-to-value-prop signal exists. (c) Signal → insight chain pattern: every signal goes through Signal → Implication → Risk → Angle → Hook before prose is written. Forces leverage instead of complimenting. (d) Angle library — for every signal type the system catches, the default and alternative angles plus picking rules. Same hiring signal maps to "funnel scrutinized" for CRO sellers vs "messaging audit" for messaging sellers. The missing artifact. (e) Axis 2 operationalization recipe — explicit 4-step procedure for converting a LinkedIn post into a hook (read content → identify stated belief → map to a surface gap → frame as observation not accusation). Anti-patterns documented (no "great insights," no compliments without leverage). Plus constrained body templates per body 1/2/3 that lock structure so Stage 4 isn't inventing shape AND content simultaneously. New artifact: per-lead `insight_brief.json` between signal graph and final prose. CSV schema extended with primary_signal_score, secondary_signal_score, axes, ages, angle_b1, angle_b2 for Loop 3 to learn from. Five new validation checks (pipeline executed, formula applied, library mapping verified, insight chain present, axis 2 leverage check). What this engine does NOT solve: prose voice (still Rule 10), validation (still 50 checks), human Tier A review (still required), self-learning (Loop 3 still tunes per client). It does solve: inconsistency across a batch caused by Claude making different inference choices on different drafts.

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
- **Adding penalty signals as flat subtractions instead of multipliers** → a 100-score prospect with layoffs and a -30 penalty (= 70) still looks Active. The same prospect under multipliers (× 0.5) effectively scores 50, correctly demoted. Penalties multiply.
- **Treating timing as a send-time question only** → "Tuesday 11am IST" is the smallest-impact timing decision. The biggest timing decisions are the fiscal calendar (FY transition window 1.3×, Diwali blackout 0.6×) and industry seasonality. Always apply Layer 5 multiplier to base score, not just send-time tweaks.
- **Letting stale signals score** → a "new CMO" who joined 9 months ago is no longer a new CMO. Recency decay on every intent signal is non-negotiable.
- **Over-weighting funding signals** → recent funding is the most-tracked signal in B2B and therefore the most-saturated trigger in cold outbound. Indian buyers see "saw your Series C" emails daily. Funding contributes 5/40 to intent in this rubric, intentionally less than hiring (12) and leadership change (8). Resist the urge to inflate it.
- **Skipping per-product weight calibration** → Seed-Series A scoring weights work poorly for HRTech and vice versa. Always start with the per-product table, not a generic rubric.
- **Sending to non-India HQ prospects "because they have an India office"** → unless the campaign brief explicitly confirms India-decisioned buying, default-exclude. The geography hard gate exists for a reason.
- **Forgetting champion mobility tracking** → the single highest-converting individual signal is "a known champion at a past customer just joined a new company." This requires maintaining a per-client champion database. Without it, this signal never fires and Thyleads loses its biggest compounding moat.
- **Scoring without the breakdown** → if the outcomes CSV only has `score_final` and not `fit_score`, `intent_score`, etc., the self-learning Loop 2 cannot tell which sub-signal drove a prediction. The decomposition is what makes the model improvable.
- **Writing for the marketer who wrote the email, not the busy CMO reading it** → if your email sounds like a marketing-strategy doc, you've failed. The CMO reading at 11pm wants warm prose that respects them, not a slide deck in email form.
- **Defaulting to corporate vocabulary because it sounds professional** → "validated changes," "measurable improvements," "heavy dev effort," "leverage," "scale" all signal vendor-pitch immediately. These words are banned by Rule 10. Replace with plain English every time.
- **US-style punch sequences** → strings of staccato declaratives like "Same headline. Same button. So they leave." read as American sales pattern, not Indian conversational tone. Indian buyers find these jarring and salesy. Sentences should be 8-12 words on average. The buyer should feel addressed, not punched at.
- **Diagnosing without empathizing** → "Your hero is broken" is a US-style diagnostic statement. "Your hero is doing a lot of work right now" is the same observation framed with empathy. Always lead with empathy, then diagnose. Indian buyers want to feel HEARD before being TOLD.
- **Imperative CTAs** → "Let's set up a call," "Book time on my calendar," "Hop on a quick chat" all read as vendor asking for the buyer's time. "Happy to share if useful" or "Would a quick walkthrough be useful?" reads as peer offering value. Always frame the CTA as a generous offer, not a request.
- **Forgetting hedges** → unhedged absolutes ("This always works," "This is the answer," "Just leaves") feel aggressive to Indian buyers. Use "often," "tends to," "likely," "many teams find" liberally. Hedging is not weakness — it's respect.
- **Treating white space as wasteful** → white space is functional. It's how the buyer's eye finds the next idea. A 100-word email with breathing room outperforms a 100-word email crammed into 3 paragraphs.
- **Forgetting the email will be read on a phone** → most Indian buyers read on mobile. Long sentences wrap awkwardly on phone width. Test mentally on phone width before sending.
- **Over-fragmenting paragraphs** → the opposite failure of cramming. Breaking a flowing 2-sentence paragraph into 5 single-sentence paragraphs creates choppy punch-line rhythm. Single-sentence paragraphs are useful for the opener and the CTA, not throughout. Trust paragraph rhythm to do work.
- **Subject without first name** → in v8, every subject contains the prospect's first name. Subjects without it fail even before being read; the email looks like volume blast in the inbox.
- **Marketing jargon in the first sentence** → "your hero is doing a lot of work", "your CTA placement is interesting", "your funnel has friction" all signal marketing-audit immediately. Even if the buyer is a CMO who knows these words, the email reads as vendor-coded. Plain language in line 1, always. Industry vocab can appear later.
- **First sentence is vague or generic** → "your homepage stood out", "your work looks impressive", "I came across your site" all fail to earn the second sentence. The first sentence must contain something specific and curiosity-sparking — a number, a tradeoff, a named element. If the first sentence could plausibly have been written about any company in the segment, rewrite.
- **First sentence diagnoses instead of observes** → "Your homepage doesn't segment your visitors well" is diagnosis, which triggers defensiveness in Indian buyers. "Was on your homepage and noticed three very different visitors landing in the same place" is observation, which invites engagement. Always lead with what you saw, not what's wrong.
- **Wall of text disguised as short paragraphs** → 80 words crammed into 3 paragraphs reads worse than 110 words spread across 5 paragraphs with breathing room. Whitespace is functional. Always check the phone-screen mental scan.
- **Every email opens with axis 1** (company-level surface) → output starts feeling templatey across a 50-lead batch even though each individual email is well-personalised. Mix axes 1, 2, and 3 across the batch. The pattern, not the personalisation, is what makes it feel mass-produced.
- **Trying to source axis 2 with Tavily alone** → LinkedIn blocks public scraping. Tavily will not reliably catch the lead's LinkedIn posts. For axis 2, either invest in Coresignal/Proxycurl/PhantomBuster, OR concede that axis 2 is unavailable for this campaign and rely on axes 1 and 3.
- **Inventing axis 2 observations because it sounds personalised** → "Saw your post about scaling D2C" with no actual post URL is fabrication. The validation checklist enforces a verifiable URL for every axis 2/3 observation. If no source exists, downgrade to axis 1.
- **Using stale axis 2 signals** (LinkedIn posts older than 30 days) → the lead may have posted 10 things since. Referencing a 60-day-old post signals "I just searched their profile for anything to use." Freshness threshold is ≤30 days for axis 2, ≤30 days for axis 3.
- **Forgetting axis rotation in the 3-step sequence** → if body 1 leads with axis 2 and body 2 also leads with axis 2 ("saw another LinkedIn post you wrote..."), it reads as stalker-y. Body 1 axis 2 → body 2 axis 1 (or axis 3) → body 3 breakup.
- **Skipping the observation diversity audit on the batch** → even with the per-tier protocol, 50 leads can end up with 35 "homepage" observations if no batch-level check runs. The 30%-cap-per-observation-type rule prevents this. Programmatic check before CSV write.
- **Treating signal graph as optional metadata** → if the email-drafting subagent reads from CSV row fields instead of the per-lead signal graph, valuable signals from secondary sources get silently dropped. The strongest signal must always win, and only the graph enforces that. Make graph-read mandatory in the drafting workflow.
- **Adding more enrichment tools without unifying their output** → ChatGPT was right on this point. More tools without a unified signal graph just creates more scattered fields. Each new tool should write into the per-lead graph, not a parallel CSV column. The graph is the integration point.
- **Skipping behavioral watcher setup in week 1** → axis 3b is the highest-leverage axis 3 sub-signal, and it requires watcher infrastructure that takes 3-4 hours to set up per client. Skipping setup means the first 4-5 campaigns leave this axis empty. Bake watcher setup into the 14-day onboarding playbook (Day 8 — Infrastructure setup).
- **Trying to build axis 3c with paid CI tools (Crayon, Kompyte) at this stage** → enterprise-priced, overkill for Indian B2B at current scale. Manual quarterly competitor list curation plus Visualping watchers on competitor pricing/careers/product pages covers 80% of the value at 5% of the cost. Revisit Crayon-tier tools if scale crosses 50+ clients.
- **Letting signal conflicts go through to send** → if the graph contains contradictory signals (axis 2 says growth, axis 3b says careers page just removed roles), sending into the conflict reads as "you didn't actually look." Always flag conflicts for human review. The validation checklist enforces this.
- **Cramming all four pipeline stages into one prompt** → produces inconsistent output. Stage 1 collects signals, Stage 2 picks the winner with the formula, Stage 3 builds the insight brief, Stage 4 writes prose. Each stage has its own output. Skipping the staging is what makes the same signal become wildly different emails across a batch.
- **Picking the freshest signal instead of the highest-scoring signal** → freshness alone doesn't make a signal good. A 1-day-old generic homepage observation can score lower than a 7-day-old hiring post that's directly tied to the seller's value prop. The formula handles this; trusting "recency" alone fails.
- **Complimenting the lead's content instead of leveraging it** → "Saw your post — great insights!" is the most common axis 2 failure. The leverage test: removing the post reference must change what the email says, not just dress it up. If the email still works without the reference, the reference was decorative.
- **Forcing a weak signal into a hook** → if no signal scores above 0.30 on the formula, the lead drops to category default (Tier C-style). Don't try to make a 0.15-score signal sound important. The engine fails visibly; weak hooks fail invisibly and damage the campaign.
- **Skipping the angle library lookup** → "I'll figure out the angle from the signal" is what produces inconsistency across a batch. Same signal type gets the same angle (default) unless the seller's value prop overrides to the alternative. The library is the lookup table; use it.
- **Writing prose without filling the body template beats** → the body 1 template has 5 beats (hook, implication, risk, solution+proof, CTA). All five must be present. Missing the risk beat or skipping the social proof beat produces a flat email. The structure is given; the prose is judgment within structure.

## Cost / time targets per 50-lead pilot (v10 with three-axis observation + behavioral signals + signal graph)

**Per-tool credits/calls:**
- Apollo: ~600 enrichment + ~50 stakeholder = ~650 credits
- Tavily: ~26 axis 1 searches + ~20-30 axis 2/3 site-targeted searches for Tier A and B + ~10 parent/sister-brand = ~60-70 total
- Coresignal (or Proxycurl): ~10 Tier A leads × 1 person lookup = ~10 lookups (~$0.10-1 per lead depending on plan)
- Crustdata: usage stays within existing plan, used for activity-level signals
- Visualping (or custom crawler): one-time per-client setup, ongoing weekly delta monitoring runs without per-campaign cost
- ZeroBounce: ~50 verifications, well within standard plan

**Subagent runtime per 50-lead campaign:**
- Pipeline (enrich → score → stakeholder → axis 1 research → draft → format): ~25-30 min
- Tier A axis 2 + axis 3 research on top 10 leads: 7-10 min per lead = ~70-100 min
- Tier B observation rotation across batch: ~15 min total
- Signal graph build per Tier A and B lead (40 leads): ~15-20 min total (mostly automated aggregation)
- Behavioral signal pull from `behavioral_signals.csv` for the campaign list: ~5 min
- **Total per 50-lead campaign: ~130-170 min** (up from ~110-150 min in v9 — the extra ~20 min is the signal graph build + behavioral pull)

**Human review time:**
- ~30 min on the 5-10 sample emails before mass send
- ~10 min on observation diversity audit (does the batch show variety across axes?)
- ~5 min on signal conflict review (any leads flagged for contradictory signals?)
- ~20 min per campaign close on reply-tagging and postmortem

**One-time per-client setup costs:**
- Behavioral watcher setup (top 100-200 accounts × 5 standard pages each): ~3-4 hours of operator time, week 1 of engagement. Pays back across every subsequent campaign for that client.
- Competitor list curation (3-5 competitors per ICP segment): ~1 hour with the client, refreshed quarterly.

**Tooling cost additions for v10 (recommended, in priority order):**
- **Coresignal** (axis 2): ~$300-500/mo, strongest India coverage for LinkedIn person + post data
- **Visualping** (axis 3b/3c): ~$50-200/mo per client at 100-200-account scale; OR custom Python crawler (free, ~200 lines) at higher scale
- **Listen Notes** (axis 2 podcast): ~$15-50/mo, optional, only if podcast appearances are a major signal source for the client's ICP

**What ChatGPT recommended that's NOT being added:**
- **Clearbit** — being sunset post-HubSpot acquisition, redundant with PDL/Apollo
- **Crayon / Kompyte** — enterprise-priced, overkill for Indian B2B at current scale; manual quarterly competitor monitoring + Visualping covers the same ground at 5% the cost
- **PDL / Clearbit / FullContact identity stacking** — useful at 10x current scale, premature now; Apollo + Crustdata coverage is sufficient through 2026

**Cost compounding:**
After campaign 3-4, the per-campaign cost drops by ~20% as the self-learning loop reduces wasted Apollo credits on prospects who would have been negative-tagged anyway, and as the observation library narrows to known winners (less Tavily research needed). The axis-2 ROI specifically is validated by Loop 3 (observation angle refinement) — if axis 2 doesn't outperform axis 1 for a given client's ICP after 200+ sends, the Tier A axis-2 research time is dialled down for that client. Behavioral watchers compound the most: setup is one-time, but every campaign after week 1 reads from the accumulated delta log.

## Maintenance and operator handover

Every client engagement maintains seven living artefacts that this skill operates on:

1. `exclusion_universe.csv` — the six-source exclusion list, refreshed per campaign
2. `campaign_outcomes.csv` — the append-only learning data, growing over time, with full score decomposition per row
3. `icp_changelog.md` — every ICP change with the data behind it
4. `persona_subject_library.md` — per-archetype top-3 subjects for THIS client, diverged from the starter
5. `scoring_rubric.json` — the per-product weight table for THIS client (started from the relevant Thyleads product template, retuned per Loop 2 over time), with timing multipliers, penalty triggers, and signal weights versioned
6. `signal_graphs/` directory — one JSON per active lead aggregating all signals across all axes with weights, ages, and decay state. The connective tissue between enrichment and email drafting.
7. `behavioral_signals.csv` — append-only log of detected page/pricing/careers/product changes on prospect domains AND on competitor domains. Source for axis 3b and 3c hooks.

When an operator (SDR, AE, or analyst) hands off a client to another operator, these seven files plus the latest campaign postmortem ARE the handover. Without them, the new operator restarts from scratch and burns 3-4 campaigns of accumulated learnings.