import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';

import { IntlProvider, addLocaleData } from 'react-intl';
import translations from './translations';

import { JoinPage } from './pages/JoinPage';
import { JoiningPage } from './pages/JoiningPage';
import { JoinedPage } from './pages/JoinedPage';

import { Layout } from './Layout';
import { Spinner } from './Spinner';
import { Footer } from './Footer';

const AdminPage = lazy(() => import('./pages/AdminPage'));

for (const tranlation of translations) {
  addLocaleData({
    locale: tranlation.key,
    parentLocale: 'en',
  });
}

const LoadingPage = () => <Spinner />;

function App() {
  const [locale, setLocale] = useState('en');
  const [messages, setMessages] = useState({});

  const switchLanguage = async ({ key, messageLoader }) => {
    const messages = (await messageLoader).default;

    setMessages(messages);
    setLocale(key);
  };

  return (
    <IntlProvider defaultLocale="en" locale={locale} messages={messages}>
      <>
        <Router basename="/balancer">
          <Layout footer={<Footer switchLanguage={switchLanguage} />}>
            <Suspense fallback={<LoadingPage />}>
              <Switch>
                <Route path="/" exact component={JoinPage} />
                <Route path="/admin" component={AdminPage} />
                <Route path="/teams/:team/joining/" component={JoiningPage} />
                <Route path="/teams/:team/joined/" component={JoinedPage} />
              </Switch>
            </Suspense>
          </Layout>
        </Router>
      </>
    </IntlProvider>
  );
}

export default App;
