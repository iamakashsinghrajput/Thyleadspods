# Outbound Pipeline Technical Playbook

Complete step-by-step technical brief for running a 50-lead India outbound pilot from raw client intake to a Smartlead-ready CSV. Use this alongside `SKILL.md` (which covers email style/content rules). This file covers the engineering pipeline, MCP usage, code patterns, costs, and pitfalls.

This playbook is calibrated from the VWO outbound pilot run (Apr 2026). Iteration count: 6 versions, 4 of which were rejected by the buyer before the final shape locked in. The rejection reasons are baked into the rules below — do not re-litigate them on a new client.

---

## Phase 0 — Client intake and ICP synthesis

### Goal
Build a structured mental model of the seller before writing a single email. Output is a 1–2 page ICP brief that every downstream step reads from.

### Inputs you typically receive
- Onboarding questionnaire PDF (filled by the client)
- AI agent architecture or other strategy doc
- Past meetings spreadsheet (last 12 months ideal)
- Active client list (currently paying customers)
- DNC list (already-prospected accounts to skip)
- Target accounts list (the universe to score)

### Steps
1. **Read the questionnaire end-to-end.** Extract: product description, top USPs, top 3 direct + indirect competitors, common objections (with rebuttals), ICP dimensions (industry, size, traffic, geo), buying committee titles (Champion / Economic Buyer / Technical Buyer), buying triggers, KPIs they care about, language that resonates, language to avoid.

2. **Read past meetings to find the ACTUAL converting profile** — not the stated ICP. Past meetings reveal the real ICP regardless of what the questionnaire says. Check for: dominant geography (often >90% of one country), dominant industries, dominant titles, dominant deal sources (inbound vs outbound).

3. **Build a structured ICP brief** — a markdown file with: traffic threshold, geo, target industries, anti-ICP, persona definitions, objection handling matrix, language bank, signal weights.

4. **Create a deliverable Word doc / playbook** for the client team to sign off on the ICP. (Use the docx skill if asked.)

### Tools used
- File Read tool (for PDFs in context — text + PDF auto-extraction)
- pandoc / docx skill for Word doc output
- No MCPs in this phase

### Pitfalls
- Trusting the stated ICP over the actual converting profile. Always cross-check.
- Missing the "actually anti-ICP" signal — accounts the questionnaire technically includes but past meetings show never close.
- Skipping the active customer list — these will end up in your prospect list and embarrass everyone.

---

## Phase 1 — Data ingestion (Google Sheets via Drive MCP)

### Goal
Pull all required spreadsheets into structured CSVs the rest of the pipeline can use.

### MCP and tools
- `mcp__d4148d67-b9d2-431f-9068-6a2dda972577__read_file_content` — natural language / markdown export of Drive files. Best for small-to-medium files.
- `mcp__d4148d67-b9d2-431f-9068-6a2dda972577__download_file_content` — binary download. Set `exportMimeType: "text/csv"` for spreadsheets to get clean CSV. Use this for large files.
- `mcp__d4148d67-b9d2-431f-9068-6a2dda972577__get_file_metadata` / `search_files` — find files by name when you don't have an ID.

### File ID extraction
A Google Sheets URL like `https://docs.google.com/spreadsheets/d/1ZoEt3a4PYqT8xF-ZHkVGGD9Nobu_J-ujejVmrJEFdy8/edit?gid=...` has the file ID `1ZoEt3a4PYqT8xF-ZHkVGGD9Nobu_J-ujejVmrJEFdy8`. The `gid` is the tab number; the same fileId can have multiple tabs. `read_file_content` returns ALL tabs concatenated.

### Handling large files (>25K tokens / >50KB)
The MCP auto-saves outputs that exceed context to `/var/folders/.../tool-results/<tool-call-id>.txt`. The path is accessible to the bash sandbox at `/sessions/optimistic-gracious-euler/mnt/.claude/projects/<project>/.../tool-results/<id>.txt`.

For text/csv exports via `download_file_content`, the content is returned as a base64 blob inside JSON:
```bash
SAVED="/sessions/.../tool-results/mcp-...-download_file_content-...txt"
jq -r '.content[0].embeddedResource.contents.blob' "$SAVED" | base64 -d > /tmp/accounts.csv
```

For markdown table exports via `read_file_content`, the content is in `.fileContent` as a string:
```bash
jq -r '.fileContent' "$SAVED" > /tmp/sheet.md
```

### Multi-tab spreadsheet parsing
When `read_file_content` returns multiple tabs concatenated, identify section boundaries by looking for repeating header patterns. Tabs are typically separated by blank lines + new column headers. Use grep + line-number ranges:
```bash
grep -n "Domains\|Account Name\|Normalizedurl\|Website" /tmp/sheet.md
# Then split by line ranges based on the boundaries
```

### Pitfalls
- The same Google Sheet URL with different `gid` values points to different tabs. Don't confuse them.
- Header misspellings (`Domians` instead of `Domains`) appear in real client data. Don't assume normalized headers.
- Ask the client to clarify when tabs aren't labeled — assumptions about which tab is which (DNC vs Targets vs Active) cause expensive rebuilds.
- The sandbox cannot reach `/var/folders/...` directly via Read tool; use bash `/sessions/.../mnt/.claude/projects/...` mount path.

### Output of this phase
- `/tmp/dnc.txt` — one domain per line, lowercase
- `/tmp/active_clients.csv` — name, domain pairs
- `/tmp/past_meetings.txt` — one company name per line (lowercase)
- `/tmp/targets.csv` — domain list (and any other available columns)

---

## Phase 2 — Filter and exclusion

### Goal
Reduce the raw target universe to the eligible net-new pool by removing already-prospected, current-customer, and recently-met accounts, plus the seller's own domains.

### Steps
```python
# Pseudocode — actual code uses sets
import csv

dnc = set(open('/tmp/dnc.txt').read().splitlines())
active = set(load_active_domains('/tmp/active_clients.csv'))
past_meeting_names = load_meeting_names('/tmp/past_meetings.txt')
SELLER_DOMAINS = {'sellercompany.com', 'sellerother.com'}  # all domains the seller owns

eligible = []
for domain in target_domains:
    if domain in SELLER_DOMAINS: continue
    if domain in dnc: continue
    if domain in active: continue
    
    # Past meeting fuzzy match — STRICT to avoid false positives
    domain_root = domain.split('.')[0].replace('-','').lower()
    if domain_root in {name_to_token(n) for n in past_meeting_names}:
        continue
    
    eligible.append(domain)

# Helper: name_to_token strips spaces, hyphens, dots, lowercases
def name_to_token(n):
    return n.lower().replace('.','').replace(',','').replace("'",'').replace('&','and').replace(' ','').replace('-','')[:25]
```

### Pitfalls — fuzzy matching is dangerous
A naive substring match like `pn_clean in domain_root` will produce false positives. "arata" matches "bharat" if you check substring. Use exact-token-equality only:
```python
# BAD: any('arata' in 'bharat-automotive')  # True - false positive
# GOOD: 'arata' == 'bharatautomotive'.split('.')[0].replace('-','')  # False
```

Always log the past-meeting matches for human review before treating them as exclusions. Print every match: `print(f"excluded: {domain} ~ {past_name}")`.

### Output of this phase
- `/tmp/eligible_targets.csv` — clean list ready for enrichment
- `/tmp/excluded_log.txt` — every excluded domain with reason (DNC / active / past / self) for audit

### Expected funnel shape
| Filter | Typical loss |
|---|---|
| Self-exclusion | <10 domains |
| DNC overlap | 30–50% (the DNC list is usually a sub-set of past prospecting) |
| Active client overlap | 0.5–2% |
| Past meeting overlap | 1–5% |
| **Net-new eligible** | **45–65% of raw** |

---

## Phase 3 — Smart subset selection for enrichment

### Goal
The full eligible pool can be 1,000–10,000+ accounts. Apollo bulk enrichment costs 1 credit per match. For a 50-lead pilot, enriching the entire pool is wasteful. Pick a 400–600 priority subset using TLD heuristics + negative-pattern filters.

### Why subset selection matters
- Apollo credit budget: typical engagement gives 4,000 credits. A 50-lead pilot should consume ≤700 across all phases.
- Enriching news/lottery/lyrics/movie-piracy domains burns credits and pollutes the scoring run.
- Better to enrich 600 quality candidates than 3,000 mixed.

### Selection logic (India-focused engagement)
```python
# Priority TLDs first
priority_tlds = ['in', 'co.in', 'ac.in', 'org.in', 'net.in', 'bank.in']
in_subset = [d for d in eligible if tld_of(d) in priority_tlds and not is_filtered(d)]

# Negative-pattern regex (exclude obvious non-B2B sites)
NEGATIVE_PATTERNS = [
    r'news', r'tv\d', r'\d+tv', r'lottery', r'sambad',
    r'lyrics', r'wallpaper', r'songs', r'music', r'astro', r'puja',
    r'matrimon', r'matka', r'satta', r'free.*alert', r'jobalert',
    r'cricket(score)?', r'cinema', r'movies?', r'film', r'mp3', r'apk',
    r'panchang', r'horoscope', r'kundli', r'jyotish',
    r'bollywood', r'tollywood', r'showbiz', r'meme',
    r'xxx', r'porn', r'^win', r'^cash', r'^earn',
]

# .com filtered by D2C-pattern heuristic (short brand names)
def looks_d2c_com(d):
    root = d.split('.')[0]
    return len(root) <= 18 and not any(c.isdigit() for c in root)

com_d2c = [d for d in com_eligible if looks_d2c_com(d) and not is_filtered(d)]

# Final subset: cap each bucket
random.shuffle(com_d2c)
subset = (in_subset[:400] + other_india_tlds[:80] + com_d2c[:200])[:600]

# Save in 10-domain batches for Apollo bulk_enrich
batches = [subset[i:i+10] for i in range(0, len(subset), 10)]
```

### Pitfalls
- Don't sample randomly across the whole eligible pool — you'll waste credits on poorly-fitting accounts.
- The negative-pattern regex must be tuned per market. Indian outbound has lots of news/lottery/lyrics sites; US lists have different garbage patterns.
- Don't over-filter `.com` — many real Indian D2C brands use `.com` not `.in`.

### Output
- `/tmp/enrich_subset.csv` — domain list, ~600 entries
- `/tmp/enrich_batches.json` — list of 60 lists of 10 domains each

---

## Phase 4 — Apollo organization enrichment

### Goal
Get firmographic + behavioral data for the 600-domain subset. This data feeds scoring.

### Tool
`mcp__1ceba703-c764-4520-aad0-d83a468ae5e4__apollo_organizations_bulk_enrich`

### Cost and confirmation
- 1 credit per matched company. 0 for unmatched.
- Apollo's tool description requires explicit user confirmation before each call. For a budgeted pilot, get the user's pre-approval ONCE for the whole budget upfront, then do not pause for individual confirmations.
- Pre-approval prompt template: *"This will enrich up to N companies and consume up to N credits (1 credit per match, no charge for unmatched). Plus up to ~K credits for stakeholder enrichment. Total ceiling: T credits. Do you want to proceed?"*

### Check credit balance first
```
mcp__...__apollo_users_api_profile  with include_credit_usage: true
```
Returns `num_credits_remaining`. Confirm budget headroom before starting.

### Bulk enrichment call shape
```
mcp__...__apollo_organizations_bulk_enrich
  domains: ["domain1.com", "domain2.in", ... up to 10 domains]
  _rationale: "Bulk enrich batch N for VWO ICP scoring"
```

### Response shape (per organization, key fields)
```json
{
  "name": "Company Name",
  "primary_domain": "domain.com",
  "industry": "retail",                       // single primary
  "secondary_industries": ["consumer goods"],  // list
  "estimated_num_employees": 320,
  "organization_revenue": 12000000.0,
  "organization_revenue_printed": "12M",
  "founded_year": 2015,
  "city": "Mumbai", "state": "Maharashtra", "country": "India",
  "owned_by_organization": {"name": "Parent Corp"},
  "short_description": "300-char company description with keywords",
  "keywords": ["d2c", "ecommerce", "..."],     // up to 200
  "departmental_head_count": {
    "marketing": 8, "engineering": 23, "product_management": 5, "sales": 12
  },
  "organization_headcount_six_month_growth": 0.08,
  "organization_headcount_twelve_month_growth": 0.18,
  "alexa_ranking": 62500,
  "linkedin_url": "...", "publicly_traded_symbol": null
}
```

### Handling huge responses
Each batch returns 30–80KB of JSON for 10 enriched companies. With 60 batches, that's 2–5MB total. Two strategies:

**Strategy A (recommended): Delegate to a subagent.** Spawn a `general-purpose` Agent with explicit instructions to call all 60 batches, parse each response down to a thin CSV row per company, save to disk, and return only a summary report. The subagent has full Apollo MCP access and runs all batches without polluting your context.

**Strategy B: Inline parallel batches.** Call 4–5 batches in parallel per turn. After each turn, parse responses to disk via bash heredoc + python. Higher context cost than Strategy A.

### Subagent prompt template for Strategy A
```
You have access to apollo_organizations_bulk_enrich.

Inputs:
- /sessions/.../enrich_batches.json — N batches of 10 domains each
- Pre-approved Apollo budget: K credits

Task:
1. Load the tool via ToolSearch.
2. For each batch, call the tool. The user has pre-approved credits — do not pause for confirmation.
3. After each batch, extract per organization (skip nulls) only these fields: [list].
4. Append rows to /sessions/.../apollo_enriched.csv (write header on first batch only).
5. If a tool response is too big to view inline, look in /var/folders/.../tool-results/ for the saved file and parse it via python/jq.
6. DO NOT dump raw responses back. Return only:
   - Total domains attempted
   - Total enriched
   - Total missed
   - Top 12 industries by count
   - Country breakdown
   - Employee size buckets
   - Apollo credits consumed
   - Confirmation file written + row count
```

### Match rate expectations
- India-heavy domain list: 70–75% match rate (parked/defunct domains miss)
- US-heavy: 80–85%
- Mixed Asian markets: 60–70%

### Per-row CSV schema (after parsing)
```
name, primary_domain, industry, secondary_industries, estimated_num_employees,
organization_revenue_printed, founded_year, city, state, country,
owned_by_organization, short_description, keywords, dh_marketing,
dh_engineering, dh_product_management, dh_sales,
headcount_six_month_growth, headcount_twelve_month_growth,
alexa_ranking, linkedin_url, publicly_traded_symbol
```

### Pitfalls
- Apollo's tool description mandates a confirmation message before each call. If the subagent doesn't get pre-approval context, it will pause 60 times. Always include "user has pre-approved up to N credits, do not pause" in the subagent prompt.
- Some batches return 0 matches if all 10 domains are dead. Don't treat that as an error.
- The `industry` field is a single string. The `secondary_industries` field is a list. Treat them as separate signals.
- `keywords` field can be 200+ items. Cap to top 30 when saving to keep CSV manageable.

---

## Phase 5 — Account scoring

### Goal
Apply a deterministic rubric to each enriched account. Output a 0–100 score and a bucket: Priority (90+), Active (70–89), Nurture (50–69), Excluded (<50).

### Rubric structure (calibrated to past meetings)
The rubric has 8 dimensions. Tune the weights to the seller's ACTUAL converting profile (from past meetings), not their stated ICP.

| Dimension | Max points | Logic |
|---|---|---|
| Geo | 20 | Primary country (India for India-focused) = 20. Adjacent = 8–12. Other = 0. |
| Industry primary fit | 22 | Score per industry, calibrated. D2C/Retail/Apparel/Wellness = 22. Fintech = 18. EdTech = 14–18. Govt = -10. |
| Employee sweet spot | 12 | 50–1500 = 12. 20–49 = 6. 1500–5000 = 8. <20 or >5000 = 1–5. |
| Keyword fit | 12 | High-fit terms (d2c, ecommerce, fintech, edtech, b2c, saas) +2 each, cap 12. Low-fit terms penalty. |
| Hiring/team signal | 12 | Headcount growth >5% = 6. Marketing dept ≥5 = 3. Product dept ≥3 = 3. |
| Traffic / scale proxy | 10 | Alexa <50K = 8, <150K = 5, <500K = 2. Has revenue = +2. Public = +2. Cap 10. |
| Maturity | 6 | Founded 4–15 years ago = 6. 16–25 = 3. <4 = 1. |
| Engagement signals | 6 | Has LinkedIn = 2. Has parent (subsidiary) = 2. Enriched at all = 2. |

### Industry weights — calibrate from past meetings
For each industry, count the past meetings in that industry. The weight is roughly the conversion rate. Industries with high meeting volume + high close rate get 22; industries with meetings but never closing get 4–8; industries with zero meetings get 0; industries the client has explicitly said NO to get -10.

### Reference Python implementation
```python
def score_account(row):
    score = 0
    industry = (row.get('industry') or '').lower().strip()
    secondary = (row.get('secondary_industries') or '').lower()
    keywords = (row.get('keywords') or '').lower()
    desc = (row.get('short_description') or '').lower()
    country = (row.get('country') or '').strip()
    emp = int(row.get('estimated_num_employees') or 0)
    has_revenue = bool((row.get('organization_revenue_printed') or '').strip())
    founded = int(row.get('founded_year') or 0)
    alexa = int(row.get('alexa_ranking') or 999999999)
    dh_mkt = int(row.get('dh_marketing') or 0)
    dh_prod = int(row.get('dh_product_management') or 0)
    h6 = float(row.get('headcount_six_month_growth') or 0)
    public = bool(row.get('publicly_traded_symbol'))
    has_li = bool(row.get('linkedin_url'))
    parent = bool((row.get('owned_by_organization') or '').strip())
    
    # Geo (India-focused)
    if country == 'India': score += 20
    elif country in ('United States','United Kingdom','Australia','Singapore','Canada'): score += 12
    elif country in ('Philippines','Malaysia','Indonesia','Thailand'): score += 8
    
    # Industry primary fit
    score += INDUSTRY_FIT.get(industry, 0)
    
    # Employee sweet spot
    if 50 <= emp <= 1500: score += 12
    elif 20 <= emp < 50: score += 6
    elif 1500 < emp <= 5000: score += 8
    elif emp > 5000: score += 5
    elif 0 < emp < 20: score += 1
    
    # Keyword fit
    high_hits = sum(1 for k in HIGH_FIT_KEYWORDS if k in keywords or k in desc)
    score += min(12, high_hits * 2)
    
    # Hiring/team
    if h6 > 0.05: score += 6
    if dh_mkt >= 5: score += 3
    if dh_prod >= 3: score += 3
    
    # Traffic
    traffic = 0
    if alexa < 50000: traffic += 8
    elif alexa < 150000: traffic += 5
    if has_revenue: traffic += 2
    if public: traffic += 2
    score += min(10, traffic)
    
    # Maturity
    if founded:
        age = 2026 - founded
        if 4 <= age <= 15: score += 6
        elif 16 <= age <= 25: score += 3
        elif age < 4: score += 1
    
    # Engagement
    if has_li: score += 2
    if parent: score += 2
    if industry: score += 2
    
    return score
```

### Industry diversity guard when picking top N
A simple top-N sort can yield 30 fashion brands. Use a per-industry cap:
```python
top, ind_count = [], Counter()
for r in sorted_rows:
    ind = r.get('industry','').lower() or 'other'
    if ind_count[ind] < 12:  # max 12 per industry
        top.append(r); ind_count[ind] += 1
    if len(top) >= 50: break
```

### Output
- `/tmp/apollo_scored.csv` — all enriched accounts with score column
- `/tmp/top50_accounts.csv` — top 50 with industry diversity guard, ranked

---

## Phase 6 — Stakeholder discovery via Apollo

### Goal
For each top 50 account, find the SINGLE BEST contact (Champion priority).

### Tool
`mcp__1ceba703-c764-4520-aad0-d83a468ae5e4__apollo_mixed_people_api_search`

### Cost
**Search itself does not consume credits.** It returns names, titles, LinkedIn URLs, but NOT emails. Email enrichment (Phase 7) is what costs credits.

### Search call shape (per account)
```
mcp__...__apollo_mixed_people_api_search
  q_organization_domains_list: ["razorpay.com"]
  person_titles: [
    "Head of Growth", "VP Growth", "Head of Marketing",
    "Head of Digital Marketing", "CMO", "VP Marketing",
    "Product Manager", "Senior Product Manager", "Head of Product",
    "VP Product", "Head of D2C", "Director of Growth",
    "Director Marketing", "CRO Manager"
  ]
  include_similar_titles: true
  per_page: 10
  _rationale: "Find Champion stakeholder at razorpay.com"
```

### Title preference order (Indian B2B sale)
1. **Champion (highest priority — these reply most):**
   - Head of Growth / VP Growth
   - Head of Marketing / VP Marketing / CMO
   - Head of Digital Marketing
   - Head of D2C / Head of Ecommerce
   - Senior Product Manager (especially for SaaS/Fintech/EdTech)
   - Head of Product / VP Product

2. **Secondary (use if no Champion found):**
   - Director of Growth / Director Marketing
   - Head of Performance / Head of Acquisition
   - CRO Manager (rare in India — most Indian companies don't have a dedicated CRO Manager title)

3. **Fallback for small companies (<30 employees):**
   - Founder / Co-Founder / CEO

4. **Avoid:**
   - Engineers, HR, Finance, generic Sales (different pitch needed)
   - Assistant Manager / Senior Associate (too junior)
   - Chief Manager (this title in Indian banks usually means a mid-level operational role, not exec)

### Picking the best from 10 results
Sort by:
1. Title match strength (Head of Growth > Director of Growth > Senior Manager Growth)
2. Employee tenure if visible (longer = stickier contact)
3. Has LinkedIn URL (verifies recency)

If the search returns 0 results with the strict title list, retry with broader titles (Manager Marketing, Manager Growth, Marketing Manager).

### Pitfalls
- Apollo's `include_similar_titles: true` is essential — without it, "Head of Growth" misses "Growth Lead" / "Head, Growth"
- Some Indian companies use "VP & Head" as a single title; Apollo handles this OK with similar_titles enabled
- Skip accounts where the only match is a Chief Manager / Assistant Manager — those rarely convert in cold outreach

### Output
- For each lead: contact_first_name, contact_last_name, contact_title, contact_linkedin_url, contact_seniority, picked_reason

---

## Phase 7 — Email enrichment via Apollo bulk_match

### Goal
Get verified emails for the chosen stakeholders.

### Tool
`mcp__1ceba703-c764-4520-aad0-d83a468ae5e4__apollo_people_bulk_match` (preferred — 10 people per call)

Or `apollo_people_match` for individual calls.

### Cost
- 1 credit per matched email. 0 for unmatched.
- Email status field tells you confidence: `verified` > `likely_to_engage` > `unavailable`

### Bulk match call shape
```
mcp__...__apollo_people_bulk_match
  details: [
    {"name": "Subhash Dawda", "organization_name": "Razorpay", "domain": "razorpay.com"},
    {"name": "Akshika Poddar", "organization_name": "Rareism", "domain": "rareism.com"},
    ...up to 10
  ]
  _rationale: "Bulk enrich emails for top 50 pilot stakeholders"
```

### Response shape
```json
{
  "matched_people": [
    {
      "name": "Subhash Dawda",
      "email": "subhash.gopaldawda@razorpay.com",
      "email_status": "verified",
      "linkedin_url": "..."
    }
  ],
  "unmatched_count": 1
}
```

### Email status interpretation
- `verified`: Apollo confirmed deliverability — send.
- `likely_to_engage`: Apollo's pattern-derived guess — send with caution; flag for monitoring.
- `unavailable` / missing: Hand-source via Hunter.io / LeadMagic / pattern guess (`firstname.lastname@domain`) — but verify before adding to send list.

### Yield expectations
Of 50 stakeholders found in Phase 6, expect:
- ~50–55% with `verified` emails
- ~10–15% with `likely_to_engage`
- ~30–40% unavailable (especially for smaller / less-known Indian companies)

### Decision flow when yield is low
1. If 26–30 verified emails for a 50-target pilot: ship the smaller pilot, expand later.
2. If 15–25 verified: pull rank 51–80 and run another stakeholder + bulk_match round.
3. If <15 verified: revisit the priority subset — possibly enriching too many small/private companies.

### Pitfalls
- The `details` parameter can also accept `linkedin_url` instead of name + domain — use it when available, the match rate is higher.
- Apollo's confirmation requirement applies here too — pre-approve total budget upfront.
- Some emails come back on a different domain than expected (e.g., subsidiary's email). Flag in CSV but usually still deliverable.

---

## Phase 8 — Per-account research via Tavily

### Goal
For each lead with a verified email, find ONE concrete observation about their product/funnel for the body 1 opener. This is the single most important quality lever in the pipeline.

### Tool
`mcp__1f489039-ae66-4e16-baee-267ab1b86f3c__tavily_search`

Or `tavily_extract` to pull a specific URL's content.

Or `tavily_research` for multi-step deep research (heavier, use only for top 5 accounts).

### Search call shape
```
mcp__...__tavily_search
  query: "<company name> 2025 2026 funding hiring product launch news"
  search_depth: "advanced"
  max_results: 5
  include_domains: []   # optional, leave empty for general web
```

### What to extract
For each lead, extract:
1. **One observable thing about their product/page/funnel** (this is the body 1 opener material)
2. **Any recent news event** (kept in reserve for body 2/3 only — never the opener)
3. **Tech stack hints** (BuiltWith-style data, competitor stack signals)
4. **Their published metrics or claims** (if they cite their own conversion / DAU / GMV data, you can reference it without inventing)

### Tier-A leads (top 10 by score)
For these, do extra work. Use `tavily_extract` on:
- Homepage
- Signup or checkout page
- Pricing or product page
- Demo / contact form

Identify: form field count, page architecture choices, hero CTA placement, mobile vs desktop differences, density of category pages, etc.

### Tier-B leads (mid 11–30)
One `tavily_search` per lead is enough. Pull the company description, recent activity, and infer category-level CRO patterns.

### Tier-C leads (bottom 31–50)
Skip individual research. Use the Apollo enrichment data + category-level CRO knowledge:
- Indian fintech: KYC always too long, document upload always painful
- Indian D2C apparel: size guide depth, fabric/care below fold, PDP image stacking
- Indian EdTech: fee placement, EMI calculator depth, free-to-paid step
- Indian SaaS: demo form segmentation, industry-specific landing pages

### Banned: don't lead with research findings that look AI-generated
- "Saw your Series C close last quarter..." — banned (LLM-tell)
- "Read about your acquisition..." — banned
- "Congrats on your new funding..." — banned

These openers signal "AI tool" to Indian buyers in 2026. Use the OBSERVATION you found, not the news event.

### Output
For each lead, append to scoring CSV:
- `observation_angle`: 1-line summary of what you'll lead body 1 with
- `secondary_observation`: backup angle for body 2
- `signal_for_body_3`: optional news event for the breakup body

---

## Phase 9 — Email drafting (3-step sequences)

### Goal
Produce body_1, body_2, body_3 plus subject_1, subject_2, subject_3 for each lead. Refer to `SKILL.md` for the email content rules in detail.

### Quick rules summary (full rules in SKILL.md)
- Subject: ≤4 words, ≤25 chars, lowercase, observation/funnel-specific, unique within row
- Body 1: 90–120 words, 3 paragraphs, observation opener, ONE problem, social proof + soft CTA
- Body 2: 70–110 words, 2–3 paragraphs, DIFFERENT angle, light reference to body 1
- Body 3: 50–80 words, 2 paragraphs, breakup, no pitch
- No greeting, no sign-off, no signature in body
- No spintax, no template variables in plain text fields
- No em dashes (—)
- ≥5 "you/your" in body 1/2; ≥3 in body 3
- Heavy second-person, simpler English

### Delegation pattern
Drafting 78 unique emails (26 leads × 3 bodies) is heavy. Delegate to a `general-purpose` Agent. The subagent should:
1. Read the scored CSV with research notes per lead
2. Read the social-proof library
3. Read the SKILL.md rules
4. For each lead, produce the 3 bodies + 3 subjects
5. Run programmatic validation against all 17 SKILL.md rules
6. Return the final CSV with a summary report

### Subagent prompt template
See SKILL.md "When using this skill on a new client" section for the prompt scaffold. Be explicit about:
- The exact word-count caps per body
- The banned opener patterns
- The subject length cap
- The em-dash ban
- The paragraph structure requirement
- The validation checks to run before writing the CSV

### Output CSV schema
```
email, first_name, last_name, company_short,
subject_1, body_1, subject_2, body_2, subject_3, body_3,
domain, company_full, industry, employees, country,
contact_title, score, segment, observation_angle
```

---

## Phase 10 — Validation

### Goal
Programmatically verify every quality gate before shipping the CSV to Smartlead.

### Validation script (run before delivery)
```python
import csv, re

def validate_v6(csv_path):
    issues = []
    with open(csv_path) as f:
        rows = list(csv.DictReader(f))
    
    for r in rows:
        # 1. Subject length and word count
        for sf in ['subject_1', 'subject_2', 'subject_3']:
            s = r[sf].strip()
            if len(s) > 25:
                issues.append(f"{r['company_short']} {sf} >25 chars: '{s}'")
            if len(s.split()) > 4:
                issues.append(f"{r['company_short']} {sf} >4 words")
            if not s.islower() and any(c.isalpha() for c in s):
                # tolerate apostrophes, but check primary case
                if any(c.isupper() for c in s):
                    issues.append(f"{r['company_short']} {sf} has uppercase")
        
        # 2. Subject uniqueness within row
        if len({r['subject_1'], r['subject_2'], r['subject_3']}) < 3:
            issues.append(f"{r['company_short']} duplicate subjects in row")
        
        # 3. Banned subject patterns
        BANNED_SUBJECTS = ['quick question', 'idea for', 'one observation', '!']
        for sf in ['subject_1', 'subject_2', 'subject_3']:
            if any(b in r[sf].lower() for b in BANNED_SUBJECTS):
                issues.append(f"{r['company_short']} {sf} banned pattern")
        
        # 4. Body word counts
        b1, b2, b3 = r['body_1'], r['body_2'], r['body_3']
        if not (90 <= len(b1.split()) <= 120):
            issues.append(f"{r['company_short']} body_1 word count out of range")
        if not (70 <= len(b2.split()) <= 110):
            issues.append(f"{r['company_short']} body_2 word count out of range")
        if not (50 <= len(b3.split()) <= 80):
            issues.append(f"{r['company_short']} body_3 word count out of range")
        
        # 5. Banned openers in body 1
        opener = '. '.join(b1.split('.')[:2]).lower()
        BANNED_OPENERS = [
            'saw your series', 'saw the series', 'congrats on', 'noticed you raised',
            'read about your acquisition', 'saw the acquisition', 'launched',
            'new ceo', 'series a', 'series b', 'series c', 'series d', 'raised'
        ]
        for bo in BANNED_OPENERS:
            if bo in opener:
                issues.append(f"{r['company_short']} body_1 banned opener: '{bo}'")
        
        # 6. No greeting
        for bf in ['body_1', 'body_2', 'body_3']:
            b = r[bf].strip()
            if b.lower().startswith(('hi ', 'hey ', 'hello ', 'dear ', 'greetings')):
                issues.append(f"{r['company_short']} {bf} starts with greeting")
        
        # 7. No sign-off
        for bf in ['body_1', 'body_2', 'body_3']:
            tail = r[bf].strip()[-100:].lower()
            if any(s in tail for s in ['best,', 'thanks,\n', 'regards,', 'cheers,', '-- ']):
                issues.append(f"{r['company_short']} {bf} has sign-off")
        
        # 8. No em dashes
        for bf in ['body_1', 'body_2', 'body_3', 'subject_1', 'subject_2', 'subject_3']:
            if '\u2014' in r[bf] or ' -- ' in r[bf]:
                issues.append(f"{r['company_short']} {bf} has em dash")
        
        # 9. No spintax
        for bf in ['body_1', 'body_2', 'body_3', 'subject_1', 'subject_2', 'subject_3']:
            if re.search(r'\{[^{}]+\|[^{}]+\}', r[bf]):
                issues.append(f"{r['company_short']} {bf} has spintax")
            if re.search(r'\{\{[^}]+\}\}', r[bf]):
                issues.append(f"{r['company_short']} {bf} has template vars")
        
        # 10. you/your density
        def yc(t): return len(re.findall(r'\b(you|your|youre|yours)\b', t, re.IGNORECASE))
        if yc(b1) < 5: issues.append(f"{r['company_short']} body_1 you/your count <5")
        if yc(b2) < 5: issues.append(f"{r['company_short']} body_2 you/your count <5")
        if yc(b3) < 3: issues.append(f"{r['company_short']} body_3 you/your count <3")
        
        # 11. Paragraph structure
        if b1.count('\n\n') < 2: issues.append(f"{r['company_short']} body_1 not 3 paragraphs")
        if b2.count('\n\n') < 1: issues.append(f"{r['company_short']} body_2 not 2+ paragraphs")
        if b3.count('\n\n') < 1: issues.append(f"{r['company_short']} body_3 not 2 paragraphs")
        
        # 12. Email format check
        if '@' not in r['email']: issues.append(f"{r['company_short']} bad email format")
    
    return issues
```

Pass all checks before delivery. If any issues, fix and re-validate.

---

## Phase 11 — Smartlead import setup

### CSV mapping inside Smartlead
Smartlead supports 3-step sequences natively. Map columns:
- Step 1 → `subject_1`, `body_1`
- Step 2 → `subject_2`, `body_2`, send 3 days after step 1
- Step 3 → `subject_3`, `body_3`, send 7 days after step 2

### Smartlead salutation/signature wrapper
Don't put greeting/sig in the CSV body. Configure as Smartlead-level template variables:
- Email opens with: `Hi {{first_name}},\n\n{{body}}`
- Email ends with: `\n\nBest,\n{{sender_name}}`

This way the same CSV works for any sender (Akash, Prachi, etc.) without re-generating.

### Sequence configuration
- Step 1: send Day 0
- Step 2: send Day +3 (only if no reply to step 1)
- Step 3: send Day +10 (only if no reply to step 2)
- Stop sequence on any reply
- Track opens (yes), track clicks (no — adds spam score)

### Mailbox / domain hygiene
Run all of these BEFORE the first send. Failure on any one = stop:
- SPF, DKIM, DMARC live on sender domain
- Domain warmed for 14+ days via Smartlead's warm-up tool
- RFC 8058 List-Unsubscribe header configured
- Mail-Tester score 9+/10 on a sample send to yourself
- Per-mailbox cap: 30 sends/day during cold ramp
- Multi-domain rotation: 6–10 mailboxes across 2–3 lookalike domains

### Pitfalls
- Sending without warmup destroys the domain in 24 hours.
- Hardcoding a specific sender name in the CSV body locks you to that sender.
- Forgetting `track clicks: false` increases spam score significantly.
- Setting day +1 between step 1 and step 2 looks like spam-bot pattern. Use 3+ days.

---

## Pipeline cost summary (for a 50-lead pilot)

| Phase | Apollo credits | Tavily searches | Other |
|---|---|---|---|
| Phase 1 ingestion | 0 | 0 | Drive MCP free |
| Phase 2 filter | 0 | 0 | local compute |
| Phase 3 subset | 0 | 0 | local compute |
| Phase 4 org enrich (600 domains) | ~440 (73% match) | 0 | |
| Phase 5 score | 0 | 0 | local compute |
| Phase 6 stakeholder search | 0 | 0 | searches free |
| Phase 7 email bulk_match (50) | ~37 | 0 | |
| Phase 8 research (26 leads) | 0 | 26 | covered by Tavily plan |
| Phase 9 drafting | 0 | 0 | LLM only |
| Phase 10 validation | 0 | 0 | local compute |
| Phase 11 Smartlead | 0 | 0 | Smartlead account |
| **Total** | **~480** | **26** | |

Apollo budget: aim for ≤700 credits per 50-lead pilot. You'll have ~3,300 credits buffer for expansion / wave 2 from a typical 4,000-credit balance.

---

## Iteration learnings — what was tried and rejected

1. **v1 (rejected):** US-style subjects ("Quick question, X"), single-touch, no spintax, generic copy. Reason: too American for Indian buyers.
2. **v2 (rejected):** Wrong source list. The "DNC tab" semantics confused the pipeline; pipeline used DNC as source instead of accounts. Reason: ambiguous tab labels in client spreadsheet, no early human check.
3. **v3 (rejected):** Spintax-heavy, greeting + sign-off in body, 50–80 word bodies. Reason: spintax adds complexity for no benefit when content is already unique; salutation belongs in Smartlead variables.
4. **v4 (rejected):** Unique subjects per prospect (5–7 words), 120–150 word bodies, no spintax. Reason: news/funding openers feel AI-generated to Indian D2C buyers in 2026; subjects too long; bodies covered 2+ problems each which dilutes message.
5. **v5 (accepted, draft):** 3-step sequences, 3–4 word subjects, observation-based openers, ≤120 word bodies, one problem per body. Reason: matches the buyer's mental model of "actually read my site, lead with what you saw."
6. **v6 (final, sendable):** v5 + paragraph formatting + em dashes removed.

---

## Common failure modes (per phase)

### Phase 1
- Confusing tab semantics in multi-tab Google Sheets. Always confirm tab labels with the client before parsing.
- Treating header misspellings (Domians) as data corruption — they're often original.

### Phase 2
- Naive substring matching for past-meeting filter. Use exact-token-equality.
- Forgetting to exclude the seller's own domains.

### Phase 3
- Including news/lottery/movie-piracy domains in the enrichment subset. Wastes credits. Use the negative-pattern regex.
- Random sampling instead of priority sampling. Burns credits on poor-fit accounts.

### Phase 4
- Subagent pausing for confirmation on every batch. Always pre-approve budget in the subagent prompt.
- Dumping raw Apollo responses to context. Always parse to thin CSV before returning.

### Phase 5
- Using stated ICP weights instead of calibrating to past meetings. Past meetings are truth.
- Top-N without industry diversity guard. Yields homogeneous lists.

### Phase 6
- Searching with strict titles only when fuzzy match would help. Always set `include_similar_titles: true`.
- Picking junior titles (Assistant Manager, Senior Associate) — they rarely convert in cold outreach.

### Phase 7
- Treating `unavailable` emails as deliverable. Always check `email_status`.
- Sending to `likely_to_engage` without flagging — bounce risk is higher.

### Phase 8
- Leading body 1 with the news event you found. Use the OBSERVATION instead.
- Doing deep research on every lead. Tier the effort.

### Phase 9
- Spintax temptation creeping back. Unique content is its own deliverability variation.
- Em dashes returning. They're an LLM-tell.
- Two problems per body. Pick one.
- Inflating word count past 120 because the body feels short. Tighter is better.

### Phase 10
- Skipping validation because the samples looked OK. Always run programmatic checks on all 78 pieces.

### Phase 11
- Forgetting to disable click tracking. Spam score penalty.
- Sending without warmup. Domain dies in 24 hours.

---

## Cross-engagement portability

To use this pipeline on a new client:
1. Read this playbook + `SKILL.md` for content rules.
2. Build a fresh per-segment social-proof library by scraping the new seller's case-study + customer pages via Tavily.
3. Tune the industry-fit weights in Phase 5 based on the new seller's past meetings.
4. Update the negative-pattern regex if targeting a different geo.
5. Re-confirm Apollo credit budget with the new client upfront.
6. Run the pipeline. Validation gates remain the same.

The pipeline shape doesn't change across clients. What changes:
- Industry weights in Phase 5 (calibrated to past meetings)
- Per-segment social proof library (sourced from seller's case studies)
- Title preferences in Phase 6 (calibrated to seller's buying committee)
- Geo focus in Phase 3's subset selector

---

## File-system layout

Recommended layout for a fresh client engagement:

```
outputs/
  pilot/
    accounts_main_raw.csv          # raw target list from client
    eligible_targets.csv           # after Phase 2 filter
    enrich_subset.csv              # Phase 3 priority subset
    enrich_batches.json            # batches of 10 for Apollo
    apollo_enriched.csv            # Phase 4 output, all enriched accounts
    apollo_scored.csv              # Phase 5 output, scored
    top50_accounts.csv             # top 50 with diversity guard
    top50_stakeholders.csv         # Phase 6+7 output
    research_notes.json            # Phase 8 output
    vwo_pilot_smartlead_ready.csv  # final v6 (rename per client)
    README_PILOT.md                # what's in here, how to import
    social_proof_library.md        # per-engagement, sourced fresh
  skills/
    india-cold-email/
      SKILL.md                     # email content rules
      OUTBOUND_PIPELINE_PLAYBOOK.md  # this file
```

---

## Apollo MCP reference card

Tools used in this pipeline:

| Tool | Purpose | Cost | Notes |
|---|---|---|---|
| `apollo_users_api_profile` | Check credit balance | free | set `include_credit_usage: true` |
| `apollo_organizations_bulk_enrich` | Enrich up to 10 domains | 1/match | confirmation required |
| `apollo_organizations_enrich` | Enrich single domain | 1/match | for one-offs |
| `apollo_organizations_job_postings` | Fetch hiring data | 1/call | use for high-priority leads only |
| `apollo_mixed_companies_search` | Find companies by filters | free | up to 100/page, 500 pages |
| `apollo_mixed_people_api_search` | Find people by filters | free | NO emails returned |
| `apollo_people_match` | Enrich single person email | 1/match | for one-offs |
| `apollo_people_bulk_match` | Enrich up to 10 person emails | 1/match | confirmation required |
| `apollo_contacts_search` | Search YOUR team's existing contacts | free | not the same as people search |
| `apollo_contacts_create` / `apollo_contacts_update` | Manage your contacts | free | for CRM workflows |
| `apollo_emailer_campaigns_*` | Manage Apollo's own sequences | free | not used in this pipeline (we use Smartlead) |

Confirmation pattern: Apollo's tool descriptions require a confirmation message before each credit-consuming call. For batched runs, get user pre-approval ONCE for total budget, then explicitly tell the subagent "credits are pre-approved, do not pause for individual confirmation."

---

## Tavily MCP reference card

Tools used in this pipeline:

| Tool | Purpose | Cost | Notes |
|---|---|---|---|
| `tavily_search` | Web search with depth | per Tavily plan | `search_depth: "advanced"` for production |
| `tavily_extract` | Pull content from specific URLs | per plan | `extract_depth: "advanced"` for protected sites |
| `tavily_crawl` | Crawl from a root URL | per plan | use for bulk seller-website scraping |
| `tavily_map` | Sitemap discovery | per plan | rarely needed |
| `tavily_research` | Multi-step deep research | heavier | use only for top 5 accounts |

Search query patterns that work:
- `"<company name>" 2025 2026 funding hiring product launch news`
- `"<domain>" signup checkout pricing demo`
- `"<company name>" recent press release` for news context
- `"<company name>" site:linkedin.com` for stakeholder corroboration

For the seller's own customer roster:
- `<seller name> case study customers <industry>` per industry vertical

---

## Drive MCP reference card

Tools used in this pipeline:

| Tool | Purpose | Notes |
|---|---|---|
| `read_file_content` | Markdown export of Drive files | best for small files; large files auto-saved to disk |
| `download_file_content` | Binary download | use `exportMimeType: "text/csv"` for spreadsheets |
| `get_file_metadata` | File info | when you have ID but need details |
| `search_files` | Find files by name | when you don't have an ID |

Large file handling:
- Outputs >25K tokens auto-save to `/var/folders/.../tool-results/<id>.txt`
- The same path is mounted in the bash sandbox at `/sessions/.../mnt/.claude/projects/.../tool-results/<id>.txt`
- For `read_file_content`: content is in `.fileContent` (string)
- For `download_file_content`: content is base64-encoded blob in `.content[0].embeddedResource.contents.blob`

```bash
# Decode base64 blob from download_file_content
jq -r '.content[0].embeddedResource.contents.blob' "$SAVED" | base64 -d > /tmp/output.csv

# Extract markdown string from read_file_content
jq -r '.fileContent' "$SAVED" > /tmp/output.md
```

---

## Subagent delegation patterns

Three patterns I used. Pick by task shape:

### Pattern 1: Big tool-output volume
When a phase will return more data than fits in context (Apollo bulk enrich at 50KB × 60 batches = 3MB), delegate to a `general-purpose` Agent. The subagent calls all tools, parses outputs to thin CSV rows, saves to disk, returns only a structured summary.

Prompt scaffold:
```
You have access to <tools>.

Inputs:
- File path: /sessions/.../<input>.json with N items

Task:
1. Load tools via ToolSearch.
2. Process all N items (batches of 10).
3. After each call, parse the response down to these fields: <list>.
4. Append rows to /sessions/.../<output>.csv (header on first batch only).
5. If a tool response is too big to view inline, look in /var/folders/.../tool-results/ and parse via python/jq.

Pre-approval: user has pre-approved <X> credits. Do NOT pause for individual confirmation.

Output: concise report under 300 words covering counts, distributions, file confirmation. DO NOT dump raw responses.
```

### Pattern 2: Multi-step content generation
When generating a lot of unique content (78 unique email pieces), delegate to a subagent with explicit rules.

Prompt scaffold:
```
You are drafting <type> for <count> leads following these rules: <list rules with examples>.

Inputs:
- Lead data: /sessions/.../leads.csv
- Style rules: /sessions/.../SKILL.md
- Social proof library: /sessions/.../proof.md

For each lead, produce <fields>.

Validation before writing CSV:
1. <programmatic check>
2. <programmatic check>
...

Output:
- File: /sessions/.../output.csv
- Report under 300 words: validation pass/fail, samples, edge cases.
```

### Pattern 3: Heavy data parse
When a single tool output is too big to read inline, delegate parsing to a subagent that uses bash/jq/python on the saved file.

Prompt scaffold:
```
Parse this file: /var/folders/.../tool-results/<id>.txt

It's <format>. Extract <these fields> per <these dimensions>.

Use jq + python via bash. Don't use Read tool (file too big).

Output a structured summary under 250 words. DO NOT dump raw data.
```

---

## When the pipeline doesn't fit a new client

Adapt by adjusting these levers, NOT the phase structure:

1. **Different country focus** → update Phase 3 priority TLDs, Phase 5 geo points, Phase 8 search query language
2. **Different vertical (B2B SaaS, healthcare, etc.)** → update Phase 5 industry weights, Phase 6 title preferences, Phase 8 category-level CRO patterns
3. **Different company size targeting** → update Phase 5 employee bucket weights
4. **Different seller** → rebuild social-proof library in Phase 8/9, never reuse another client's roster
5. **Different sequence length** (2-step or 5-step) → update Phase 9 body templates, Phase 11 Smartlead config

Don't touch:
- The phase structure (always 11 phases in this order)
- The validation gates (always 17 checks)
- The Apollo MCP usage patterns (always bulk endpoints, always pre-approve budget)
- The subagent delegation pattern for high-volume work

---

## End notes

This playbook is the technical brief — what to do, with what tool, in what order, at what cost. The art of the emails themselves lives in `SKILL.md`.

Both files are designed to be portable. Drop the `india-cold-email/` directory into any future workspace's `skills/` folder and the next pilot inherits 95% of the work. Update the per-engagement specifics (industry weights, social proof library, title preferences) and the rest is execution.

The biggest mistake on the next engagement will be doing manually what this pipeline already automates. Trust the gates. If a body is 130 words, trim it. If a subject is 5 words, compress it. If a body 1 opener mentions a Series C, replace it with an observation. The buyer's pattern recognition for AI-generated outbound is sharper than the engineer's pattern recognition for what looks "good enough." Fight for the gates.
