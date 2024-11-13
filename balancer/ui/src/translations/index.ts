export type MessageLoader = () => Promise<{ default: Record<string, string> }>;
export interface Language {
  flag: string;
  name: string;
  key: string;
  messageLoader: MessageLoader;
}

const availableLanguages: Language[] = [
  {
    flag: "🇬🇧",
    name: "English",
    key: "en",
    messageLoader: () => Promise.resolve({ default: {} }),
  },
  {
    flag: "🇩🇪",
    name: "German",
    key: "de-DE",
    messageLoader: () =>
      import("./de-DE") as Promise<{ default: Record<string, string> }>,
  },
  {
    flag: "🇳🇱",
    name: "Dutch",
    key: "nl-NL",
    messageLoader: () =>
      import("./nl-NL") as Promise<{ default: Record<string, string> }>,
  },
  {
    flag: "🇺🇦",
    name: "Ukrainian",
    key: "uk-UA",
    messageLoader: () =>
      import("./uk-UA") as Promise<{ default: Record<string, string> }>,
  },
];

export default availableLanguages;
