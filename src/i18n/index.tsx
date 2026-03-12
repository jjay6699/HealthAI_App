import React, { ReactNode, createContext, useContext, useMemo, useState } from "react";
import { persistentStorage } from "../services/persistentStorage";
import { defaultLanguage, Language, TranslationKey, translations } from "./translations";

const LANGUAGE_STORAGE_KEY = "appLanguage";

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const resolveInitialLanguage = (): Language => {
  if (typeof window === "undefined") return defaultLanguage;

  const stored = persistentStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === "en" || stored === "zh") return stored;

  const browserLanguage = window.navigator.language.toLowerCase();
  if (browserLanguage.startsWith("zh")) return "zh";
  return defaultLanguage;
};

const I18nContext = createContext<I18nContextValue>({
  language: defaultLanguage,
  setLanguage: () => undefined,
  t: (key) => translations[defaultLanguage][key] ?? key
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(resolveInitialLanguage);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    persistentStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = translations[language];

    const t = (key: TranslationKey, vars?: Record<string, string | number>) => {
      const template = String(dictionary[key] ?? translations[defaultLanguage][key] ?? key);
      if (!vars) return template;

      return Object.entries(vars).reduce((result, [name, replacement]) => {
        return result.replace(new RegExp(`\\{${name}\\}`, "g"), String(replacement));
      }, template as string);
    };

    return {
      language,
      setLanguage,
      t
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);

export type { Language, TranslationKey };
