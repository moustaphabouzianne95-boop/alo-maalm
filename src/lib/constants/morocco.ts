/**
 * Moroccan market reference data.
 *
 * These are *domain constants*, not i18n strings: city slugs are part of the
 * public URL contract (`/services?city=oujda`) and are never translated.
 * Display names are stored trilingually so the UI can render them in the
 * active locale without a translation lookup.
 */

export type LangCode = "ar" | "fr" | "en";

export interface LocalizedText {
  ar: string;
  fr: string;
  en: string;
}

export interface MoroccanCity {
  slug: string;
  name: LocalizedText;
  region: LocalizedText;
  /** ISO 3166-2 style region code, stable for analytics grouping. */
  regionCode: string;
  populationRank: number;
  latitude: number;
  longitude: number;
}

export const CURRENCY_CODE = "MAD" as const;
export const CURRENCY_SYMBOL_AR = "د.م." as const;
export const DEFAULT_LOCALE: LangCode = "ar";
export const SUPPORTED_LOCALES: readonly LangCode[] = ["ar", "fr", "en"] as const;
export const RTL_LOCALES: readonly LangCode[] = ["ar"] as const;

/** BCP-47 tags used by Intl formatters. */
export const LOCALE_TAG: Record<LangCode, string> = {
  ar: "ar-MA",
  fr: "fr-MA",
  en: "en-GB",
};

export const CITIES: MoroccanCity[] = [
  {
    slug: "casablanca",
    name: { ar: "الدار البيضاء", fr: "Casablanca", en: "Casablanca" },
    region: { ar: "الدار البيضاء-سطات", fr: "Casablanca-Settat", en: "Casablanca-Settat" },
    regionCode: "MA-06",
    populationRank: 1,
    latitude: 33.5731,
    longitude: -7.5898,
  },
  {
    slug: "rabat",
    name: { ar: "الرباط", fr: "Rabat", en: "Rabat" },
    region: { ar: "الرباط-سلا-القنيطرة", fr: "Rabat-Salé-Kénitra", en: "Rabat-Salé-Kénitra" },
    regionCode: "MA-04",
    populationRank: 2,
    latitude: 34.0209,
    longitude: -6.8416,
  },
  {
    slug: "marrakech",
    name: { ar: "مراكش", fr: "Marrakech", en: "Marrakesh" },
    region: { ar: "مراكش-آسفي", fr: "Marrakech-Safi", en: "Marrakech-Safi" },
    regionCode: "MA-07",
    populationRank: 3,
    latitude: 31.6295,
    longitude: -7.9811,
  },
  {
    slug: "tangier",
    name: { ar: "طنجة", fr: "Tanger", en: "Tangier" },
    region: { ar: "طنجة-تطوان-الحسيمة", fr: "Tanger-Tétouan-Al Hoceïma", en: "Tangier-Tetouan-Al Hoceima" },
    regionCode: "MA-01",
    populationRank: 4,
    latitude: 35.7595,
    longitude: -5.834,
  },
  {
    slug: "fes",
    name: { ar: "فاس", fr: "Fès", en: "Fez" },
    region: { ar: "فاس-مكناس", fr: "Fès-Meknès", en: "Fez-Meknes" },
    regionCode: "MA-03",
    populationRank: 5,
    latitude: 34.0181,
    longitude: -5.0078,
  },
  {
    slug: "agadir",
    name: { ar: "أكادير", fr: "Agadir", en: "Agadir" },
    region: { ar: "سوس-ماسة", fr: "Souss-Massa", en: "Souss-Massa" },
    regionCode: "MA-09",
    populationRank: 6,
    latitude: 30.4278,
    longitude: -9.5981,
  },
  {
    slug: "meknes",
    name: { ar: "مكناس", fr: "Meknès", en: "Meknes" },
    region: { ar: "فاس-مكناس", fr: "Fès-Meknès", en: "Fez-Meknes" },
    regionCode: "MA-03",
    populationRank: 7,
    latitude: 33.8935,
    longitude: -5.5473,
  },
  {
    slug: "oujda",
    name: { ar: "وجدة", fr: "Oujda", en: "Oujda" },
    region: { ar: "الشرق", fr: "Oriental", en: "Oriental" },
    regionCode: "MA-02",
    populationRank: 8,
    latitude: 34.6814,
    longitude: -1.9086,
  },
  {
    slug: "kenitra",
    name: { ar: "القنيطرة", fr: "Kénitra", en: "Kenitra" },
    region: { ar: "الرباط-سلا-القنيطرة", fr: "Rabat-Salé-Kénitra", en: "Rabat-Salé-Kénitra" },
    regionCode: "MA-04",
    populationRank: 9,
    latitude: 34.261,
    longitude: -6.5802,
  },
  {
    slug: "tetouan",
    name: { ar: "تطوان", fr: "Tétouan", en: "Tetouan" },
    region: { ar: "طنجة-تطوان-الحسيمة", fr: "Tanger-Tétouan-Al Hoceïma", en: "Tangier-Tetouan-Al Hoceima" },
    regionCode: "MA-01",
    populationRank: 10,
    latitude: 35.5785,
    longitude: -5.3684,
  },
  {
    slug: "safi",
    name: { ar: "آسفي", fr: "Safi", en: "Safi" },
    region: { ar: "مراكش-آسفي", fr: "Marrakech-Safi", en: "Marrakech-Safi" },
    regionCode: "MA-07",
    populationRank: 11,
    latitude: 32.2994,
    longitude: -9.2372,
  },
  {
    slug: "el-jadida",
    name: { ar: "الجديدة", fr: "El Jadida", en: "El Jadida" },
    region: { ar: "الدار البيضاء-سطات", fr: "Casablanca-Settat", en: "Casablanca-Settat" },
    regionCode: "MA-06",
    populationRank: 12,
    latitude: 33.2316,
    longitude: -8.5007,
  },
  {
    slug: "nador",
    name: { ar: "الناظور", fr: "Nador", en: "Nador" },
    region: { ar: "الشرق", fr: "Oriental", en: "Oriental" },
    regionCode: "MA-02",
    populationRank: 13,
    latitude: 35.1685,
    longitude: -2.9281,
  },
  {
    slug: "beni-mellal",
    name: { ar: "بني ملال", fr: "Béni Mellal", en: "Beni Mellal" },
    region: { ar: "بني ملال-خنيفرة", fr: "Béni Mellal-Khénifra", en: "Beni Mellal-Khenifra" },
    regionCode: "MA-05",
    populationRank: 14,
    latitude: 32.3373,
    longitude: -6.3498,
  },
  {
    slug: "khouribga",
    name: { ar: "خريبكة", fr: "Khouribga", en: "Khouribga" },
    region: { ar: "بني ملال-خنيفرة", fr: "Béni Mellal-Khénifra", en: "Beni Mellal-Khenifra" },
    regionCode: "MA-05",
    populationRank: 15,
    latitude: 32.8811,
    longitude: -6.9063,
  },
  {
    slug: "settat",
    name: { ar: "سطات", fr: "Settat", en: "Settat" },
    region: { ar: "الدار البيضاء-سطات", fr: "Casablanca-Settat", en: "Casablanca-Settat" },
    regionCode: "MA-06",
    populationRank: 16,
    latitude: 33.001,
    longitude: -7.6164,
  },
];

export const CITY_SLUGS = CITIES.map((c) => c.slug);

/** Real neighbourhoods per city — used for request/professional addressing. */
export const NEIGHBORHOODS: Record<string, LocalizedText[]> = {
  casablanca: [
    { ar: "المعاريف", fr: "Maârif", en: "Maarif" },
    { ar: "أنفا", fr: "Anfa", en: "Anfa" },
    { ar: "عين الذئاب", fr: "Aïn Diab", en: "Ain Diab" },
    { ar: "سيدي معروف", fr: "Sidi Maârouf", en: "Sidi Maarouf" },
    { ar: "الحي الحسني", fr: "Hay Hassani", en: "Hay Hassani" },
    { ar: "بنمسيك", fr: "Ben M'Sick", en: "Ben M'Sick" },
    { ar: "سيدي البرنوصي", fr: "Sidi Bernoussi", en: "Sidi Bernoussi" },
    { ar: "الحي المحمدي", fr: "Hay Mohammadi", en: "Hay Mohammadi" },
    { ar: "عين السبع", fr: "Aïn Sebaâ", en: "Ain Sebaa" },
    { ar: "درب السلطان", fr: "Derb Sultan", en: "Derb Sultan" },
    { ar: "مرس السلطان", fr: "Mers Sultan", en: "Mers Sultan" },
    { ar: "كاليفورنيا", fr: "California", en: "California" },
  ],
  rabat: [
    { ar: "أكدال", fr: "Agdal", en: "Agdal" },
    { ar: "حسان", fr: "Hassan", en: "Hassan" },
    { ar: "السويسي", fr: "Souissi", en: "Souissi" },
    { ar: "يعقوب المنصور", fr: "Yacoub El Mansour", en: "Yacoub El Mansour" },
    { ar: "التقدم", fr: "Progrès", en: "Progres" },
    { ar: "النهضة", fr: "Nahda", en: "Nahda" },
    { ar: "العرفان", fr: "Hay Riad", en: "Hay Riad" },
    { ar: "المدينة العتيقة", fr: "Médina", en: "Medina" },
  ],
  marrakech: [
    { ar: "جيليز", fr: "Guéliz", en: "Gueliz" },
    { ar: "المدينة القديمة", fr: "Médina", en: "Medina" },
    { ar: "حي الرياض", fr: "Hivernage", en: "Hivernage" },
    { ar: "المحاميد", fr: "Mhamid", en: "Mhamid" },
    { ar: "سيدي يوسف بن علي", fr: "Sidi Youssef Ben Ali", en: "Sidi Youssef Ben Ali" },
    { ar: "النخيل", fr: "Palmeraie", en: "Palmeraie" },
    { ar: "تاركة", fr: "Targa", en: "Targa" },
    { ar: "مساء", fr: "Massira", en: "Massira" },
  ],
  tangier: [
    { ar: "وسط المدينة", fr: "Centre Ville", en: "City Centre" },
    { ar: "الملابية", fr: "Malabata", en: "Malabata" },
    { ar: "بوخالف", fr: "Boukhalef", en: "Boukhalef" },
    { ar: "الدرادب", fr: "Dradeb", en: "Dradeb" },
    { ar: "مرشان", fr: "Marchane", en: "Marchane" },
    { ar: "الزياتن", fr: "Ziaten", en: "Ziaten" },
    { ar: "بني مكادة", fr: "Bni Makada", en: "Bni Makada" },
  ],
  fes: [
    { ar: "فاس الجديد", fr: "Fès Jdid", en: "Fez Jdid" },
    { ar: "المدينة العتيقة", fr: "Médina", en: "Medina" },
    { ar: "سايس", fr: "Saïss", en: "Saiss" },
    { ar: "ظهر المهراز", fr: "Dhar Mehraz", en: "Dhar Mehraz" },
    { ar: "النرجس", fr: "Nargues", en: "Nargues" },
    { ar: "زين العابدين", fr: "Zineb", en: "Zineb" },
  ],
  agadir: [
    { ar: "وسط المدينة", fr: "Centre Ville", en: "City Centre" },
    { ar: "الحي المحمدي", fr: "Hay Mohammadi", en: "Hay Mohammadi" },
    { ar: "تالبورجت", fr: "Talborjt", en: "Talborjt" },
    { ar: "الهدى", fr: "Houda", en: "Houda" },
    { ar: "السلام", fr: "Salam", en: "Salam" },
    { ar: "أنزا", fr: "Anza", en: "Anza" },
  ],
  meknes: [
    { ar: "حمرية", fr: "Hamria", en: "Hamria" },
    { ar: "المدينة العتيقة", fr: "Médina", en: "Medina" },
    { ar: "المنزه", fr: "Mounia", en: "Mounia" },
    { ar: "سيدي بوزكري", fr: "Sidi Bouzekri", en: "Sidi Bouzekri" },
    { ar: "الزيتون", fr: "Zitouna", en: "Zitouna" },
  ],
  oujda: [
    { ar: "وسط المدينة", fr: "Centre Ville", en: "City Centre" },
    { ar: "حي السلام", fr: "Hay Salam", en: "Hay Salam" },
    { ar: "حي النهضة", fr: "Hay Nahda", en: "Hay Nahda" },
    { ar: "لاسيل", fr: "Lazaret", en: "Lazaret" },
    { ar: "حي القدس", fr: "Hay Qods", en: "Hay Qods" },
    { ar: "ميرادور", fr: "Mirador", en: "Mirador" },
    { ar: "حي المسيرة", fr: "Hay Massira", en: "Hay Massira" },
    { ar: "بوقنادل", fr: "Bouknadel", en: "Bouknadel" },
  ],
  kenitra: [
    { ar: "وسط المدينة", fr: "Centre Ville", en: "City Centre" },
    { ar: "المدينة العليا", fr: "Hay Al Aouda", en: "Hay Al Aouda" },
    { ar: "السعادة", fr: "Saada", en: "Saada" },
    { ar: "النهضة", fr: "Nahda", en: "Nahda" },
    { ar: "أولاد وجيه", fr: "Ouled Oujih", en: "Ouled Oujih" },
  ],
  tetouan: [
    { ar: "المدينة العتيقة", fr: "Médina", en: "Medina" },
    { ar: "وسط المدينة", fr: "Centre Ville", en: "City Centre" },
    { ar: "الولاية", fr: "Wilaya", en: "Wilaya" },
    { ar: "الطبالة", fr: "Taboula", en: "Taboula" },
    { ar: "سانية الرمل", fr: "Sania R'mel", en: "Sania R'mel" },
  ],
  safi: [
    { ar: "وسط المدينة", fr: "Centre Ville", en: "City Centre" },
    { ar: "المدينة القديمة", fr: "Médina", en: "Medina" },
    { ar: "سيدي بوزيد", fr: "Sidi Bouzid", en: "Sidi Bouzid" },
    { ar: "الحي الصناعي", fr: "Zone Industrielle", en: "Industrial Zone" },
  ],
  "el-jadida": [
    { ar: "وسط المدينة", fr: "Centre Ville", en: "City Centre" },
    { ar: "المدينة البرتغالية", fr: "Cité Portugaise", en: "Portuguese City" },
    { ar: "حي السلام", fr: "Hay Salam", en: "Hay Salam" },
    { ar: "الغزوة", fr: "Ghzoua", en: "Ghzoua" },
  ],
  nador: [
    { ar: "وسط المدينة", fr: "Centre Ville", en: "City Centre" },
    { ar: "حي المطار", fr: "Hay Aéroport", en: "Airport District" },
    { ar: "بوعرورة", fr: "Bouarour", en: "Bouarour" },
    { ar: "الناظور الجديد", fr: "Nador Ville", en: "Nador Ville" },
  ],
  "beni-mellal": [
    { ar: "وسط المدينة", fr: "Centre Ville", en: "City Centre" },
    { ar: "حي الأمل", fr: "Hay Amal", en: "Hay Amal" },
    { ar: "الرياض", fr: "Riad", en: "Riad" },
    { ar: "بني ملال الجديدة", fr: "Nouvelle Ville", en: "Nouvelle Ville" },
  ],
  khouribga: [
    { ar: "وسط المدينة", fr: "Centre Ville", en: "City Centre" },
    { ar: "حي النهضة", fr: "Hay Nahda", en: "Hay Nahda" },
    { ar: "المسيرة", fr: "Massira", en: "Massira" },
  ],
  settat: [
    { ar: "وسط المدينة", fr: "Centre Ville", en: "City Centre" },
    { ar: "حي السلام", fr: "Hay Salam", en: "Hay Salam" },
    { ar: "المدينة الجديدة", fr: "Nouvelle Ville", en: "Nouvelle Ville" },
  ],
};

export const CITY_MAP: Record<string, MoroccanCity> = Object.fromEntries(
  CITIES.map((c) => [c.slug, c])
);

export function getCity(slug?: string | null): MoroccanCity | undefined {
  if (!slug) return undefined;
  return CITY_MAP[slug.toLowerCase()];
}

export function cityName(slug?: string | null, locale: LangCode = DEFAULT_LOCALE): string {
  const city = getCity(slug);
  if (!city) return slug ?? "—";
  return city.name[locale] ?? city.name.ar;
}

export function isKnownCity(value: string): boolean {
  return Boolean(getCity(value));
}

export function neighborhoodsFor(citySlug?: string | null): LocalizedText[] {
  if (!citySlug) return [];
  return NEIGHBORHOODS[citySlug.toLowerCase()] ?? [];
}

/**
 * We deliberately accept the *display* name in any language as well as the
 * slug, because seeded/demo data stores display names in `city` columns.
 */
export function resolveCityInput(input?: string | null): string | null {
  if (!input) return null;
  const v = input.trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  const bySlug = CITY_MAP[lower];
  if (bySlug) return bySlug.slug;
  const byName = CITIES.find((c) =>
    [c.name.ar, c.name.fr, c.name.en].some((n) => n.toLowerCase() === lower)
  );
  return byName ? byName.slug : v;
}

// ─── Money ───────────────────────────────────────────────────────────────────

export interface FormatMoneyOptions {
  locale?: LangCode;
  /** Render "250 MAD" exactly as the brand guide requires. */
  compact?: boolean;
  withSymbol?: boolean;
}

/**
 * Formats an amount in Moroccan dirhams.
 *
 * Brand rule (§4): prices read `250 MAD`. Arabic keeps the same shape so the
 * RTL layout does not break around the currency mark.
 */
export function formatMoney(amount: number | null | undefined, opts: FormatMoneyOptions = {}): string {
  const { locale = DEFAULT_LOCALE } = opts;
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const digits = new Intl.NumberFormat(LOCALE_TAG[locale], {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(value);
  if (locale === "ar") return `${digits} ${CURRENCY_SYMBOL_AR}`;
  return `${digits} MAD`;
}

/** Range helper: `150 – 500 د.م.` or a single price when max is absent. */
export function formatMoneyRange(
  min: number | null | undefined,
  max: number | null | undefined,
  opts: FormatMoneyOptions = {}
): string {
  const { locale = DEFAULT_LOCALE } = opts;
  const lo = Number(min ?? 0);
  if (max == null || Number(max) <= lo) return formatMoney(lo, opts);
  const sep = locale === "ar" ? "–" : "–";
  const hi = Number(max);
  const digits = new Intl.NumberFormat(LOCALE_TAG[locale], { maximumFractionDigits: 0 });
  if (locale === "ar") return `${digits.format(lo)} ${sep} ${digits.format(hi)} ${CURRENCY_SYMBOL_AR}`;
  return `${digits.format(lo)} ${sep} ${digits.format(hi)} MAD`;
}

/**
 * Typical Moroccan price bands (MAD) per category — used to pre-fill budget
 * sliders and to sanity-check seeded demo data. `min`/`max` are the p10/p90.
 */
export const PRICE_BANDS: Record<string, { min: number; max: number; typical: number }> = {
  "electricite": { min: 100, max: 800, typical: 250 },
  "plomberie": { min: 150, max: 500, typical: 250 },
  "peinture": { min: 800, max: 3000, typical: 1500 },
  "menuiserie": { min: 300, max: 4000, typical: 1200 },
  "climatisation": { min: 200, max: 600, typical: 350 },
  "nettoyage": { min: 150, max: 900, typical: 300 },
  "couture": { min: 100, max: 1500, typical: 400 },
  "coiffure": { min: 80, max: 700, typical: 200 },
  "photographie": { min: 500, max: 2500, typical: 1200 },
  "mecanique": { min: 200, max: 3000, typical: 800 },
  "reparations": { min: 100, max: 900, typical: 300 },
  "demenagement": { min: 400, max: 3500, typical: 1200 },
  "informatique": { min: 100, max: 800, typical: 300 },
  "design": { min: 500, max: 6000, typical: 2000 },
  "marketing": { min: 800, max: 8000, typical: 3000 },
  "cours": { min: 80, max: 400, typical: 150 },
  "jardinage": { min: 200, max: 1500, typical: 500 },
  "construction": { min: 1500, max: 25000, typical: 8000 },
  "decoration": { min: 500, max: 7000, typical: 2500 },
  "electromenager": { min: 150, max: 900, typical: 350 },
};

// ─── Time ────────────────────────────────────────────────────────────────────

export const TIME_SLOTS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
] as const;

export const TIME_WINDOWS = [
  "08:00-12:00",
  "12:00-15:00",
  "15:00-18:00",
  "18:00-21:00",
  "flexible",
] as const;

/** Moroccan working week: Monday–Saturday, Friday afternoon often reduced. */
export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
