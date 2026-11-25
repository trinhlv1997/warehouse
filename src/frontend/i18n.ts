import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import vi from "../locales/vi/translation.json";
import en from "../locales/en/translation.json";

const STORAGE_KEY = "wms.language";

function initialLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "vi" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  return import.meta.env.VITE_DEFAULT_LOCALE || "vi";
}

void i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: "vi",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function changeLanguage(lang: "vi" | "en") {
  void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export default i18n;
