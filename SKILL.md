---
name: india-cold-email
description: Use this skill when drafting B2B cold email campaigns aimed at Indian buyers. Calibrated against the iQuanta winner email template (1.24% reply rate, 54% positive reply rate on a real VWO outbound run, May 2026). Produces direct value-led emails with a personal day-aware greeting, soft category-level observation grounded in the prospect's company name, first-person "I" voice, the seller's product named directly with three blue-chip social proofs stacked in one line, a low-commitment CTA, and a sign-off — all wired through Smartlead-level template variables so the body stays portable across senders.
---

# India Cold Email — v9 (calibrated to the iQuanta winner)

## Why v9

v6/v7/v8 over-engineered for "AI tell avoidance" with strict observation rules, second-person voice, and one social-proof brand. The empirical Indian B2B winner — the iQuanta email sent on the VWO pilot in May 2026 — broke those rules and hit **1.24% reply rate, 54% positive reply rate**. That outperforms v8's targets by 2-3x. v9 codifies what actually converted.

## The canonical winner email (always reference this)

```
Subject: Indrajeet, Improving UX & Conversions

Happy Friday Indrajeet,

I was checking out iQuanta's website and noticed a few areas where users might face
conversion leaks, trust gaps, or UX friction. Often, these don't require a full
redesign. Even small, validated changes can create measurable improvements.

That's exactly what VWO helps with. Through A/B Testing, Behaviour Analytics, and
Personalization, brands like ICICI Bank, Wakefit, and TVS Motor identify where
visitors hesitate, test improvements safely, and personalize experiences for
high-value users without heavy dev effort.

Would you be open to a quick 20 min chat to explore how iQuanta could benefit
from this?

Best,
```

Every body Claude writes for an Indian B2B prospect should be a near-isomorphism of this template. Same shape, same voice, same paragraph weight. The only things that change per lead are: the prospect's first name, their company name, the soft category-level observation phrasing, the three customer-brand social proofs (must match the prospect's segment), and the CTA topic.

## The 10 v9 rules

### 1. Subject line: 4–6 words, title-case, `{First Name}, {Topic}` pattern

Subjects use a personal hook + the topic the prospect cares about. Title-case is fine — empirical tests show lowercase doesn't outperform here. Length 4–6 words, ≤45 chars.

**Good (calibrated):**
- `Indrajeet, Improving UX & Conversions`
- `Priya, Reducing Drop-Off on Checkout`
- `Rohit, Lifting D2C Conversion`
- `Akshika, Better KYC Completion`
- `Subhash, Cutting Cart Abandonment`

**Banned:**
- "Quick question" / "Idea for X" / "I came across" — vendor-pitch tells
- News/funding hooks ("Congrats on Series C", "Saw your acquisition")
- Subjects with `!`, em dashes, or seller's product name
- Subjects without the prospect's first name
- All-lowercase (use proper title-case)

The three subjects in a 3-step sequence reference three different topics, not one repeated theme.

### 2. Greeting: day-aware + first name (Smartlead variable level)

The greeting is wired through Smartlead's send-time variables, not in the CSV body. Configure Smartlead to render:

```
Happy {{day_of_week}} {{first_name}},
```

Where `day_of_week` resolves to "Monday" / "Tuesday" / "Friday" etc. For Saturday/Sunday sends, fall back to "Hi {{first_name}}," — "Happy Saturday" reads like automation. The day-aware greeting beats "Hi {first_name}" by ~15% on open-to-reply rate per the VWO pilot data.

### 3. Body 1 opener: first-person "I" + soft category observation grounded by company name

Open with **"I was checking out [company]'s website and noticed…"** then a soft category-level observation that's universally true but feels personal because the company name is in the sentence.

The observation can be category-level (not page-specific). Three categories that work:
- `conversion leaks, trust gaps, or UX friction` (D2C, Ecom, SaaS — universal)
- `drop-off in your KYC and document upload flow` (fintech)
- `friction in your fee discovery and EMI flow` (EdTech)

Then immediately reassure: **"Often, these don't require a full redesign. Even small, validated changes can create measurable improvements."** This line is mandatory — it lowers the perceived ask before the prospect even gets to the pitch.

### 4. Body 1 paragraph 2: direct seller mention + three-brand stacked social proof

Lead with **"That's exactly what {seller} helps with."** Then describe the seller's three core capabilities + three brand names stacked in one sentence + the outcome verbs.

Format:
```
That's exactly what VWO helps with. Through A/B Testing, Behaviour Analytics, and
Personalization, brands like ICICI Bank, Wakefit, and TVS Motor identify where
visitors hesitate, test improvements safely, and personalize experiences for
high-value users without heavy dev effort.
```

The "without heavy dev effort" coda is mandatory — Indian buyers' #1 unstated objection is "this needs my engineering team's bandwidth." Pre-empt it.

**Three-brand social proof stacking is the #1 differentiator from v8.** Pick three brands that:
- Match the prospect's segment (BFSI prospect → bank brands; D2C apparel → apparel brands; EdTech → EdTech brands)
- Are blue-chip (recognizable to any Indian B2B leader in 5 seconds)
- Are listed customers on the seller's case-studies / customers page (verify before use)

If the seller doesn't have three blue-chip brands in one segment, mix one segment-match + two adjacent-segment blue-chips. Never invent.

### 5. Body 1 paragraph 3: short, direct, 20-min CTA referencing the company by name

```
Would you be open to a quick 20 min chat to explore how {company} could benefit from this?
```

15–25 words. The "20 min" is calibrated — "15 min" feels like a sales hack, "30 min" feels heavy. Variants:
- "Worth a quick 20 min walkthrough on how {company} could lift this?"
- "Open to a 20 min chat on what would work best for {company}?"

Always name the prospect's company in the CTA. Never use "you" alone — naming the company personalizes.

### 6. Word counts (relaxed from v8)

| Body | Min | Max | Target |
|---|---|---|---|
| Body 1 | 90 | 130 | ~110 |
| Body 2 | 70 | 110 | ~90 |
| Body 3 | 50 | 90 | ~65 |

iQuanta winner is 110 words. Don't over-trim — the warmth comes from the full reassurance + capability + proof + outcome chain.

### 7. Paragraph structure: 3 paragraphs body 1, 2–3 body 2, 2 body 3

Separator: `\n\n`. Body 1 = observation+reassure / capabilities+proof / CTA. Body 2 = light reference + new angle / proof / CTA. Body 3 = breakup acknowledgement / open door.

### 8. No greeting or sign-off in the CSV body

The body column contains ONLY the message body starting with **"I was checking out…"** for body 1, **"One more thing on {company}'s site…"** or similar for body 2, **"Wrapping up here, {first_name}…"** for body 3. The greeting (rule 2) and `Best,\n{{sender_name}}` sign-off are wired in Smartlead.

### 9. No em dashes (—), no spintax, no template vars in body

Em dash is an LLM tell. Use commas, colons, or split sentences. No `{a|b|c}` spintax. No `{{first_name}}` in the CSV body — those are added by Smartlead. The body should look like deterministic prose.

### 10. Personalization density: company name 2–3x, "you/your" ≥3, "I" 1–2x

The iQuanta email mentions the company name **3 times** (iQuanta in opener, in CTA, in close). Match this. "You/your" relaxed to ≥3 in body 1, ≥2 in body 2/3 — the warmth comes from the company name + the seller-named-directly pattern, not from second-person density.

## Body 2 — the follow-up (T+3 days)

Body 2 lightly references body 1 ("One more angle on {company}'s site…" or "Quick second thought on {company}…") and switches to a different capability the seller offers, paired with a different segment-fit social proof.

### Body 2 anatomy (95 words target)

```
One more thought on iQuanta's site, Indrajeet.

A lot of D2C and EdTech brands we work with discover that their highest-traffic
pages are also the ones doing the least heavy lifting on intent capture. Heatmaps
and session recordings usually surface the gap inside two weeks.

That's the second piece of what VWO offers. Brands like Vedantu, Unacademy, and
Online Manipal use Behaviour Analytics to convert visitor curiosity into
captured intent at higher rates without redesigning a single page.

Would the next two weeks work for a 20 min walkthrough on iQuanta's funnel?
```

Different capability than body 1 (Behaviour Analytics, not A/B Testing). Different three brands (segment-matched). Same warm tone, same direct CTA.

## Body 3 — the breakup (T+10 days)

Body 3 acknowledges the prospect is busy, opens a low-pressure door, and stops. No new pitch.

### Body 3 anatomy (65 words target)

```
Wrapping up here, Indrajeet — totally understand if testing and conversion
work isn't on iQuanta's plate this quarter.

If your CAC starts climbing on the next campaign push, or your funnel CVR
plateaus, my note is here whenever it's useful. Wishing you and the iQuanta
team a strong rest of the month.
```

Two paragraphs. ~65 words. Always close warm.

## Subject line library by persona archetype (calibrated for v9)

For Tier A leads (top 20%), customize the topic to the persona's KPI. For Tier B/C, use the archetype default.

| Archetype | Topic stub | Example |
|---|---|---|
| Founder / CEO | "your growth funnel" | `Indrajeet, Tighter Growth Funnel` |
| Marketing / Growth | "improving conversions" / "lifting CVR" | `Priya, Lifting Site CVR` |
| Product | "reducing drop-off" / "user activation" | `Rohit, Reducing Activation Drop-Off` |
| CRO / Optimization | "structured testing" / "experimentation velocity" | `Akshika, Faster Experiment Velocity` |
| Demand Gen | "campaign-to-conversion lift" | `Vikram, Campaign-to-Conversion Lift` |
| Ecommerce / D2C Head | "checkout completion" / "cart abandonment" | `Neha, Cutting Cart Abandonment` |
| Fintech / KYC | "KYC completion" / "doc upload drop" | `Subhash, Better KYC Completion` |
| EdTech | "fee discovery" / "free-to-paid step" | `Aditya, Lifting Free-to-Paid` |

## Social-proof brand stacks (segment-matched — VWO roster)

Always stack three. Verify on VWO's customer page before use. Never invent.

| Prospect segment | Three brands to stack |
|---|---|
| D2C Apparel / Fashion | Wakefit, FabAlley, Andaaz Fashion |
| D2C Beauty / Wellness | Wakefit, Mamaearth, Plum |
| Ecom Marketplace | BigBasket, Yuppiechef, eBay |
| Fintech / Lending | ICICI Bank, HDFC ERGO, PayU |
| BFSI / Insurance / Banking | ICICI Bank, HDFC ERGO, ICICI Lombard |
| EdTech | Vedantu, Unacademy, Online Manipal |
| SaaS / B2B | Restroworks, PayScale, ICICI Bank |
| Travel / Mobility | Virgin Holidays, Billund Airport, TVS Motor |
| General / Cross-segment | ICICI Bank, Wakefit, TVS Motor (the iQuanta default) |

The "general" stack — ICICI Bank, Wakefit, TVS Motor — is the validated v9 default when segment match isn't strong. It covers BFSI + D2C + automotive, signals breadth.

## Validation gates (revised from v8)

These run programmatically before the CSV ships:

1. **Subject:** 4–6 words, ≤45 chars, title-case, starts with first name + comma. No `!`, `—`, `—` characters. No banned phrases.
2. **Subject uniqueness:** 3 subjects in a row are different.
3. **Body 1 word count:** 90–130, target ~110.
4. **Body 2 word count:** 70–110, target ~90.
5. **Body 3 word count:** 50–90, target ~65.
6. **Banned openers:** body 1 free of "Saw your Series", "Congrats on", "raised", "acquisition", "launched", "new CEO". The mandatory v9 opener is "I was checking out [company]'s…" — flag if missing.
7. **Mandatory phrases in body 1:** must contain "small, validated changes" or "without heavy dev effort" (the reassurance + ease coda — empirically critical).
8. **Direct seller mention:** body 1 paragraph 2 must name the seller (e.g., "That's exactly what VWO helps with.")
9. **Three-brand stack:** body 1 paragraph 2 must list exactly three customer-brand names, comma-separated, no `&` for the last (use "and").
10. **Company name density:** prospect's company name appears 2–3 times across body 1.
11. **CTA format:** body 1 ends with a single question containing "20 min" and the prospect's company name.
12. **No greeting in body:** body 1 starts with "I", body 2 with "One" or "Quick", body 3 with "Wrapping". Never "Hi", "Hey", "Hello", "Dear".
13. **No sign-off in body:** body never ends with "Best,", "Thanks,", "Regards,", "Cheers,", or a sender name.
14. **No em dashes:** zero `—` (U+2014), zero `--`. (Hyphen-in-word is fine.)
15. **No spintax / template vars in body:** zero `{a|b}`, zero `{{var}}`.
16. **You/your density:** ≥3 in body 1, ≥2 in body 2/3.
17. **Paragraph structure:** body 1 = 3 paragraphs, body 2 = 2–3, body 3 = 2 (separator `\n\n`).
18. **Cross-pollination check:** no prospect-list company appears as a social-proof brand for another prospect.
19. **Exclusion dedupe verified:** prospect list run against the exclusion universe (DNC + active customers + past 12-month meetings + case study customers + website-logo customers + holding-company expansion).

## CSV schema (Smartlead import — same v6/v8 19-column shape)

```
email, first_name, last_name, company_short, subject_1, body_1, subject_2, body_2,
subject_3, body_3, domain, company_full, industry, employees, country,
contact_title, score, segment, observation_angle
```

`observation_angle` captures the soft category observation used in body 1 (e.g., "conversion leaks, trust gaps, UX friction" or "KYC step friction, document upload drop-off").

## Smartlead wrapper (configure once at the campaign level)

```
{{greeting}}

{{body}}

Best,
{{sender_name}}
```

Where:
- `greeting` = "Happy {{day_of_week}} {{first_name}}," — falls back to "Hi {{first_name}}," on Saturday/Sunday
- `body` = the body_1 / body_2 / body_3 text from the CSV (no greeting, no sign-off)
- `sender_name` = configured per mailbox

3-step sequence cadence: Day 0 / Day +3 / Day +10. Stop on reply.

## Per-segment quick reference (extend per engagement)

Each segment gets:
1. The most likely "soft observation" in body 1 — what category of UX/funnel friction is universal in that segment.
2. The three-brand social proof stack (matching VWO's roster).

| Segment | Soft observation (body 1) | Brand stack (body 1 paragraph 2) |
|---|---|---|
| D2C Apparel | conversion leaks, trust gaps, or UX friction | Wakefit, FabAlley, Andaaz Fashion |
| D2C Beauty / Wellness | conversion leaks, ingredient-trust gaps, or PDP friction | Wakefit, Mamaearth, Plum |
| Ecom Marketplace | category density, COD friction, or cart drop-off | BigBasket, Yuppiechef, Wakefit |
| Fintech / Lending | drop-off in KYC and document upload, or conversion leaks on signup | ICICI Bank, HDFC ERGO, PayU |
| BFSI / Insurance | quote-page friction, persona collision, or trust gaps | ICICI Bank, HDFC ERGO, ICICI Lombard |
| EdTech | fee discovery friction, EMI step drop-off, or free-to-paid leaks | Vedantu, Unacademy, Online Manipal |
| SaaS B2B | demo-form friction, pricing depth, or persona collision | Restroworks, PayScale, ICICI Bank |
| Travel / Mobility | search-form friction, fare-step drop-off, or route-page density | Virgin Holidays, Billund Airport, TVS Motor |
| Health / Diagnostics | lead-form persona collision, treatment-page tone, or trust placement | ICICI Bank, Wakefit, TVS Motor |

## Iteration history

- **v1–v4 (rejected):** US-playbook subjects, news/funding openers, spintax, 50–80 word bodies. Buyer feedback: too American, too obvious AI.
- **v5 (draft accepted):** 3-step sequences, 3–4 word lowercase subjects, page-specific observation openers, ≤120 word bodies, no greeting/signoff in body, no em dashes.
- **v6 (final, sendable in 2025):** v5 + paragraph formatting + em dashes removed.
- **v7:** v6 + six-source exclusion universe (DNC, active customers, past meetings, case studies, website logos, holding-company expansion).
- **v8:** v7 + persona-tailored subject lines, CEO mirror hypothesis, Tier A/B/C research, self-learning loop with reply taxonomy.
- **v9 (current):** v8 reset on the empirical iQuanta winner (1.24% reply, 54% positive reply rate, May 2026). Reverses six v8 rules: subjects move from lowercase observation to title-case `{First Name}, Topic`, openers move from page-specific to soft-category observation, voice moves from second-person to first-person "I", seller is named directly in body 1, social proof stacks three blue-chip brands instead of one, you/your density relaxes to ≥3. Greeting becomes day-aware Smartlead variable. CTA standardizes on "20 min chat" + company name. The exclusion universe and self-learning loop from v8 carry over unchanged — what's calibrated is the body content, not the targeting discipline.

## Common failure modes (specific to v9)

- **Reverting to lowercase 3-word subjects** — feels too cute for the persona once the buyer is at Director+ level. Title-case + first name + topic is the v9 norm.
- **Skipping the reassurance line** ("Often, these don't require a full redesign…") — empirically critical for lowering perceived ask. Don't drop it.
- **Stacking only one customer brand** — under-credentials the seller. Three is the norm; mix segments if needed.
- **Inventing customer brand names** — instant credibility kill. Pull from the seller's published customer page.
- **Forgetting "without heavy dev effort"** — Indian buyer's #1 silent objection. Always include.
- **Using "{{first_name}}" inside the CSV body** — Smartlead handles greeting/signoff. Body is plain prose.
- **Mismatched social proof to segment** — D2C apparel prospect getting an EdTech brand stack feels like cut-and-paste. Always segment-match.
