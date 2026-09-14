# WEJI ويجي

A bilingual (English / Arabic) visual search engine for photos, wallpapers and news
pictures — with a 3D landing page and a 3D image viewer.

> Full product spec and decisions: [WEJI-SPEC.md](WEJI-SPEC.md)

---

## Run it

```bash
npm run dev
```

Then open **http://localhost:3000**.

It works immediately with no setup — with no API keys it runs in **demo mode** and shows
placeholder pictures so you can click through the whole app. Real news pictures work in
demo mode too, because they come from free RSS feeds rather than an API.

---

## Turn on real photos

Two free keys, about ten minutes:

1. **Unsplash** — <https://unsplash.com/developers> → *New Application* → copy the **Access Key**
2. **Pexels** — <https://www.pexels.com/api/> → sign up → copy **Your API Key**

Then copy `.env.local.example` to `.env.local`, paste the keys in, and restart `npm run dev`.

---

## What's here

| Path | What it is |
|---|---|
| `src/app/page.tsx` | 3D landing page |
| `src/app/home/page.tsx` | Home feed — live news pictures + trending wallpapers |
| `src/app/search/page.tsx` | Search results |
| `src/app/api/search` | Search across Unsplash + Pexels, with Arabic translation and safety filtering |
| `src/app/api/news` | News pictures from RSS feeds |
| `src/app/api/curated` | Trending wallpapers |
| `src/lib/search/translate.ts` | Arabic → English search translation |
| `src/lib/search/safety.ts` | Content filtering (always on) |
| `src/lib/i18n/dictionary.ts` | Every English and Arabic string in the app |
| `src/components/Hero3D.tsx` | The 3D ring on the landing page |
| `src/components/Viewer3D.tsx` | The 3D picture viewer |

## Phase 2 and 3

Accounts, collections, likes, sized downloads (phase 2), then follow-topics and the live
deploy (phase 3). See the spec.
