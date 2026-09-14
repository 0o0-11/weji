export type Locale = "en" | "ar";

/**
 * Every user-facing string in WEJI. Keeping them in one file means a
 * non-developer can review the whole Arabic translation in one sitting.
 */
export const STRINGS = {
  en: {
    dir: "ltr",
    brand: "WEJI",
    brandSub: "ويجي",
    tagline: "Find any picture. In any language.",

    heroTitle: "Every picture,",
    heroTitleAccent: "one search away",
    heroBody:
      "Millions of photos, wallpapers and news pictures — searchable in English and Arabic. Free to browse, no account needed.",
    heroCta: "Start exploring",
    heroSecondary: "See what’s trending",
    heroHint: "Drag to spin · click any picture",

    searchPlaceholder: "Search photos, wallpapers, news…",
    searchAction: "Search",
    clear: "Clear",

    navHome: "Home",
    navSearch: "Search",
    navCollections: "Collections",
    signIn: "Sign in",
    signUp: "Create account",
    langLabel: "عربي",

    newsHeading: "In the news right now",
    newsSub: "Pictures from the stories people are reading today",
    trendingHeading: "Trending wallpapers",
    trendingSub: "The most-loved pictures on the internet this week",
    browseHeading: "Browse by topic",

    resultsFor: "Results for",
    searchedFor: "Searched for",
    searchedNote: "We translated your search so the photo libraries could understand it.",
    searchOriginal: "Search the exact words instead",
    noResults: "No pictures found",
    noResultsBody: "Try a different word, or pick a topic below.",
    blocked: "That search isn’t available",
    blockedBody: "WEJI keeps results safe for everyone. Try another search.",
    loadMore: "Load more",
    loading: "Loading…",

    viewerClose: "Close",
    viewerDownload: "Download",
    viewerSave: "Save",
    viewerLike: "Like",
    viewerShare: "Share",
    viewerSource: "View original",
    viewerBy: "by",
    viewerTiltHint: "Move your mouse to tilt",
    viewerOpenArticle: "Read the story",
    copied: "Link copied",

    soonTitle: "Coming in the next step",
    soonBody: "Accounts, collections and downloads arrive in phase 2.",

    demoBadge: "Demo mode",
    demoBody: "Showing placeholder pictures. Add your free Unsplash and Pexels keys to see real photos.",

    footerNote: "Photos by Unsplash and Pexels. News pictures belong to their publishers.",
  },

  ar: {
    dir: "rtl",
    brand: "ويجي",
    brandSub: "WEJI",
    tagline: "ابحث عن أي صورة، بأي لغة.",

    heroTitle: "كل الصور،",
    heroTitleAccent: "على بُعد بحث واحد",
    heroBody:
      "ملايين الصور والخلفيات وصور الأخبار — ابحث بالعربية أو الإنجليزية. التصفح مجاني بلا حساب.",
    heroCta: "ابدأ الاستكشاف",
    heroSecondary: "شاهد الأكثر رواجاً",
    heroHint: "اسحب للتدوير · اضغط على أي صورة",

    searchPlaceholder: "ابحث عن صور، خلفيات، أخبار…",
    searchAction: "بحث",
    clear: "مسح",

    navHome: "الرئيسية",
    navSearch: "بحث",
    navCollections: "مجموعاتي",
    signIn: "تسجيل الدخول",
    signUp: "إنشاء حساب",
    langLabel: "English",

    newsHeading: "الأخبار الآن",
    newsSub: "صور من الأخبار التي يتابعها الناس اليوم",
    trendingHeading: "خلفيات رائجة",
    trendingSub: "أكثر الصور إعجاباً على الإنترنت هذا الأسبوع",
    browseHeading: "تصفح حسب الموضوع",

    resultsFor: "نتائج",
    searchedFor: "بحثنا عن",
    searchedNote: "ترجمنا بحثك لتفهمه مكتبات الصور.",
    searchOriginal: "ابحث بالكلمات كما كتبتها",
    noResults: "لم نجد صوراً",
    noResultsBody: "جرّب كلمة أخرى، أو اختر موضوعاً بالأسفل.",
    blocked: "هذا البحث غير متاح",
    blockedBody: "ويجي يحافظ على نتائج آمنة للجميع. جرّب بحثاً آخر.",
    loadMore: "عرض المزيد",
    loading: "جارٍ التحميل…",

    viewerClose: "إغلاق",
    viewerDownload: "تحميل",
    viewerSave: "حفظ",
    viewerLike: "إعجاب",
    viewerShare: "مشاركة",
    viewerSource: "المصدر الأصلي",
    viewerBy: "بعدسة",
    viewerTiltHint: "حرّك المؤشر لإمالة الصورة",
    viewerOpenArticle: "اقرأ الخبر",
    copied: "تم نسخ الرابط",

    soonTitle: "قريباً في الخطوة التالية",
    soonBody: "الحسابات والمجموعات والتحميل في المرحلة الثانية.",

    demoBadge: "وضع العرض",
    demoBody: "هذه صور تجريبية. أضف مفاتيح Unsplash و Pexels المجانية لعرض الصور الحقيقية.",

    footerNote: "الصور من Unsplash و Pexels. صور الأخبار ملك لناشريها.",
  },
} as const;

export type Strings = (typeof STRINGS)["en"];
