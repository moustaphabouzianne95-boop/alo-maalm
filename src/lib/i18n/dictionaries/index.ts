import { ar } from "./ar";
import { fr } from "./fr";
import { en, type Messages } from "./en";
import type { LangCode } from "../config";

export const dictionaries: Record<LangCode, Messages> = { ar, fr, en };

export type { Messages };
export type MessageKey = keyof typeof en;
