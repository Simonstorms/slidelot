# AI TikTok Slideshow Generator — Full Info Sheet

## What It Does
Personal tool that generates TikTok photo carousel slideshows for your product. You trigger everything manually from a dashboard, review and approve, then add music in TikTok and publish. The system tracks performance and gets smarter over time.

## Why Slideshows, Not Video
- TikTok data: carousels get 2.9x more comments, 1.9x more likes, 2.6x more shares vs video
- TikTok algorithm actively pushing slideshows in 2026
- AI image gen is solved — consistent, cheap, fast
- AI video is expensive ($0.10-0.40/sec) and inconsistent
- Cost: ~$0.30-0.70 per slideshow vs $2-10 per video
- Volume wins on TikTok — need 2-3 posts/day, slideshows make that affordable

## Tech Stack

| Layer         | Tech                          |
|---------------|-------------------------------|
| Runtime       | Bun                           |
| Monorepo      | Turborepo                     |
| Backend       | Hono                          |
| API           | tRPC                          |
| Frontend      | React + TanStack Router       |
| Database      | SQLite + Drizzle ORM          |
| UI            | shadcn/ui + Tailwind          |
| Scaffolded    | Better-T-Stack                |

## Project Structure

```
slidelot/
├── apps/
│   ├── server/          # Hono backend (port 3000)
│   │   └── src/index.ts # tRPC at /trpc/*, CORS, logger
│   └── web/             # React frontend (port 3001)
│       └── src/
│           ├── routes/  # TanStack file-based routing
│           ├── components/ui/  # shadcn components
│           └── utils/trpc.ts   # tRPC client
├── packages/
│   ├── api/             # tRPC routers (packages/api/src/routers/)
│   ├── db/              # Drizzle schema (packages/db/src/schema/)
│   ├── config/          # Shared TS config
│   └── env/             # Zod env validation
```

## Models & Services

### Core (required)

| Component          | Model/Service            | Price           | Notes                                              |
|--------------------|--------------------------|-----------------|----------------------------------------------------|
| Hook + caption     | Claude Sonnet 4.5        | ~$0.02/post     | Structured output: hook, script, caption, CTA      |
| Image generation   | OpenAI GPT Image 1.5     | $0.04-0.12/img  | Highest quality (1264 Elo). Batch API = half price  |
| Text overlay       | sharp (local)            | Free            | Full control over font size, position, line breaks  |
| TikTok posting     | Postiz API               | Their pricing   | Posts as drafts. Also provides analytics API        |

### Optional / Future

| Component          | Model/Service            | Price           | Notes                                              |
|--------------------|--------------------------|-----------------|----------------------------------------------------|
| Text-heavy slide 1 | Ideogram 3 API          | ~$0.04/img      | Best text rendering if sharp overlay not enough     |
| Cheaper images     | Gemini 3 Pro Image       | ~$0.02/img      | Great quality, half the price of OpenAI             |
| Fast/cheap images  | Flux 2 Pro via fal.ai    | ~$0.03/img      | Best value, ultra fast                              |
| Revenue tracking   | RevenueCat API           | Free tier       | Full funnel: views -> downloads -> trials -> paid   |
| Video (later)      | fal.ai gateway           | $0.05-0.40/sec  | 600+ models: Kling 3.0, Veo 3.1, Sora 2 via 1 API |
| Voice (later)      | Fish Audio               | ~$60-90/yr      | #1 on TTS-Arena, better value than ElevenLabs      |

### Skipped

| Skipped       | Why                                                                    |
|---------------|------------------------------------------------------------------------|
| Higgsfield    | UI layer over other models. Bad API docs. No benefit over direct calls |
| Midjourney    | No public API. Discord-only. Can't use programmatically                |
| Runway Gen4.5 | Great for video but we're doing slideshows. Expensive                  |
| ElevenLabs    | Fish Audio is cheaper and ranked #1 on TTS-Arena                       |

## Cost Per Slideshow

| Item                              | Cost         |
|-----------------------------------|--------------|
| 6 images (GPT Image 1.5 batch)   | ~$0.24-0.48  |
| Claude for hook + caption         | ~$0.02       |
| Text overlay (sharp, local)       | $0.00        |
| **Total**                         | **~$0.30-0.50** |

At 3 posts/day: ~$30-45/month

## The 6-Slide Structure

| Slide | Purpose        | Details                                            |
|-------|----------------|----------------------------------------------------|
| 1     | Hook           | Bold text overlay + scene. Determines everything   |
| 2     | Problem        | Relatable pain point your audience feels           |
| 3     | Discovery      | "Then I found..." moment                           |
| 4     | Transform 1    | Before/after or first result                       |
| 5     | Transform 2    | Another angle or deeper result                     |
| 6     | CTA            | Soft sell, natural product mention                 |

## Image Generation Rules

| Rule                 | Value                        | Why                                                |
|----------------------|------------------------------|----------------------------------------------------|
| Dimensions           | 1024x1536 portrait           | Always. TikTok is vertical                         |
| Scene consistency    | One locked description       | Same scene across all 6. Only style/content changes |
| Text font size       | 6.5% of image height         | Smaller = unreadable on phones                     |
| Text position        | 30% from top                 | Top 10% hidden by TikTok status bar                |
| Bottom dead zone     | Bottom 20%                   | Hidden by caption + buttons                        |
| Line breaks          | Every 4-6 words              | Prevents horizontal squashing                      |
| Hook on slide 1      | Full hook, never split       | People swipe away before slide 2                   |

## Hook Strategy

### Proven Formulas
- "I showed my [person] what AI thinks and they couldn't believe it"
- "Nobody talks about..."
- "POV: you just discovered..."
- "I was today years old when..."
- "[Person] reacted to..."

### Rules
- Always include another person + their reaction (relatability)
- "I redesigned my room" = nothing. "I showed my landlord" = 200K views
- 80% of creative energy goes into hooks
- Every hook scored by views after posting
- Winners cloned into 3 variations
- Losers logged with reasons

## Caption Rules
- Storytelling format, not feature lists or ad copy
- Continue narrative from the hook
- Natural product mention: "I used [app] and honestly wasn't expecting much but look at this"
- Never: "Download MyApp now!"
- Max 5 hashtags (TikTok limit)

## Database Schema

### Tables

**posts** — generated slideshow posts
- id, hookId, status (pending/approved/posted/rejected)
- slides (json array of file paths)
- caption, postedAt, postizId, createdAt

**hooks** — hook texts with performance scores
- id, text, formula, viewCount, score
- status (untested/winner/loser)
- parentHookId (for variations), createdAt

**analytics** — performance data per post
- id, postId, views, likes, comments, shares
- downloads, trials, conversions, pulledAt

**learnings** — auto-generated rules from performance
- id, rule, source (auto/manual), createdAt

**settings** — niche, product info, API keys
- key, value

## tRPC Routers

### posts
- posts.list — filter by status (pending, approved, posted)
- posts.get — single post with slides
- posts.approve — sets status, triggers Postiz upload
- posts.reject — sets status, logs reason
- posts.regenerate — re-queues with same hook

### hooks
- hooks.list — all hooks with scores
- hooks.generate — trigger Claude to generate new hooks
- hooks.update — edit a hook

### generation
- generation.createSlides — generate slideshow for a hook
- generation.status — check if generation is running

### analytics
- analytics.dashboard — today's numbers, top posts
- analytics.diagnosis — the 2x2 matrix (views x conversions)
- analytics.pull — trigger Postiz analytics fetch
- analytics.report — run diagnosis + update learnings

### settings
- settings.get — read all settings
- settings.update — update a setting

## Dashboard Routes

| Route         | Purpose                                              |
|---------------|------------------------------------------------------|
| /             | Dashboard — quick stats, recent posts                |
| /generate     | Generate hooks -> create slides -> review            |
| /queue        | Review queue — swipeable slide previews, approve/reject |
| /post/$id     | Single post — full slide gallery, caption, analytics |
| /hooks        | Hook library — scored list, formulas, winners/losers |
| /analytics    | Performance charts + diagnosis matrix                |
| /settings     | Config: niche, product, API keys                     |

## User Flow (all manual, no cron)

```
1. Open dashboard -> hit "Generate Hooks"
   -> Claude generates 5-10 hooks based on niche + past performance

2. Pick hooks you like -> hit "Create Slides"
   -> GPT Image 1.5 generates 6 images per hook
   -> sharp adds text overlay to slide 1
   -> Claude writes caption
   -> Posts land in review queue

3. Review queue -> swipe through slides, read caption
   -> Approve / Edit / Reject / Regenerate

4. Approved posts -> auto-push to TikTok as drafts via Postiz

5. Open TikTok -> add trending music -> publish (60 sec)

6. When you want -> hit "Pull Analytics"
   -> Fetches view counts from Postiz
   -> Optional: fetches revenue from RevenueCat

7. When you want -> hit "Run Report"
   -> Diagnosis matrix runs
   -> Updates hook scores
   -> Generates winner variations
   -> Logs failures
   -> Updates knowledge/learnings
```

## Feedback Loop — Diagnosis Matrix

| Views | Conversions | Diagnosis              | Action                              |
|-------|-------------|------------------------|-------------------------------------|
| High  | High        | Winner                 | Generate 3 hook variations, scale   |
| High  | Low         | Wrong audience / weak CTA | Keep hook, rotate CTA            |
| Low   | High        | Great CTA, weak hook   | Keep CTA, test stronger hooks       |
| Low   | Low         | Dud                    | Drop it, log to failures            |

### Bigger Picture

| Signal                                     | Problem                | Fix                    |
|--------------------------------------------|------------------------|------------------------|
| Views + downloads up, nobody paying        | App onboarding/paywall | Pause posting, fix app |
| Views up, nobody downloading               | CTAs not working       | Rotate CTAs            |
| Everything converting, views low           | Content great, hooks weak | Focus on stronger hooks |

## Knowledge System (compounds over time)

Stored in DB (learnings table) and injected into Claude prompts each generation:

- **Hook formulas** — seeded with proven templates, grows as winners emerge
- **Failures** — every flop with hook text, view count, one-line reason
- **Rules** — auto-generated from data ("hooks with reactions outperform solo 3:1")

## TikTok Account Tips
- Warm up 7-14 days before posting (scroll, like 1 in 10, follow niche accounts)
- Ready when For You page is almost entirely your niche
- Post as drafts, add trending music manually (10x reach vs no music)
- 3 posts/day target, ~1 in 4 clearing 50K views is the goal
- Never let TikTok auto-pick audio

## Environment Variables Needed

### Server (apps/server/.env)
```
DATABASE_URL=file:../../local.db
CORS_ORIGIN=http://localhost:3001
NODE_ENV=development
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
POSTIZ_API_KEY=...
POSTIZ_INTEGRATION_ID=...
REVENUECAT_API_KEY=...          # optional
```

### Web (apps/web/.env)
```
VITE_SERVER_URL=http://localhost:3000
```

## Build Order

1. DB schema + migrations (packages/db)
2. tRPC routers — settings, hooks, posts, generation, analytics (packages/api)
3. Generation logic — Claude for hooks/captions, OpenAI for images, sharp for overlays (apps/server)
4. Settings page — configure niche, product, API keys
5. Generate page — trigger hooks, create slides
6. Queue page — review, approve/reject (mobile-first)
7. Post detail page — slide gallery + analytics
8. Postiz integration — push approved posts as TikTok drafts
9. Analytics pull — fetch performance from Postiz
10. Report/diagnosis — feedback loop, knowledge updates
11. Hooks page — library, scores, formulas
12. Analytics dashboard — charts, diagnosis matrix
