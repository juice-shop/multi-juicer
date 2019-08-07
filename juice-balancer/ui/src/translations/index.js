export default [
  {
    flag: '🇬🇧',
    name: 'English',
    key: 'en',
    messageLoader: () => Promise.resolve({}),
  },
  {
    flag: '🇩🇪',
    name: 'German',
    key: 'de-DE',
    messageLoader: () => import('./de-DE'),
  },
];
