export type Locale = "en" | "ar";

/**
 * Every user-facing string in WEJI, in both languages, in one file.
 *
 * The Arabic is written as real Arabic text rather than escape codes so that a
 * native speaker can read this file top to bottom and correct it without
 * needing a developer.
 */
export const STRINGS = {
  en: {
    dir: "ltr",
    brand: "WEJI",
    brandSub: "ويجي",
    tagline: "Find any picture. In any language.",

    // ── Landing ──────────────────────────────────────────────────────────
    heroTitle: "Every picture,",
    heroTitleAccent: "one search away",
    heroBody:
      "Millions of photos, wallpapers and news pictures — searchable in English and Arabic. Free to browse, no account needed.",
    heroCta: "Start exploring",
    heroSecondary: "See what’s trending",
    heroHint: "Drag to spin · click any picture",

    // ── Search ───────────────────────────────────────────────────────────
    searchPlaceholder: "Search photos, wallpapers, news…",
    searchAction: "Search",
    clear: "Clear",
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

    // ── Navigation ───────────────────────────────────────────────────────
    navHome: "Home",
    navSearch: "Search",
    navCollections: "Collections",
    signIn: "Sign in",
    signUp: "Create account",
    signOut: "Sign out",
    langLabel: "عربي",

    // ── Home ─────────────────────────────────────────────────────────────
    newsHeading: "In the news right now",
    newsSub: "Pictures from the stories people are reading today",
    trendingHeading: "Trending wallpapers",
    trendingSub: "The most-loved pictures on the internet this week",
    browseHeading: "Browse by topic",

    // ── Viewer ───────────────────────────────────────────────────────────
    viewerClose: "Close",
    viewerDownload: "Download",
    viewerSave: "Save",
    viewerSaved: "Saved",
    viewerLike: "Like",
    viewerLiked: "Liked",
    viewerShare: "Share",
    viewerSource: "View original",
    viewerBy: "by",
    viewerTiltHint: "Move your mouse to tilt",
    viewerOpenArticle: "Read the story",
    copied: "Link copied",

    // ── Download ─────────────────────────────────────────────────────────
    downloadPhone: "Phone",
    downloadDesktop: "Desktop",
    downloadOriginal: "Original",
    downloadNotAllowed: "News pictures belong to their publisher — open the story to see the original.",

    // ── Account ──────────────────────────────────────────────────────────
    email: "Email",
    password: "Password",
    passwordHint: "At least 6 characters",
    createAccountCta: "Create account",
    signInCta: "Sign in",
    haveAccount: "Already have an account?",
    noAccount: "New to WEJI?",
    checkInbox: "Check your inbox",
    checkInboxBody: "We sent you a confirmation link. Open it to finish creating your account.",
    signUpTitle: "Create your WEJI account",
    signUpBody: "To save pictures into collections and reach them from any device.",
    signInTitle: "Welcome back",
    signInBody: "Sign in to reach your collections.",
    authUnavailable: "Accounts aren’t switched on yet",
    authUnavailableBody:
      "WEJI works fully without one — anything you save is kept on this device until accounts are connected.",
    backToBrowsing: "Back to browsing",
    working: "Working…",

    // ── Collections ──────────────────────────────────────────────────────
    myCollections: "Collections",
    likedPictures: "Liked",
    /** Shown instead of the stored name for the auto-created first collection. */
    defaultCollectionName: "My picks",
    newCollection: "New collection",
    collectionName: "Collection name",
    create: "Create",
    cancel: "Cancel",
    saveToCollection: "Save to…",
    savedToast: "Saved",
    removeFromCollection: "Remove",
    emptyCollection: "Nothing saved here yet",
    emptyCollectionBody: "Open any picture and press Save.",
    emptyLikes: "No liked pictures yet",
    emptyLikesBody: "Tap the heart on any picture you like.",
    deleteCollection: "Delete",
    deleteConfirm: "Delete this collection and everything in it?",
    pictures: "pictures",
    savedOnDevice: "Saved on this device",
    savedOnDeviceBody: "Create an account to keep these and reach them from any device.",

    // ── Demo mode ────────────────────────────────────────────────────────
    demoBadge: "Demo mode",
    demoBody: "Showing placeholder pictures. Add your free Unsplash and Pexels keys to see real photos.",

    footerNote: "Photos by Unsplash and Pexels. News pictures belong to their publishers.",
  },

  ar: {
    dir: "rtl",
    brand: "ويجي",
    brandSub: "WEJI",
    tagline: "ابحث عن أي صورة، بأي لغة.",

    // ── الصفحة الرئيسية ──────────────────────────────────────────────────
    heroTitle: "كل الصور،",
    heroTitleAccent: "على بُعد بحث واحد",
    heroBody:
      "ملايين الصور والخلفيات وصور الأخبار — ابحث بالعربية أو الإنجليزية. التصفح مجاني بلا حساب.",
    heroCta: "ابدأ الاستكشاف",
    heroSecondary: "شاهد الأكثر رواجاً",
    heroHint: "اسحب للتدوير · اضغط على أي صورة",

    // ── البحث ────────────────────────────────────────────────────────────
    searchPlaceholder: "ابحث عن صور، خلفيات، أخبار…",
    searchAction: "بحث",
    clear: "مسح",
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

    // ── التنقل ───────────────────────────────────────────────────────────
    navHome: "الرئيسية",
    navSearch: "بحث",
    navCollections: "مجموعاتي",
    signIn: "تسجيل الدخول",
    signUp: "إنشاء حساب",
    signOut: "تسجيل الخروج",
    langLabel: "English",

    // ── الصفحة الرئيسية ──────────────────────────────────────────────────
    newsHeading: "الأخبار الآن",
    newsSub: "صور من الأخبار التي يتابعها الناس اليوم",
    trendingHeading: "خلفيات رائجة",
    trendingSub: "أكثر الصور إعجاباً على الإنترنت هذا الأسبوع",
    browseHeading: "تصفح حسب الموضوع",

    // ── عارض الصور ───────────────────────────────────────────────────────
    viewerClose: "إغلاق",
    viewerDownload: "تحميل",
    viewerSave: "حفظ",
    viewerSaved: "محفوظة",
    viewerLike: "إعجاب",
    viewerLiked: "أعجبتني",
    viewerShare: "مشاركة",
    viewerSource: "المصدر الأصلي",
    viewerBy: "بعدسة",
    viewerTiltHint: "حرّك المؤشر لإمالة الصورة",
    viewerOpenArticle: "اقرأ الخبر",
    copied: "تم نسخ الرابط",

    // ── التحميل ──────────────────────────────────────────────────────────
    downloadPhone: "جوال",
    downloadDesktop: "كمبيوتر",
    downloadOriginal: "الحجم الأصلي",
    downloadNotAllowed: "صور الأخبار ملك لناشريها — افتح الخبر لمشاهدة الأصل.",

    // ── الحساب ───────────────────────────────────────────────────────────
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    passwordHint: "٦ أحرف على الأقل",
    createAccountCta: "إنشاء الحساب",
    signInCta: "دخول",
    haveAccount: "لديك حساب بالفعل؟",
    noAccount: "جديد في ويجي؟",
    checkInbox: "تحقق من بريدك",
    checkInboxBody: "أرسلنا لك رابط تأكيد. افتحه لإكمال إنشاء حسابك.",
    signUpTitle: "أنشئ حسابك في ويجي",
    signUpBody: "لحفظ الصور في مجموعات والوصول إليها من أي جهاز.",
    signInTitle: "أهلاً بعودتك",
    signInBody: "سجّل الدخول للوصول إلى مجموعاتك.",
    authUnavailable: "الحسابات غير مفعّلة بعد",
    authUnavailableBody:
      "ويجي يعمل بالكامل بدونها — كل ما تحفظه محفوظ على هذا الجهاز حتى يتم تفعيل الحسابات.",
    backToBrowsing: "العودة للتصفح",
    working: "جارٍ التنفيذ…",

    // ── المجموعات ────────────────────────────────────────────────────────
    myCollections: "المجموعات",
    likedPictures: "أعجبتني",
    defaultCollectionName: "مختاراتي",
    newCollection: "مجموعة جديدة",
    collectionName: "اسم المجموعة",
    create: "إنشاء",
    cancel: "إلغاء",
    saveToCollection: "حفظ في…",
    savedToast: "تم الحفظ",
    removeFromCollection: "إزالة",
    emptyCollection: "لا توجد صور محفوظة هنا بعد",
    emptyCollectionBody: "افتح أي صورة واضغط حفظ.",
    emptyLikes: "لا توجد صور أعجبتك بعد",
    emptyLikesBody: "اضغط على القلب في أي صورة تعجبك.",
    deleteCollection: "حذف",
    deleteConfirm: "حذف هذه المجموعة وكل ما بداخلها؟",
    pictures: "صورة",
    savedOnDevice: "محفوظة على هذا الجهاز",
    savedOnDeviceBody: "أنشئ حساباً للاحتفاظ بها والوصول إليها من أي جهاز.",

    // ── وضع العرض ────────────────────────────────────────────────────────
    demoBadge: "وضع العرض",
    demoBody: "هذه صور تجريبية. أضف مفاتيح Unsplash و Pexels المجانية لعرض الصور الحقيقية.",

    footerNote: "الصور من Unsplash و Pexels. صور الأخبار ملك لناشريها.",
  },
} as const;

export type Strings = (typeof STRINGS)["en"];
