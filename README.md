# WEJI ويجي

A bilingual (English / Arabic) image search engine for photos and news pictures — with a
3D landing page and a 3D image viewer.

> Full product spec and decisions: [WEJI-SPEC.md](WEJI-SPEC.md)

---

## Run it

```bash
npm run dev
```

Then open **http://localhost:3000**.

It works immediately with no setup. With no keys configured it runs in **demo mode** with
placeholder photos, and anything you save is kept on your own device. Real news pictures work
straight away, because they come from free RSS feeds rather than an API.

> ⚠️ Don't run `npm run build` while `npm run dev` is running — they share the `.next` folder
> and the running dev server will start serving broken pages. Stop the dev server first, or use
> `npx tsc --noEmit` to check for errors instead.

---

## Setup 1 — real photos (about 10 minutes, free)

1. **Unsplash** — <https://unsplash.com/developers> → *New Application* → copy the **Access Key**
2. **Pexels** — <https://www.pexels.com/api/> → sign up → copy **Your API Key**

Copy `.env.local.example` to `.env.local`, paste the keys in, and restart `npm run dev`.

## Setup 2 — real accounts (about 10 minutes, free)

Until this is done, WEJI still works: saves and likes are kept on the visitor's own device,
and the sign-in page says so honestly instead of showing a form that can't work.

1. Create a free project at <https://supabase.com/dashboard>
2. **Settings → API** → copy the **Project URL** and the **anon public** key into `.env.local`
   as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **SQL Editor → New query** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**
4. **Authentication → URL Configuration** → set *Site URL* to `http://localhost:3000`
   (and later your live address), and add `http://localhost:3000/auth/callback` to
   *Redirect URLs*
5. Restart `npm run dev`

Anything a visitor saved before signing up is moved into their new account automatically the
first time they sign in.

---

## What's here

| Path | What it is |
|---|---|
| `src/app/page.tsx` | 3D landing page |
| `src/app/home/page.tsx` | Home feed — live news pictures + popular photographs |
| `src/app/search/page.tsx` | Search results |
| `src/app/collections/` | Collections and the Liked view |
| `src/app/login`, `src/app/signup` | Email + password accounts |
| `src/app/api/search` | Unsplash + Pexels, with Arabic translation and safety filtering |
| `src/app/api/news` | News pictures from RSS feeds |
| `src/app/api/download` | Sized photo downloads (with a strict host allow-list) |
| `src/lib/search/translate.ts` | Arabic → English search translation |
| `src/lib/search/safety.ts` | Content filtering (always on) |
| `src/lib/i18n/dictionary.ts` | **Every English and Arabic string in the app** — readable and editable |
| `src/lib/library/` | Saving and liking — device store and Supabase store behind one interface |
| `src/components/Hero3D.tsx` | The 3D ring on the landing page |
| `src/components/Viewer3D.tsx` | The 3D picture viewer |
| `supabase/schema.sql` | The whole database, including its security rules |

## Still to come (phase 3)

Follow topics, a personalised home feed, and the live deploy to Vercel.
