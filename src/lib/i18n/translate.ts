import { dictionaries } from "./dictionaries";
import { DEFAULT_LOCALE, type LangCode } from "./config";

export type Interpolation = Record<string, string | number | undefined | null>;

/**
 * Key lookup with `{placeholder}` interpolation.
 *
 * Missing keys degrade gracefully: the English value, then the key itself, so
 * a forgotten translation never renders as blank UI.
 */
export function translate(locale: LangCode, key: string, vars?: Interpolation): string {
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  let value = dict[key];
  if (value === undefined) value = dictionaries.en[key];
  if (value === undefined) value = key;

  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      if (replacement === undefined || replacement === null) continue;
      value = value.split(`{${name}}`).join(String(replacement));
    }
  }
  return value;
}

export type TranslateFn = (key: string, vars?: Interpolation) => string;

export function makeTranslator(locale: LangCode): TranslateFn {
  return (key, vars) => translate(locale, key, vars);
}

/** Every key of a namespace, useful for building filter chips from dictionaries. */
export function keysWithPrefix(locale: LangCode, prefix: string): string[] {
  const dict = dictionaries[locale] ?? dictionaries.en;
  return Object.keys(dict).filter((k) => k.startsWith(prefix));
}

/**
 * Localises a database-backed enum-ish label.
 * `t("requests.status." + status)` with a fallback to the raw value.
 */
export function enumLabel(locale: LangCode, prefix: string, value: string | null | undefined): string {
  if (!value) return "—";
  const key = `${prefix}${value}`;
  const dict = dictionaries[locale] ?? dictionaries.en;
  return dict[key] ?? dictionaries.en[key] ?? value;
}
