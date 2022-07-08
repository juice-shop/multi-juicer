const availableLanguages = [
  {
    flag: '🇬🇧',
    name: 'English',
    key: 'en',
    messageLoader: () => Promise.resolve({ default: {} }),
  },
  {
    flag: '🇩🇪',
    name: 'German',
    key: 'de-DE',
    messageLoader: () => import('./de-DE'),
  },
  {
    flag: '🇳🇱',
    name: 'Dutch',
    key: 'nl-NL',
    messageLoader: () => import('./nl-NL'),
  },
  {
    flag: '🇷🇺',
    name: 'Русский',
    key: 'ru-RU',
    messageLoader: () => import('./ru-RU'),
  },
];

export default availableLanguages;
