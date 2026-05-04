# VWO Account Scoring Logic v2 — Multi-Source with Intent Signals

This supersedes v1. v1 was firmographic-only (industry + size + traffic from Apollo enrichment). v2 fuses four weighted data sources, adds an explicit intent-signals subsystem, and locks geography to India.

---

## 0. What changed from v1 (and why)

| v1 | v2 |
|---|---|
| Firmographic data only (Apollo enrichment) | Four sources: base fit + historical context + competitor lookalike + intent signals |
| Geo as a soft weight (India = 20 pts, US/UK = 12) | **India-only hard filter** for VWO |
| Static — score doesn't change unless company changes | Dynamic — intent signals decay weekly, score updates |
| No use of competitor customer lists | Explicit lookalike-mining vs Optimizely / AB Tasty / Hotjar customers |
| No hiring signals | Apollo job postings + Apollo people-search-by-job-title-posted = intent signal |
| No "decision-maker just joined" signal | Champion-fit person joined in last 90 days = highest single intent signal |
| Project documents (case studies, ICP brief, won deals) treated as input only | Project documents drive product-specific calibration via a config block |

**Why this matters:** VWO's actual buying triggers (per their onboarding questionnaire) are not "your industry is apparel and you have 220 employees." They are "you just hired a CMO," "you just raised a Series C," "you just launched a new product." v1 doesn't see any of these. v2 makes them the dominant signal.

**Total score budget** is still 0–100, but allocated:
- 40% Base Fit (firmographic, ICP match)
- 15% Historical Context (active-client adjacency, past-meeting precedent)
- 10% Competitor Customer Lookalike
- 35% Intent Signals (real-time, decay-weighted)

---

## 1. Hard filters (binary disqualifiers — India-only for VWO)

```python
def hard_filter_vwo(account, project_data):
    domain = account['primary_domain'].lower()
    
    # 1. India-only — HARD GATE for VWO engagement
    country = (account.get('country') or '').strip()
    if country != 'India':
        return False, f"non-India geo: {country or 'unknown'}"
    
    # 2. Self-exclusion
    if domain in {'vwo.com', 'visualwebsiteoptimizer.com', 'wingify.com'}:
        return False, "VWO self"
    
    # 3. Already-prospected
    if domain in project_data['dnc_domains']:
        return False, "DNC"
    
    # 4. Currently paying customer
    if domain in project_data['active_client_domains']:
        return False, "active customer"
    
    # 5. Met in last 12 months
    if domain_root_in_past_meetings(domain, project_data['past_meetings']):
        return False, "met in last 12mo"
    
    # 6. Direct competitor (Indian or otherwise)
    if domain in {'optimizely.com', 'abtasty.com', 'mida.so', 'convert.com',
                  'kameleoon.com', 'webtrends.com', 'omniconvert.com'}:
        return False, "direct competitor"
    
    # 7. VWO partner agency (different sales motion)
    if domain in {'tatvic.com', 'convertpolo.com', 'insighten.co'}:
        return False, "partner agency"
    
    # 8. Anti-ICP industry
    industry = (account.get('industry') or '').lower()
    if industry in {'government administration', 'defense & space',
                    'gambling & casinos', 'tobacco', 'firearms',
                    'religious institutions', 'libraries'}:
        return False, f"anti-ICP industry: {industry}"
    
    # 9. Pre-revenue / pre-PMF
    emp = int(account.get('estimated_num_employees') or 0)
    rev = (account.get('organization_revenue_printed') or '').strip()
    founded = int(account.get('founded_year') or 0)
    if emp < 10 and not rev and (founded == 0 or 2026 - founded < 2):
        return False, "pre-PMF"
    
    # 10. Below VWO's stated traffic threshold
    # (Apollo's alexa rank is the proxy; VWO wants >150K monthly UV which roughly maps to alexa < 500K in India)
    alexa = int(account.get('alexa_ranking') or 99_999_999)
    if alexa > 2_000_000:
        return False, f"low traffic (alexa {alexa})"
    
    return True, None
```

The India-only filter is the biggest change. For the VWO engagement, every other geography is filtered at the gate, not just penalized in scoring. This eliminates ~5–10% of pool that v1 would have wasted credits on.

---

## 2. Multi-source scoring architecture

```
                ┌──────────────────────┐
                │  Project documents   │
                │  - ICP brief         │
                │  - Active clients    │
                │  - Past meetings     │
                │  - Won/lost deals    │
                │  - Case studies      │
                │  - Competitor lists  │
                └──────────┬───────────┘
                           │ (loaded once per pilot)
                           ▼
┌─────────────────────────────────────────────────────────┐
│              SCORING ENGINE (per account)                │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ SOURCE 1     │  │ SOURCE 2     │  │ SOURCE 3     │  │
│  │ Base Fit     │  │ Historical   │  │ Competitor   │  │
│  │ (40 pts)     │  │ Context      │  │ Lookalike    │  │
│  │              │  │ (15 pts)     │  │ (10 pts)     │  │
│  │ Apollo enrich│  │ Active +     │  │ Optimizely/  │  │
│  │ + ICP        │  │ Past meets   │  │ Hotjar/etc   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│         └─────────────────┼─────────────────┘           │
│                           │                             │
│                           ▼                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ SOURCE 4: INTENT SIGNALS (35 pts, decay-weighted)│  │
│  │  - Champion-fit hire (last 90d)         8 pts   │   │
│  │  - General hiring (≥5 roles)            4 pts   │   │
│  │  - Funding (last 90d)                   6 pts   │   │
│  │  - Expansion / new market               4 pts   │   │
│  │  - Recent product launch / replatform   5 pts   │   │
│  │  - Headcount growth ≥15% in 6mo         4 pts   │   │
│  │  - Press mention with relevant keywords 4 pts   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│         ▼                                                │
│  Final score 0–100 → Bucket → Campaign treatment         │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Per-product configuration block (calibrate this per seller)

This block is what makes the scoring product-specific. For VWO:

```python
VWO_PRODUCT_CONFIG = {
    'product_name': 'VWO',
    'geography_hard_filter': ['India'],   # only India for VWO engagement
    
    'industry_weights': {
        # Top tier (32.7% of past meetings)
        'apparel & fashion': 30,
        'retail': 28,
        'consumer goods': 28,
        'cosmetics': 28,
        'health, wellness & fitness': 28,
        'food & beverages': 24,
        # Second tier (18.3%)
        'financial services': 26,
        'banking': 26,
        'insurance': 24,
        'investment management': 22,
        # Third tier (9.2% each)
        'e-learning': 24, 'education management': 20, 'higher education': 18,
        'leisure, travel & tourism': 22, 'airlines/aviation': 20,
        'automotive': 18, 'transportation/trucking/railroad': 16,
        # Fourth tier (5–6%)
        'hospital & health care': 22,
        'computer games': 18, 'entertainment': 18,
        'internet': 22, 'consumer services': 18,
        # Conservative (4.6%)
        'computer software': 16, 'information technology & services': 14,
        # Anti-ICP
        'government administration': -100, 'gambling & casinos': -100,
    },
    
    'champion_titles': [
        'Head of Growth', 'VP Growth', 'Head of Marketing',
        'Head of Digital Marketing', 'CMO', 'VP Marketing',
        'Head of Product', 'VP Product', 'Senior Product Manager',
        'Head of D2C', 'Head of Ecommerce',
        'Director of Growth', 'Director Marketing',
        'Head of CRO', 'Head of Optimization', 'Head of Experimentation',
    ],
    
    'champion_titles_relaxed': [
        'Marketing Manager', 'Growth Manager', 'Product Manager',
        'Senior Marketing Manager', 'Senior Growth Manager',
        # for sub-50-employee fallback
        'Founder', 'Co-Founder', 'CEO',
    ],
    
    'direct_competitors': [
        'optimizely.com', 'abtasty.com', 'mida.so', 'convert.com',
        'kameleoon.com', 'webtrends.com', 'omniconvert.com',
    ],
    
    'indirect_competitors_penalty': {
        'hotjar.com': 30, 'fullstory.com': 30, 'mixpanel.com': 25,
        'amplitude.com': 25, 'crazyegg.com': 30, 'mouseflow.com': 30,
        'clarity.microsoft.com': 20, 'adobe.com': 30,  # Adobe Target
    },
    
    'competitor_customer_lookalike_weight': 10,
    
    'traffic_proxy': {
        # Alexa rank → points (mapped to VWO's 150K UV threshold)
        'tier_1_under_50k': 12,
        'tier_2_50k_to_150k': 9,
        'tier_3_150k_to_500k': 5,
        'tier_4_500k_to_1500k': 2,
        'tier_5_above_1500k': 0,
    },
    
    'employee_sweet_spot': (50, 1500),  # mid-market Indian companies
    
    'high_fit_keywords': [
        # D2C / Ecom
        'd2c', 'direct to consumer', 'e-commerce', 'ecommerce', 'online retail',
        'b2c', 'consumer internet', 'mobile commerce',
        # Fintech / BFSI
        'digital lending', 'wealth management', 'mutual funds', 'fintech',
        'insurtech', 'lending platform', 'payment gateway',
        # EdTech
        'edtech', 'online education', 'test prep', 'upskilling',
        # Health
        'health tech', 'diagnostics', 'telemedicine', 'wellness',
        # CRO-relevant
        'subscription', 'membership', 'free trial', 'lead generation',
        'conversion', 'personalization', 'cart', 'checkout', 'signup', 'funnel',
    ],
    
    'intent_signal_weights': {
        'champion_joined_recently': 8,      # 90-day window — single highest signal
        'champion_role_open': 6,            # actively hiring growth/CMO/product
        'general_hiring_volume': 4,         # ≥5 roles open
        'recent_funding': 6,                # 90-day window
        'expansion_news': 4,                # new market / new product line
        'recent_launch_or_replatform': 5,   # 60-day window
        'headcount_growth_15pct': 4,        # past 6mo
        'press_mention_relevant': 4,        # CRO / experimentation / growth keywords
    },
    
    'past_meeting_proven_subsegments': {
        # subsegment → multiplier
        'D2C-Apparel': 1.10,        # 27 past meetings
        'D2C-Beauty': 1.05,
        'D2C-Wellness': 1.05,
        'Fintech-Wealth': 1.05,
        'Fintech-Lending': 1.05,
        'BFSI-Bank': 1.05,
        'BFSI-Wealth': 1.05,
        'Health-Diagnostics': 1.05,
        'EdTech-TestPrep': 1.03,
        'EdTech-Upskilling': 1.03,
    },
    
    # Decay window for intent signals (in days)
    'intent_decay_windows': {
        'champion_joined_recently': 90,
        'recent_funding': 90,
        'expansion_news': 60,
        'recent_launch_or_replatform': 60,
        'press_mention_relevant': 30,
    },
}
```

For a different seller (e.g., a logistics SaaS), you swap this block. The scoring engine logic stays the same.

---

## 4. SOURCE 1 — Base Fit (40 points max)

Same dimensions as v1, just consolidated into a single source.

```python
def base_fit_score(account, config):
    """Returns 0–40 across industry + size + traffic + maturity + keywords."""
    score = 0
    
    # 4.1 Industry fit (max 18)
    primary = (account.get('industry') or '').lower().strip()
    secondary = (account.get('secondary_industries') or '').lower()
    pts = config['industry_weights'].get(primary, 0)
    if pts == 0:
        for ind, w in config['industry_weights'].items():
            if ind in secondary:
                pts = max(pts, int(w * 0.7))
                break
    score += min(18, max(-30, int(pts * 0.6)))  # scale 30 → 18
    
    # 4.2 Size sweet spot (max 8)
    emp = int(account.get('estimated_num_employees') or 0)
    sw_min, sw_max = config['employee_sweet_spot']
    if sw_min <= emp <= sw_max: score += 8
    elif 20 <= emp < sw_min: score += 5
    elif sw_max < emp <= 5000: score += 6
    elif emp > 5000: score += 3
    elif 0 < emp < 20: score += 1
    
    # 4.3 Traffic proxy (max 6)
    alexa = int(account.get('alexa_ranking') or 99_999_999)
    if alexa < 50_000: score += 6
    elif alexa < 150_000: score += 5
    elif alexa < 500_000: score += 3
    elif alexa < 1_500_000: score += 1
    
    # 4.4 Keyword match (max 4)
    text = ' '.join([
        (account.get('keywords') or ''),
        (account.get('short_description') or ''),
        (account.get('secondary_industries') or '')
    ]).lower()
    hits = sum(1 for k in config['high_fit_keywords'] if k in text)
    score += min(4, hits)
    
    # 4.5 Maturity (max 4)
    founded = int(account.get('founded_year') or 0)
    if founded:
        age = 2026 - founded
        if 4 <= age <= 12: score += 4
        elif 13 <= age <= 20: score += 3
        elif age <= 3: score += 1
        elif age >= 21: score += 2
    
    return min(40, max(0, score))
```

---

## 5. SOURCE 2 — Historical Context (15 points max)

Pulls from project documents — past meetings + active client list.

```python
def historical_context_score(account, project_data, config):
    """Returns 0–15 based on past-meeting precedent and active-customer adjacency."""
    score = 0
    
    # 5.1 Past-meeting subsegment precedent (max 6)
    subsegment = infer_subsegment(account)  # e.g., 'D2C-Apparel'
    multiplier = config['past_meeting_proven_subsegments'].get(subsegment, 1.0)
    if multiplier >= 1.10:
        score += 6
    elif multiplier >= 1.05:
        score += 4
    elif multiplier >= 1.03:
        score += 2
    
    # 5.2 Active-customer adjacency (max 6)
    # Match on industry + similar size band
    industry = (account.get('industry') or '').lower()
    emp = int(account.get('estimated_num_employees') or 0)
    
    matches = 0
    for c in project_data['active_clients']:
        c_industry = (c.get('industry') or '').lower()
        c_emp = int(c.get('estimated_num_employees') or 0)
        if c_industry == industry and 0.5 * c_emp <= emp <= 2 * c_emp:
            matches += 1
            if matches >= 5: break
    
    if matches >= 5: score += 6
    elif matches >= 3: score += 4
    elif matches >= 1: score += 2
    
    # 5.3 Won-deal pattern match (max 3, only if won/lost data exists)
    # Skipped for VWO — no won/lost data shared yet. Add when available.
    
    return min(15, score)


def infer_subsegment(account):
    """Map Apollo's industry + keywords to a fine-grained subsegment."""
    industry = (account.get('industry') or '').lower()
    keywords = (account.get('keywords') or '').lower()
    desc = (account.get('short_description') or '').lower()
    
    # D2C apparel
    if industry == 'apparel & fashion':
        return 'D2C-Apparel'
    # D2C beauty
    if industry == 'cosmetics' or any(k in keywords for k in ['skincare', 'makeup', 'beauty']):
        return 'D2C-Beauty'
    # D2C wellness
    if industry == 'health, wellness & fitness' and 'd2c' in keywords:
        return 'D2C-Wellness'
    # Fintech
    if industry == 'financial services':
        if any(k in keywords for k in ['lending', 'loan', 'credit']):
            return 'Fintech-Lending'
        if any(k in keywords for k in ['wealth', 'investment', 'mutual fund', 'broker']):
            return 'Fintech-Wealth'
    if industry == 'banking':
        return 'BFSI-Bank'
    if industry == 'insurance':
        return 'BFSI-Insurance'
    # Health
    if industry == 'hospital & health care' and 'diagnostic' in keywords:
        return 'Health-Diagnostics'
    # EdTech
    if industry == 'e-learning':
        if any(k in keywords for k in ['neet', 'cat', 'gate', 'upsc', 'jee']):
            return 'EdTech-TestPrep'
        return 'EdTech-Upskilling'
    
    return 'Other'
```

---

## 6. SOURCE 3 — Competitor Customer Lookalike (10 points max)

The strongest "hot prospect" signal: an account that uses (or recently used) a VWO competitor. They're already CRO-aware. They're already paying for experimentation. They're a switch candidate.

### 6.1 Build the competitor customer database (one-time per pilot)

```python
def build_competitor_customer_db(config):
    """
    Scrape competitor case study pages, extract customer names/domains.
    Run this ONCE at the start of a pilot. Cache the result.
    Use Tavily or manual scraping.
    """
    competitor_customer_pages = {
        'optimizely': [
            'https://www.optimizely.com/customers/',
            'https://www.optimizely.com/case-studies/',
        ],
        'abtasty': [
            'https://www.abtasty.com/customers/',
            'https://www.abtasty.com/resources/case-studies/',
        ],
        'hotjar': [
            'https://www.hotjar.com/customers/',
        ],
        'mixpanel': [
            'https://mixpanel.com/customers/',
        ],
        'amplitude': [
            'https://amplitude.com/customers',
        ],
        'fullstory': [
            'https://www.fullstory.com/customers/',
        ],
    }
    
    customer_db = {}  # competitor → set of domains
    for competitor, urls in competitor_customer_pages.items():
        domains = set()
        for url in urls:
            content = tavily_extract(url)
            # Parse customer names + URLs from page; resolve to domains
            domains.update(extract_customer_domains(content))
        customer_db[competitor] = domains
    
    return customer_db
```

### 6.2 Score the lookalike match

```python
def competitor_lookalike_score(account, competitor_db, config):
    """Returns 0–10."""
    domain = account['primary_domain'].lower()
    name_norm = (account.get('name') or '').lower()
    
    score = 0
    
    # Direct hit: this account is on a competitor's customer page
    for competitor, domains in competitor_db.items():
        if domain in domains:
            score = 10  # max — they're already a CRO buyer, ripe to switch
            break
    
    # Soft hit: name appears in competitor's case study text
    if score == 0:
        for competitor, content_blob in competitor_db.get('case_study_text', {}).items():
            if name_norm and len(name_norm) > 4 and name_norm in content_blob.lower():
                score = max(score, 6)
    
    # Tech-stack hit (requires BuiltWith / Wappalyzer integration — optional)
    # If the account is using Optimizely's pixel: score = 10
    # Skipped if no tech-stack data source connected.
    
    return min(10, score)
```

### 6.3 What to scrape into the competitor DB

For VWO specifically, prioritize these:
- **Optimizely** (top direct competitor) — full customer page + case studies
- **AB Tasty** — full customer page + case studies
- **Hotjar** (indirect — heatmaps + recordings) — customer page
- **Mixpanel, Amplitude** (indirect — analytics) — customer pages
- **FullStory, Crazy Egg** (indirect — session replay) — customer pages

Each is a one-time scrape (~10–30 minutes of Tavily work). Cache to `/sessions/.../competitor_customers.json` and reuse across pilots.

---

## 7. SOURCE 4 — Intent Signals (35 points max, decay-weighted)

This is the biggest change from v1. Intent signals capture WHEN an account is most likely to buy. They decay over time.

### 7.1 The 8 intent signals for VWO

| # | Signal | Max points | Decay window | How to fetch |
|---|---|---:|---|---|
| I1 | Champion-fit person joined in last 90 days | 8 | 90d | Apollo people search filtered by org + champion titles + start_date |
| I2 | Champion role open (actively hiring) | 6 | 30d | Apollo job postings, filter by champion titles |
| I3 | Recent funding (last 90 days) | 6 | 90d | Tavily search "company name funding 2026" |
| I4 | New product launch / replatform | 5 | 60d | Tavily search "company name launch" + check homepage history |
| I5 | General hiring volume ≥5 roles open | 4 | 30d | Apollo job postings count |
| I6 | Headcount growth ≥15% in 6 months | 4 | 180d (slow signal) | Apollo enrichment field directly |
| I7 | Expansion news (new market / vertical) | 4 | 60d | Tavily search "company expand new market" |
| I8 | Press mention with CRO/experimentation/growth keywords | 4 | 30d | Tavily search "company name conversion OR experimentation OR growth" |

### 7.2 Signal-fetch implementation

```python
import datetime as dt

def intent_signal_score(account, config):
    """Returns 0–35 with decay-weighted signal aggregation."""
    score = 0
    today = dt.date.today()
    signals_found = {}
    
    # I1: Champion-fit person joined in last 90 days  ★ HIGHEST SINGLE SIGNAL ★
    pts = signal_champion_joined_recently(account, config, today)
    if pts > 0: signals_found['I1_champion_joined'] = pts
    score += pts
    
    # I2: Champion role currently open
    pts = signal_champion_role_open(account, config)
    if pts > 0: signals_found['I2_champion_role_open'] = pts
    score += pts
    
    # I3: Recent funding (last 90 days)
    pts = signal_recent_funding(account, config, today)
    if pts > 0: signals_found['I3_recent_funding'] = pts
    score += pts
    
    # I4: Recent launch / replatform
    pts = signal_recent_launch(account, config, today)
    if pts > 0: signals_found['I4_recent_launch'] = pts
    score += pts
    
    # I5: General hiring volume
    pts = signal_general_hiring(account, config)
    if pts > 0: signals_found['I5_general_hiring'] = pts
    score += pts
    
    # I6: Headcount growth (from Apollo enrichment, no extra fetch needed)
    pts = signal_headcount_growth(account, config)
    if pts > 0: signals_found['I6_headcount_growth'] = pts
    score += pts
    
    # I7: Expansion news
    pts = signal_expansion(account, config, today)
    if pts > 0: signals_found['I7_expansion'] = pts
    score += pts
    
    # I8: Press mention with relevant keywords
    pts = signal_press_mention(account, config, today)
    if pts > 0: signals_found['I8_press_mention'] = pts
    score += pts
    
    return min(35, score), signals_found
```

### 7.3 Per-signal fetch logic

#### I1: Champion-fit person joined in last 90 days

```python
def signal_champion_joined_recently(account, config, today):
    """
    Use Apollo people search filtered by organization + champion titles.
    For each match, check the LinkedIn URL or 'organization_started' if available.
    Score 8 if anyone joined in last 90 days, 4 if last 180 days, 0 otherwise.
    """
    org_id = account.get('apollo_org_id')
    if not org_id: return 0
    
    # Apollo call (free — no credits)
    results = apollo_mixed_people_api_search(
        organization_ids=[org_id],
        person_titles=config['champion_titles'],
        person_seniorities=['c_suite', 'vp', 'head', 'director'],
        per_page=25,
    )
    
    if not results.get('people'): return 0
    
    # Apollo's response includes 'organization_started' or 'employment_history' for each person
    # Check if any person started at this org within the last 90 days
    cutoff_90 = today - dt.timedelta(days=90)
    cutoff_180 = today - dt.timedelta(days=180)
    
    for person in results['people']:
        start = parse_org_start_date(person)  # parse from employment_history
        if start and start >= cutoff_90: return 8
    
    for person in results['people']:
        start = parse_org_start_date(person)
        if start and start >= cutoff_180: return 4
    
    return 0


def parse_org_start_date(person):
    """
    Apollo person object has 'employment_history' list.
    Find the entry matching the current organization and parse start_date.
    Returns datetime.date or None.
    """
    org_id = person.get('organization', {}).get('id')
    if not org_id: return None
    for emp in person.get('employment_history', []):
        if emp.get('organization_id') == org_id and emp.get('current'):
            start_str = emp.get('start_date')  # 'YYYY-MM-DD' or 'YYYY-MM'
            if start_str:
                try:
                    parts = start_str.split('-')
                    if len(parts) >= 2:
                        return dt.date(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) >= 3 else 1)
                except: pass
    return None
```

#### I2: Champion role currently open

```python
def signal_champion_role_open(account, config):
    """
    Use apollo_organizations_job_postings (1 credit per call) OR
    use the apollo people search with organization_job_titles filter (free).
    
    Free method:
    """
    org_id = account.get('apollo_org_id')
    if not org_id: return 0
    
    # apollo_mixed_people_api_search with organization_job_titles filter
    # tells you which job titles are CURRENTLY being recruited at this org.
    results = apollo_mixed_people_api_search(
        organization_ids=[org_id],
        q_organization_job_titles=config['champion_titles'],
        organization_job_posted_at_range={'min': (dt.date.today() - dt.timedelta(days=30)).isoformat()},
        per_page=10,
    )
    
    if results.get('people'):
        return 6
    return 0
```

Alternatively, paid method using job_postings endpoint (1 credit):
```python
def signal_champion_role_open_paid(account, config):
    """1 credit per call; only use for top-50 priority leads."""
    org_id = account.get('apollo_org_id')
    if not org_id: return 0
    
    postings = apollo_organizations_job_postings(id=org_id)
    relevant = [p for p in postings.get('job_postings', [])
                if any(t.lower() in p.get('title', '').lower() for t in config['champion_titles'])]
    if relevant: return 6
    return 0
```

#### I3: Recent funding

```python
def signal_recent_funding(account, config, today):
    """
    Tavily search for "<company> funding 2026" or "<company> Series 2026".
    Parse for dates within last 90 days.
    """
    company = account.get('name', '')
    if not company: return 0
    
    query = f'"{company}" funding round 2026 OR Series A OR Series B OR Series C OR Series D'
    results = tavily_search(query, search_depth='advanced', max_results=5)
    
    if not results.get('results'): return 0
    
    # Look for date strings in last 90 days
    cutoff = today - dt.timedelta(days=90)
    for r in results['results']:
        content = r.get('content', '') + r.get('title', '')
        # Date extraction (regex for dd Month YYYY / Month YYYY / YYYY-MM)
        if extract_recent_date(content, cutoff):
            return 6
    
    return 0
```

#### I4: Recent launch / replatform

```python
def signal_recent_launch(account, config, today):
    """
    Tavily search for "<company> launch" OR "<company> redesign" 
    OR "<company> new product". Last 60 days.
    """
    company = account.get('name', '')
    if not company: return 0
    
    query = f'"{company}" launch OR redesign OR "new product" OR replatform 2026'
    results = tavily_search(query, search_depth='advanced', max_results=5)
    
    cutoff = today - dt.timedelta(days=60)
    for r in results.get('results', []):
        content = r.get('content', '') + r.get('title', '')
        if extract_recent_date(content, cutoff):
            return 5
    return 0
```

#### I5: General hiring volume

```python
def signal_general_hiring(account, config):
    """
    Use Apollo's organization_num_jobs_range to count open roles.
    Free via people search (with organization_num_jobs_range filter).
    """
    # Cheap option: use apollo_mixed_companies_search with organization_num_jobs_range
    # to bucket which orgs have ≥5 open jobs. Done at the universe level once.
    
    # If the data is already on the account from a prior search:
    n_jobs = int(account.get('total_open_jobs') or 0)
    if n_jobs >= 15: return 4
    if n_jobs >= 5: return 3
    return 0
```

#### I6: Headcount growth

```python
def signal_headcount_growth(account, config):
    """No fetch needed — Apollo enrichment already has this."""
    h6 = float(account.get('headcount_six_month_growth') or 0)
    h12 = float(account.get('headcount_twelve_month_growth') or 0)
    if h6 >= 0.20 or h12 >= 0.40: return 4
    if h6 >= 0.15 or h12 >= 0.30: return 3
    if h6 >= 0.10 or h12 >= 0.20: return 2
    return 0
```

#### I7: Expansion news

```python
def signal_expansion(account, config, today):
    """
    Tavily search for "<company> expansion" OR "new market" OR "tier-2" 
    OR "tier-3" OR "GCC" OR "Southeast Asia".
    """
    company = account.get('name', '')
    if not company: return 0
    
    query = f'"{company}" expansion OR "new market" OR "tier-2" OR "GCC" 2026'
    results = tavily_search(query, search_depth='advanced', max_results=3)
    
    cutoff = today - dt.timedelta(days=60)
    for r in results.get('results', []):
        content = r.get('content', '') + r.get('title', '')
        if extract_recent_date(content, cutoff):
            return 4
    return 0
```

#### I8: Press mention with relevant keywords

```python
def signal_press_mention(account, config, today):
    """
    Tavily search for "<company>" + relevant keywords (conversion, growth, experimentation).
    Last 30 days.
    """
    company = account.get('name', '')
    if not company: return 0
    
    query = f'"{company}" conversion OR experimentation OR "growth marketing" OR "user experience" 2026'
    results = tavily_search(query, search_depth='advanced', max_results=5)
    
    cutoff = today - dt.timedelta(days=30)
    hits = 0
    for r in results.get('results', []):
        content = r.get('content', '') + r.get('title', '')
        if extract_recent_date(content, cutoff):
            hits += 1
    
    if hits >= 2: return 4
    if hits >= 1: return 2
    return 0
```

### 7.4 Intent signals — cost and tier strategy

Intent fetching is expensive in time + Tavily quota. Tier the effort by score.

| Tier | Account count | Intent fetches | Cost |
|---|---:|---|---|
| Top 50 (Priority bucket) | 50 | All 8 signals | ~50 Tavily searches + Apollo people searches (free) |
| Active bucket (51–300) | 250 | I1, I2, I6 only (cheap from Apollo) | ~0 Tavily, free Apollo |
| Nurture bucket (300–800) | 500 | I6 only (already in enrichment) | Free |
| Watch / Excluded | rest | None | Free |

For a 50-lead pilot: ~50 Tavily searches and ~100 Apollo people searches. Tavily plan covers it; Apollo searches are free.

---

## 8. Final score formula

```python
def score_account_v2(account, project_data, competitor_db, config):
    """
    Returns: (final_score, breakdown_dict)
    """
    # Hard filter
    passes, reason = hard_filter_vwo(account, project_data)
    if not passes:
        return 0, {'excluded': reason}
    
    # Source scores
    s1 = base_fit_score(account, config)                                # 0–40
    s2 = historical_context_score(account, project_data, config)        # 0–15
    s3 = competitor_lookalike_score(account, competitor_db, config)     # 0–10
    s4, signals = intent_signal_score(account, config)                  # 0–35
    
    base = s1 + s2 + s3 + s4  # max 100
    
    # Penalties
    penalty = compute_penalties(account, config)
    final = max(0, min(100, base - penalty))
    
    return round(final, 1), {
        'final_score': round(final, 1),
        'base_fit': s1,
        'historical_context': s2,
        'competitor_lookalike': s3,
        'intent_signals_total': s4,
        'intent_signals_detail': signals,
        'penalty': penalty,
        'subsegment': infer_subsegment(account),
    }
```

---

## 9. Bucket thresholds (recalibrated for v2)

Because intent signals add 0–35 dynamic points, the v1 buckets need recalibration. Average scores will be HIGHER for accounts with active intent signals.

| Score | Bucket | Meaning |
|---:|---|---|
| 80–100 | **Hot** | Strong fit + active intent signals. 1:1 personalised, multi-channel, AE warm intro path. |
| 65–79 | **Priority** | Strong fit, modest intent. 3-step email sequence with deep observation research. |
| 50–64 | **Active** | Solid fit, no immediate intent. Standard 3-step sequence with category-pattern observations. |
| 35–49 | **Nurture** | Mid fit. Newsletter / quarterly check-in. Re-evaluate when signals fire. |
| <35 | **Watch / Excluded** | Don't contact. Re-score quarterly. |

The "Hot" bucket is where the v1 framework was structurally weak — it had no way to identify accounts that became hot. v2 explicitly captures it.

---

## 10. Refresh cadence (intent signals decay)

Unlike base fit (which is stable), intent signals decay. Re-fetch them on this schedule:

| Signal | Refresh frequency |
|---|---|
| I1 Champion joined | Weekly (signal is fresh and decisive) |
| I2 Champion role open | Weekly |
| I3 Recent funding | Weekly |
| I4 Recent launch | Weekly |
| I5 General hiring | Bi-weekly |
| I6 Headcount growth | Monthly (slow signal) |
| I7 Expansion news | Weekly |
| I8 Press mention | Weekly |

For a 50-lead pilot: re-run intent fetching weekly on the Hot + Priority bucket only (~80 accounts). That's ~80 × 4 Tavily searches per week = 320 searches.

When a Watch-bucket account suddenly fires an intent signal (e.g., it raised a Series B), the auto-promote logic kicks in:

```python
def auto_promote_on_signal(account, current_bucket):
    if current_bucket in ('Watch', 'Nurture'):
        if account.get('signals', {}).get('I3_recent_funding') or \
           account.get('signals', {}).get('I1_champion_joined'):
            return 'Priority'  # promote two buckets
    return current_bucket
```

---

## 11. Sample full-trace v2 (illustrative)

Same hypothetical account from v1 (Indian D2C apparel, 220 emp, founded 2018, alexa 84K), now WITH a fresh intent signal: their CMO joined 3 weeks ago.

```
HARD FILTER: PASS (India, not in DNC/active/past)

SOURCE 1 — Base Fit (max 40):
  Industry (apparel & fashion = 30 → scaled to 18):     +18
  Size (220 emp in sweet spot):                          +8
  Traffic (alexa 84K):                                   +5
  Keywords (5 hits):                                     +4
  Maturity (founded 2018, age 8):                        +4
  Subtotal:                                              39 / 40

SOURCE 2 — Historical Context (max 15):
  Past-meeting precedent (D2C-Apparel: 27 meetings):     +6
  Active-customer adjacency (5 active in apparel):       +6
  Subtotal:                                              12 / 15

SOURCE 3 — Competitor Lookalike (max 10):
  Hit on Hotjar customer page:                           +6
  Subtotal:                                              6 / 10

SOURCE 4 — Intent Signals (max 35):
  I1 New CMO joined 3 weeks ago:                         +8 ★
  I2 Hiring Head of Growth:                              +6
  I3 Series B announced 6 weeks ago:                     +6
  I6 Headcount growth 18% in 6mo:                        +3
  I8 Two press mentions about D2C scale:                 +4
  Subtotal:                                              27 / 35

BASE = 39 + 12 + 6 + 27 = 84
PENALTIES: 0
FINAL SCORE: 84 → "Hot" bucket
```

Compare with v1 (which scored 100 on the same firmographics but missed entirely that the CMO had just joined). v1 was right that this account is a fit; v2 is right that this account is a fit AND ready to buy.

---

## 12. End-to-end runbook for a fresh pilot

```
┌─ Phase 0: Setup
│   Load project data: ICP brief, active clients, DNC, past meetings
│   Build competitor customer DB (Tavily, one-time, cached)
│   Load product config (industry weights, champion titles, etc.)
│
├─ Phase 1: Universe construction
│   Get target list, apply hard filter (India + DNC + active + past + competitor + anti-ICP)
│   Result: eligible domains
│
├─ Phase 2: Apollo enrichment
│   Bulk enrich top 600 priority subset (1 credit per match)
│   Result: enriched accounts
│
├─ Phase 3: SOURCE 1 + 2 + 3 (static, run once)
│   For each enriched account, compute base fit + historical + competitor lookalike
│   Result: static_score (0–65)
│
├─ Phase 4: Bucket 1 — Hot/Priority candidates
│   Sort by static_score, take top 200
│   These are the candidates for intent fetching
│
├─ Phase 5: SOURCE 4 — Intent signals (top 200 only)
│   For each top-200 account:
│     Fetch I1, I2 via Apollo people search (free)
│     Fetch I3, I4, I7, I8 via Tavily search
│     I5, I6 from existing enrichment
│   Result: intent_score (0–35)
│
├─ Phase 6: Final score + bucket
│   final_score = static_score + intent_score
│   Bucket: Hot (80+) / Priority (65–79) / Active (50–64) / Nurture (35–49)
│
├─ Phase 7: Industry diversity cap when picking top 50 for pilot
│
├─ Phase 8: Stakeholder discovery (Apollo people search) for top 50
│
├─ Phase 9: Email enrichment (Apollo bulk_match, 1 credit per match)
│
├─ Phase 10: Per-account research + email drafting
│
└─ Phase 11: Validation, Smartlead import
```

Total cost for a 50-lead pilot (v2):
- Apollo: ~480 enrichment + 80 intent (free people search) + 50 email = **~530 credits**
- Tavily: ~80 priority intent + ~50 research = **~130 searches**
- Subagent compute: ~30 minutes total

---

## 13. Calibration test (validates v2 is better than v1)

After 30+ pilot meetings, run this:

```python
def validate_v2_vs_v1(meetings, accounts_v1, accounts_v2):
    """
    For each meeting outcome (booked / no-show / declined),
    compare how v1 vs v2 scored that account.
    """
    booked = [m for m in meetings if m.outcome == 'booked']
    no_show = [m for m in meetings if m.outcome != 'booked']
    
    v1_lift = mean([accounts_v1[m.domain]['score'] for m in booked]) - \
              mean([accounts_v1[m.domain]['score'] for m in no_show])
    
    v2_lift = mean([accounts_v2[m.domain]['final_score'] for m in booked]) - \
              mean([accounts_v2[m.domain]['final_score'] for m in no_show])
    
    print(f"v1 lift (booked vs no-show): {v1_lift:+.1f}")
    print(f"v2 lift (booked vs no-show): {v2_lift:+.1f}")
    print(f"v2 should beat v1 by 5+ points if intent signals are predictive")
```

If v2's lift over v1 is <3 points, intent signals are not adding value — likely the signals aren't fresh enough or the weights are wrong. Investigate.

---

## 14. What's still missing (future work)

- **Won/lost deal pattern matching** — currently skipped (no won/lost data shared). When VWO shares closed-won/lost, add a dimension that scores accounts that look like won deals higher.
- **Tech stack signal** — would unlock direct competitor-detection (account uses Optimizely's pixel = high switch likelihood). Requires BuiltWith / Wappalyzer integration.
- **CMO LinkedIn post engagement** — accounts whose CMO recently posted about CRO / experimentation are ripe. Requires LinkedIn Sales Nav / Phantombuster.
- **Outbound email engagement scoring** — once we have campaign data (open/reply patterns), feed back into next pilot's score weighting.
- **Conversion-rate self-disclosure** — if a company publicly cites their own conversion rate or growth metrics in interviews / podcasts, surface that as a signal.

These are roadmap items. v2 as-is is shippable.

---

## 15. Per-product config — drop-in pattern for a different seller

Same engine, different config. Example for a hypothetical logistics SaaS seller (Trackon-style):

```python
LOGISTICS_SAAS_CONFIG = {
    'product_name': 'LogisticsTrackerCo',
    'geography_hard_filter': ['India', 'Singapore', 'Malaysia'],  # SEA logistics focus
    
    'industry_weights': {
        'logistics & supply chain': 30,
        'transportation/trucking/railroad': 28,
        'warehousing': 26,
        'retail': 22,         # large retailers run logistics
        'consumer goods': 20,
        'apparel & fashion': 16,  # D2C with shipping needs
        'food & beverages': 18,
        # Anti-ICP
        'banking': -50, 'higher education': -30, 'real estate': -20,
    },
    
    'champion_titles': [
        'Head of Operations', 'VP Operations', 'COO',
        'Head of Logistics', 'Head of Supply Chain',
        'Director of Operations', 'Director Logistics',
        'Head of Warehousing', 'VP Supply Chain',
    ],
    
    'direct_competitors': [
        'fship.in', 'shiprocket.com', 'pickrr.com', 'shyplite.com',
    ],
    
    # ... rest of config
}
```

The scoring engine code does not change. Only the config block does.

---

## End notes

v2's architecture forces the campaign to focus on accounts that are READY TO BUY, not just accounts that fit the ICP. The historical pattern with v1: every D2C apparel brand in India scored 80+. Every one. So the rubric was useless for picking the top 50 from the top 600.

v2 differentiates: an apparel brand that just hired a new CMO and raised a Series B scores 84. An identical apparel brand sitting quietly without any intent signal scores 60. That's the gap that decides reply rates.

Use the v2 framework. Refresh intent signals weekly. Recalibrate the static weights quarterly from new past-meeting data. Audit with the validation test in section 13. Trust the buckets.
