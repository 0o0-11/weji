# WEJI ويجي — MVP Spec

**One line:** A bilingual (English/Arabic) image search engine for photos and news pictures,
with a 3D landing page and a 3D image viewer.

**Core goal:** make finding pictures easy — through search, and through pictures themselves.

---

## Decisions locked (from the product interview)

| Area | Decision |
|---|---|
| Image sources | Unsplash + Pexels APIs, plus a news-picture feed |
| News source | Free RSS feeds — no key, no limit (final list below) |
| Stack | Next.js + Supabase + Vercel |
| Sign-in | Email + password |
| 3D scope | 3D landing page + 3D image viewer; browsing grid stays fast and flat |
| Arabic search | Auto-translate AR→EN, and show the user what we searched for |
| Language | Auto-detect from browser, `عربي / EN` switch always visible, choice remembered |
| Look | Dark cinematic, near-black, one glowing accent |
| Content safety | Strict filtering, always on, no user override |
| Sign-in wall | None — browse and search freely; account only to save/like/follow/download |
| User actions | Save to collections, Download at screen sizes, Like, Follow topics, Share |

---

## Delivery plan

**Phase 1 — the core — ✅ done**
3D landing page · bilingual search with AR→EN translation · image grid · 3D image viewer ·
news + popular-photograph home feed · strict safety filter · full RTL/LTR

**Phase 2 — the account — ✅ done**
Email + password sign-in · save to collections · download at screen sizes · like · share

**Phase 3 — personalisation + launch**
Follow topics · personalised home feed · deploy live to Vercel

### One design decision inside phase 2

You chose "browse freely, sign in only to save". Taken literally that means a visitor who
presses Save gets a wall before they have ever used the feature.

Instead, saving and liking work **immediately, stored on the visitor's own device**, with a
clear note saying so and an invitation to create an account. The moment they sign up,
everything they already saved is lifted into their account automatically. They get to want the
feature before being asked to pay for it in effort — and nothing they did is lost.

---

## Architecture

```
Browser  ──►  Next.js (Vercel)  ──►  /api/search    ──►  Unsplash + Pexels
                                ──►  /api/news      ──►  RSS feeds
                                ──►  /api/translate ──►  AR→EN dictionary (+ fallback)
                                ──►  Supabase       ──►  accounts, collections, likes
```

API keys live only on the server. The browser never sees them.

---

## News sources — what actually survived testing

Every candidate feed was checked for real, current, story-specific pictures.

**In use — English:** BBC News · The Guardian · Sky News
**In use — Arabic:** بي بي سي عربي · فرانس 24 · RT عربي

**Rejected, and why:**

| Feed | Reason |
|---|---|
| Al Jazeera (EN + AR) | Publishes no images in RSS at all |
| DW Arabic, Euronews Arabic | No images in RSS |
| Al Arabiya, Sky News Arabia | Refuse non-browser clients (connection dropped) |
| CNN | Attaches generic stock photos years old, not the story's picture |

> **One editorial call for you:** *RT عربي* is Russian state-funded media. It is one of very few
> Arabic feeds that publishes real story pictures, so it's included and every card is labelled
> with its outlet. If you'd rather not carry it, say so — it's one line to remove.

---

## Two engineering decisions worth knowing about

**1. The 3D is built with CSS 3D, not WebGL/three.js.**
A WebGL scene would add ~600 KB to every page load and is the single most common cause of
"the site is slow on my phone". CSS 3D gives a real perspective scene — depth, drag-to-orbit,
fog, glow — with zero extra download and smooth performance on low-end Android. If you later
want a heavier WebGL showpiece, it drops into the same slot without touching anything else.

**2. Arabic search is a dictionary first, a translation API second.**
A hand-built list of the most common Arabic visual-search terms answers instantly, offline, and
with no per-request cost or rate limit. Anything not in the list falls back to a free translation
service. This keeps the most common searches fast and free.

---

## What the owner needs to provide

| # | What | Where | Cost |
|---|---|---|---|
| 1 | Unsplash API key | unsplash.com/developers | Free |
| 2 | Pexels API key | pexels.com/api | Free |
| 3 | Supabase project (phase 2) | supabase.com | Free tier |
| 4 | Vercel account (phase 3) | vercel.com | Free tier |

Nothing is needed to see Phase 1 running locally — it ships with a demo mode.
