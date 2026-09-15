/**
 * Arabic → English search translation.
 *
 * Unsplash and Pexels only index English. Without this, every Arabic search in
 * WEJI returns nothing — so this file is the difference between the app working
 * for Arabic speakers and not.
 *
 * Strategy: a hand-built dictionary of the terms people actually type into an
 * image search answers instantly, offline, free, and with no rate limit. Only
 * the long tail falls through to a translation service.
 */

const ARABIC_RANGE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export function isArabic(text: string): boolean {
  return ARABIC_RANGE.test(text);
}

/**
 * Strip the variations that make the same Arabic word look like five different
 * words to a lookup table: diacritics, tatweel, and the alef/ya/ta-marbuta
 * spellings people mix freely.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ْٰـ]/g, "") // harakat + tatweel
    .replace(/[آأإٱ]/g, "ا") // آ أ إ ٱ → ا
    .replace(/ى/g, "ي") // ى → ي
    .replace(/ة/g, "ه") // ة → ه
    .replace(/ؤ/g, "و") // ؤ → و
    .replace(/ئ/g, "ي") // ئ → ي
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Leading particles that carry no meaning for an image search. */
const STOP_PREFIXES = ["ال"]; // ال
const STOP_WORDS = new Set([
  "في", // في
  "من", // من
  "علي", // على
  "الي", // الى
  "و", // و
  "او", // او
  "مع", // مع
  "عن", // عن
  "صور", // صور  ("pictures of ...")
  "صوره", // صورة
  "خلفيه", // خلفية → implied
]);

/**
 * The working dictionary. Keys are already normalised by `normalizeArabic`.
 * Grouped by theme so it stays easy for a non-developer to extend.
 */
const AR_EN: Record<string, string> = {
  // ── Nature / طبيعة ──────────────────────────────────────────────
  "طبيعه": "nature",
  "منظر طبيعي": "landscape",
  "مناظر طبيعيه": "landscape",
  "غروب": "sunset",
  "غروب الشمس": "sunset",
  "شروق": "sunrise",
  "شروق الشمس": "sunrise",
  "شمس": "sun",
  "قمر": "moon",
  "نجوم": "stars",
  "سماء": "sky",
  "سحاب": "clouds",
  "مطر": "rain",
  "ثلج": "snow",
  "ضباب": "fog",
  "برق": "lightning",
  "قوس قزح": "rainbow",
  "بحر": "sea",
  "محيط": "ocean",
  "شاطئ": "beach",
  "رمل": "sand",
  "موج": "waves",
  "نهر": "river",
  "بحيره": "lake",
  "شلال": "waterfall",
  "جبل": "mountain",
  "جبال": "mountains",
  "صحراء": "desert",
  "كثبان": "sand dunes",
  "واحه": "oasis",
  "غابه": "forest",
  "شجر": "tree",
  "اشجار": "trees",
  "ورد": "flowers",
  "زهور": "flowers",
  "ورده": "rose",
  "نخل": "palm tree",
  "عشب": "grass",
  "اوراق الشجر": "leaves",
  "خريف": "autumn",
  "ربيع": "spring",
  "شتاء": "winter",
  "صيف": "summer",

  // ── Animals / حيوانات ───────────────────────────────────────────
  "حيوانات": "animals",
  "قطه": "cat",
  "قطط": "cats",
  "كلب": "dog",
  "كلاب": "dogs",
  "حصان": "horse",
  "خيل": "horses",
  "جمل": "camel",
  "ابل": "camels",
  "اسد": "lion",
  "نمر": "tiger",
  "فيل": "elephant",
  "طيور": "birds",
  "طائر": "bird",
  "صقر": "falcon",
  "نسر": "eagle",
  "سمك": "fish",
  "فراشه": "butterfly",
  "ذئب": "wolf",

  // ── Places / أماكن ──────────────────────────────────────────────
  "مدينه": "city",
  "مدن": "cities",
  "قريه": "village",
  "شارع": "street",
  "طريق": "road",
  "جسر": "bridge",
  "مبني": "building",
  "عماره": "architecture",
  "ناطحات سحاب": "skyscraper",
  "مسجد": "mosque",
  "مكه": "mecca",
  "المدينه المنوره": "medina",
  "الكعبه": "kaaba",
  "دبي": "dubai",
  "الرياض": "riyadh",
  "القاهره": "cairo",
  "اسطنبول": "istanbul",
  "القدس": "jerusalem",
  "بيروت": "beirut",
  "باريس": "paris",
  "لندن": "london",
  "طوكيو": "tokyo",
  "نيويورك": "new york",
  "سفر": "travel",
  "سياحه": "tourism",
  "حديقه": "garden",
  "مكتبه": "library",
  "مقهي": "cafe",
  "مطعم": "restaurant",
  "منزل": "home interior",
  "غرفه": "room interior",
  "ديكور": "interior design",

  // ── Food / طعام ─────────────────────────────────────────────────
  "طعام": "food",
  "اكل": "food",
  "قهوه": "coffee",
  "شاي": "tea",
  "حلويات": "dessert",
  "فواكه": "fruit",
  "خضار": "vegetables",
  "خبز": "bread",
  "عصير": "juice",
  "تمر": "dates fruit",
  "مطبخ": "kitchen",

  // ── People / أشخاص ──────────────────────────────────────────────
  "اشخاص": "people",
  "رجل": "man",
  "امراه": "woman",
  "طفل": "child",
  "اطفال": "children",
  "عائله": "family",
  "وجه": "portrait",
  "بورتريه": "portrait",
  "صداقه": "friends",
  "عرس": "wedding",
  "موضه": "fashion",
  "ازياء": "fashion",

  // ── Tech / تقنية ────────────────────────────────────────────────
  "تقنيه": "technology",
  "تكنولوجيا": "technology",
  "كمبيوتر": "computer",
  "حاسوب": "computer",
  "لابتوب": "laptop",
  "جوال": "smartphone",
  "هاتف": "phone",
  "برمجه": "programming",
  "ذكاء اصطناعي": "artificial intelligence",
  "روبوت": "robot",
  "فضاء": "space",
  "كوكب": "planet",
  "مجره": "galaxy",
  "صاروخ": "rocket",

  // ── Cars / سيارات ───────────────────────────────────────────────
  "سياره": "car",
  "سيارات": "cars",
  "دراجه": "motorcycle",
  "طائره": "airplane",
  "قطار": "train",
  "سفينه": "ship",
  "قارب": "boat",

  // ── Sport / رياضة ───────────────────────────────────────────────
  "رياضه": "sport",
  "كره قدم": "football",
  "كره سله": "basketball",
  "سباحه": "swimming",
  "جري": "running",
  "جيم": "gym",
  "يوجا": "yoga",

  // ── Art / فن ────────────────────────────────────────────────────
  "فن": "art",
  "رسم": "painting",
  "تصوير": "photography",
  "تجريدي": "abstract",
  "ملون": "colorful",
  "الوان": "colors",
  "ابيض واسود": "black and white",
  "نمط": "pattern",
  "زخرفه": "ornament pattern",
  "خط عربي": "arabic calligraphy",
  "تصميم": "design",
  "معمار": "architecture",

  // ── Business / أعمال ────────────────────────────────────────────
  "اعمال": "business",
  "مكتب": "office",
  "اجتماع": "meeting",
  "مال": "finance",
  "اقتصاد": "economy",
  "دراسه": "study",
  "مدرسه": "school",
  "جامعه": "university",
  "كتاب": "book",
  "كتب": "books",
  "صحه": "health",
  "طب": "medical",
  "مستشفي": "hospital",

  // ── Screen-background searches / خلفيات ─────────────────────────
  // Kept because people really do search this word and deserve results.
  // Translating a query is fine; presenting WEJI as a wallpaper app is what
  // Unsplash's and Pexels' terms prohibit.
  "خلفيات": "wallpaper",
  "خلفيه": "wallpaper",
  "خلفيات جوال": "phone wallpaper",
  "خلفيات كمبيوتر": "desktop wallpaper",
  "اسود": "black",
  "ابيض": "white",
  "ازرق": "blue",
  "احمر": "red",
  "اخضر": "green",
  "ذهبي": "gold",
  "وردي": "pink",
  "بنفسجي": "purple",
  "هادئ": "minimal calm",
  "بسيط": "minimal",
  "بساطه": "minimal",
  "فخم": "luxury",
  "ليل": "night",
  "نور": "light",
  "اضاءه": "lighting",
  "نيون": "neon",
};

export interface TranslationResult {
  /** What we actually send to Unsplash/Pexels. */
  query: string;
  /** Exactly what the user typed. */
  original: string;
  /** True when `query` differs from `original`. */
  translated: boolean;
  /** Which path produced it — useful for debugging a bad result. */
  method: "none" | "dictionary" | "partial" | "service";
}

function stripArticle(word: string): string {
  for (const prefix of STOP_PREFIXES) {
    if (word.startsWith(prefix) && word.length > prefix.length + 1) {
      return word.slice(prefix.length);
    }
  }
  return word;
}

/** Dictionary-only pass. Returns null when it can't do a useful job. */
function translateWithDictionary(normalized: string): { text: string; method: "dictionary" | "partial" } | null {
  const whole = AR_EN[normalized];
  if (whole) return { text: whole, method: "dictionary" };

  const words = normalized.split(" ").filter(Boolean);
  const kept: string[] = [];
  let hits = 0;
  let meaningful = 0;

  for (const raw of words) {
    const word = stripArticle(raw);
    if (STOP_WORDS.has(word) || STOP_WORDS.has(raw)) continue;
    meaningful++;
    const hit = AR_EN[word] ?? AR_EN[raw];
    if (hit) {
      hits++;
      kept.push(hit);
    } else {
      kept.push(raw);
    }
  }

  if (meaningful === 0 || hits === 0) return null;
  // Every meaningful word resolved → as good as a whole-phrase hit.
  if (hits === meaningful) return { text: kept.join(" "), method: "dictionary" };
  // Otherwise it's a mix of English and leftover Arabic; only worth sending
  // when most of it resolved, since stray Arabic tokens return nothing.
  if (hits / meaningful >= 0.5) return { text: kept.filter((w) => !ARABIC_RANGE.test(w)).join(" "), method: "partial" };
  return null;
}

/** Long-tail fallback. Free, keyless, and best-effort — never blocks a search. */
async function translateWithService(text: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ar|en`;
    const res = await fetch(url, { signal, next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { responseData?: { translatedText?: string } };
    const out = data.responseData?.translatedText?.trim();
    if (!out || ARABIC_RANGE.test(out)) return null;
    // The service echoes the input back on failure.
    if (normalizeArabic(out) === normalizeArabic(text)) return null;
    return out;
  } catch {
    return null;
  }
}

/**
 * Turn whatever the user typed into something the image providers understand.
 * Never throws — a failed translation degrades to searching the raw text.
 */
export async function translateQuery(input: string, signal?: AbortSignal): Promise<TranslationResult> {
  const original = input.trim();
  if (!original || !isArabic(original)) {
    return { query: original, original, translated: false, method: "none" };
  }

  const normalized = normalizeArabic(original);

  const fromDict = translateWithDictionary(normalized);
  if (fromDict) {
    return { query: fromDict.text, original, translated: true, method: fromDict.method };
  }

  const fromService = await translateWithService(original, signal);
  if (fromService) {
    return { query: fromService, original, translated: true, method: "service" };
  }

  return { query: original, original, translated: false, method: "none" };
}

/** Arabic labels for the browse categories, so the home page reads natively. */
export const CATEGORIES: { en: string; ar: string; query: string }[] = [
  { en: "Landscapes", ar: "مناظر طبيعية", query: "landscape" },
  // Display spellings must be correct Arabic (ة, not ه). normalizeArabic()
  // handles matching them against the dictionary, so the user never sees the
  // normalised form.
  { en: "Nature", ar: "طبيعة", query: "nature" },
  { en: "Desert", ar: "صحراء", query: "desert" },
  { en: "Architecture", ar: "عمارة", query: "architecture" },
  { en: "Travel", ar: "سفر", query: "travel" },
  { en: "Cars", ar: "سيارات", query: "cars" },
  { en: "Food", ar: "طعام", query: "food" },
  { en: "Animals", ar: "حيوانات", query: "animals" },
  { en: "Space", ar: "فضاء", query: "space" },
  { en: "Technology", ar: "تقنية", query: "technology" },
  { en: "Art", ar: "فن", query: "abstract art" },
  { en: "Minimal", ar: "بساطة", query: "minimal" },
];
