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
      "Millions of photos and news pictures — searchable in English and Arabic. Free to browse, no account needed.",
    heroCta: "Start exploring",
    heroSecondary: "See what’s popular",
    heroHint: "Drag to spin · click any picture",

    // ── Search ───────────────────────────────────────────────────────────
    searchPlaceholder: "Search photos, news, anything…",
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

    // ── Account ──────────────────────────────────────────────────────────
    navAccount: "Account",
    accountTitle: "Your account",
    signedInAs: "Signed in as",
    memberSince: "Member since",
    statCollections: "Collections",
    statSaved: "Pictures saved",
    statLiked: "Liked",
    statTopics: "Topics followed",
    accountLanguage: "Interface language",
    accountNotSignedIn: "You’re not signed in",
    accountNotSignedInBody:
      "WEJI works without an account — anything you save is kept on this device. Sign in to reach it from anywhere.",
    accountGuestNote:
      "These are saved on this device only. Create an account and they move with you automatically.",

    // ── Home ─────────────────────────────────────────────────────────────
    newsHeading: "In the news right now",
    newsSub: "Pictures from the stories people are reading today",
    trendingHeading: "Popular photographs",
    trendingSub: "The most-loved pictures on the internet this week",
    browseHeading: "Browse by topic",
    forYouHeading: "For you",
    forYouSub: "From the topics you follow",
    followTopic: "Follow",
    followingTopic: "Following",
    followHint: "Follow a topic and it appears at the top of your home page.",

    // ── Viewer ───────────────────────────────────────────────────────────
    viewerClose: "Close",
    viewerDownload: "Download",
    viewerSave: "Save",
    viewerSaved: "Saved",
    viewerLike: "Like",
    viewerLiked: "Liked",
    viewerShare: "Share",
    viewerSource: "View original",
    viewerBy: "Photo by",
    viewerOn: "on",
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

    footerPhotosBy: "Photos provided by",
    footerAnd: "and",
    footerNewsNote: "News pictures belong to their publishers.",

    // ── Room demos (design preview) ──────────────────────────────────────
    previewBadge: "Design preview",
    roomsHint: "Scroll to fly through the tunnel · Tap a picture to open it",
    roomsColours: "Colours",
    paletteGold: "Night gold",
    paletteOcean: "Deep ocean",
    paletteViolet: "Royal violet",
    paletteDusk: "Desert dusk",
    roomsBusy: "Searching…",
    roomsBackToLive: "Current WEJI",
    roomsPictures: "pictures",
    roomsNothing: "Nothing found for that. Try another word.",
    roomsBlocked: "That search isn’t available. Try another one.",
    roomsSeries: "From",
    roomsCopied: "Link copied",
    roomsNoDownload: "Visit the original",
    roomsPicturesFrom: "Pictures from",
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
      "ملايين الصور وصور الأخبار — ابحث بالعربية أو الإنجليزية. التصفح مجاني بلا حساب.",
    heroCta: "ابدأ الاستكشاف",
    heroSecondary: "شاهد الأكثر رواجاً",
    heroHint: "اسحب للتدوير · اضغط على أي صورة",

    // ── البحث ────────────────────────────────────────────────────────────
    searchPlaceholder: "ابحث عن صور، أخبار، أي شيء…",
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

    // ── الحساب ───────────────────────────────────────────────────────────
    navAccount: "حسابي",
    accountTitle: "حسابك",
    signedInAs: "مسجّل الدخول باسم",
    memberSince: "عضو منذ",
    statCollections: "المجموعات",
    statSaved: "صور محفوظة",
    statLiked: "أعجبتني",
    statTopics: "مواضيع متابَعة",
    accountLanguage: "لغة الواجهة",
    accountNotSignedIn: "لم تسجّل الدخول",
    accountNotSignedInBody:
      "ويجي يعمل بدون حساب — كل ما تحفظه محفوظ على هذا الجهاز. سجّل الدخول للوصول إليه من أي مكان.",
    accountGuestNote:
      "هذه محفوظة على هذا الجهاز فقط. أنشئ حساباً وستنتقل معك تلقائياً.",

    // ── الصفحة الرئيسية ──────────────────────────────────────────────────
    newsHeading: "الأخبار الآن",
    newsSub: "صور من الأخبار التي يتابعها الناس اليوم",
    trendingHeading: "صور رائجة",
    trendingSub: "أكثر الصور إعجاباً على الإنترنت هذا الأسبوع",
    browseHeading: "تصفح حسب الموضوع",
    forYouHeading: "لك",
    forYouSub: "من المواضيع التي تتابعها",
    followTopic: "متابعة",
    followingTopic: "تتابعه",
    followHint: "تابع موضوعاً ليظهر في أعلى صفحتك الرئيسية.",

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
    viewerOn: "على",
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

    footerPhotosBy: "الصور مقدمة من",
    footerAnd: "و",
    footerNewsNote: "صور الأخبار ملك لناشريها.",

    // ── التفتّح (معاينة التصميم) ─────────────────────────────────────────
    previewBadge: "معاينة التصميم",
    roomsHint: "مرّر لتطير عبر النفق · اضغط على صورة لفتحها",
    roomsColours: "الألوان",
    paletteGold: "ذهبي ليلي",
    paletteOcean: "محيط عميق",
    paletteViolet: "بنفسجي ملكي",
    paletteDusk: "غروب الصحراء",
    roomsBusy: "نبحث…",
    roomsBackToLive: "ويجي الحالي",
    roomsPictures: "صورة",
    roomsNothing: "لم نجد شيئًا. جرّب كلمة أخرى.",
    roomsBlocked: "هذا البحث غير متاح. جرّب بحثًا آخر.",
    roomsSeries: "من",
    roomsCopied: "تم نسخ الرابط",
    roomsNoDownload: "زيارة المصدر الأصلي",
    roomsPicturesFrom: "الصور من",
  },
} as const;

export type Strings = (typeof STRINGS)["en"];
