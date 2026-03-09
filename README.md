# Slidelot

Open-source TikTok carousel generator with auto-learning feedback loops. Generate viral hooks, create slideshows, post drafts, and improve from analytics — all for ~$0.30/post.

<img width="977" height="855" alt="Screenshot 2026-03-09 at 14 18 40" src="https://github.com/user-attachments/assets/bc17e04f-d7f1-4d1c-9dd8-ad8667889454" />

## What it does

1. **Generate hooks** — Claude generates scroll-stopping hook texts based on your niche
2. **Create slides** — Each hook becomes a 6-slide carousel (AI images + text overlays)
3. **Review & approve** — Swipe through a queue, edit/reject/approve posts
4. **Post to TikTok** — Approved posts get pushed as drafts via Postiz (you add music)
5. **Learn & improve** — Analytics feed back into the system, tracking winners and losers

## Why slideshows?

Carousels get 2.9x more comments, 1.9x more likes, and 2.6x more shares than video on TikTok. They cost ~$0.30 vs $2-10 for AI video, enabling a 2-3 posts/day strategy.

## Tech stack

React 19 · Hono · tRPC · Drizzle · SQLite · TanStack Router · Tailwind CSS · shadcn/ui · Bun · Turborepo

**AI services:** Claude Sonnet (hooks/captions) · FAL.ai (image generation — FLUX, Recraft, GPT Image, Imagen) · Sharp (text overlays)

## Getting started

```bash
bun install
cp apps/server/.env.example apps/server/.env  # add your API keys
bun run db:push
bun run dev
```

Web UI at [localhost:3001](http://localhost:3001), API at [localhost:3000](http://localhost:3000).

## Project structure

```
slidelot/
├── apps/
│   ├── web/          # React frontend
│   └── server/       # Hono API server
├── packages/
│   ├── api/          # tRPC routers + services (Claude, FAL, Postiz)
│   ├── db/           # Drizzle schema + migrations
│   ├── env/          # Environment validation
│   └── config/       # Shared TypeScript config
```

## License

MIT
