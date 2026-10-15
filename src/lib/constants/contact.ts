import type { LocalizedText } from "./morocco";

/**
 * Public support coordinates, shared by the footer and the contact page so the
 * two can never drift apart.
 */
export const SUPPORT_CONTACT = {
  email: "support@alomaalem.ma",
  phoneDisplay: "+212 5 37 20 41 04",
  phoneDial: "+212537204104",
  address: {
    ar: "شارع الزرقطوني، الدار البيضاء — المغرب",
    fr: "Boulevard Zerktouni, Casablanca — Maroc",
    en: "Boulevard Zerktouni, Casablanca — Morocco",
  } satisfies LocalizedText,
  office: {
    ar: "الدار البيضاء — وجدة، المغرب",
    fr: "Casablanca — Oujda, Maroc",
    en: "Casablanca — Oujda, Morocco",
  } satisfies LocalizedText,
} as const;
