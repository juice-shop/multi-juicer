import React, { Suspense, lazy, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { IntlProvider } from "react-intl";

import { JoinPage } from "./pages/JoinPage.tsx";
import { JoiningPage } from "./pages/JoiningPage.tsx";
import { ScoreBoard } from "./pages/ScoreBoard.tsx";
import { TeamStatusPage } from "./pages/TeamStatusPage.tsx";

import { Layout } from "./Layout.tsx";
import { Spinner } from "./Spinner.tsx";

const AdminPage = lazy(() => import("./pages/AdminPage.tsx"));

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
    const { default: messages } = await messageLoader();

    setMessages(messages);
    setLocale(key);
  };

  return (
    <IntlProvider defaultLocale="en" locale={locale} messages={messages}>
      <BrowserRouter basename="/balancer">
        <Routes>
          <Route
            path="*"
            element={
              <Layout switchLanguage={switchLanguage} selectedLocale={locale}>
                <Suspense fallback={<LoadingPage />}>
                  <Routes>
                    <Route path="/" exact element={<JoinPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route
                      path="/teams/:team/status/"
                      element={<TeamStatusPage />}
                    />
                    <Route
                      path="/teams/:team/joining/"
                      element={<JoiningPage />}
                    />
                    <Route path="/score-board/" element={<ScoreBoard />} />
                  </Routes>
                </Suspense>
              </Layout>
            }
          ></Route>
        </Routes>
      </BrowserRouter>
    </IntlProvider>
  );
}

export default App;
