import React, { Suspense, lazy, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { IntlProvider } from "react-intl";

import { JoinPage } from "./pages/JoinPage";
import { JoiningPage } from "./pages/JoiningPage";
import { JoinedPage } from "./pages/JoinedPage";
import { ScoreBoard } from "./pages/ScoreBoard";

import { Layout } from "./Layout";
import { Spinner } from "./Spinner";

const AdminPage = lazy(() => import("./pages/AdminPage"));

const LoadingPage = () => <Spinner />;

function App() {
  const [locale, setLocale] = useState("en");
  const [messages, setMessages] = useState({});

  const navigatorLocale = navigator.language;
  useEffect(() => {
    let locale = navigatorLocale;
    if (navigatorLocale.startsWith("en")) {
      locale = "en";
    }
    setLocale(locale);
  }, [navigatorLocale]);

  const switchLanguage = async ({ key, messageLoader }) => {
    const messages = (await messageLoader).default;

    setMessages(messages);
    setLocale(key);
  };

  return (
    <IntlProvider defaultLocale="en" locale={locale} messages={messages}>
      <Layout switchLanguage={switchLanguage} selectedLocale={locale}>
        <BrowserRouter basename="/balancer">
          <Suspense fallback={<LoadingPage />}>
            <Routes>
              <Route path="/" exact element={<JoinPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/teams/:team/joining/" element={<JoiningPage />} />
              <Route path="/teams/:team/joined/" element={<JoinedPage />} />
              <Route path="/score-board/" element={<ScoreBoard />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </Layout>
    </IntlProvider>
  );
}

export default App;
