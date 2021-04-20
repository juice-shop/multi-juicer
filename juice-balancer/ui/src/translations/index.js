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
];

export default availableLanguages;
