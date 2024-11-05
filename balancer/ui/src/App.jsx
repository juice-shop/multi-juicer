import React, { Suspense, lazy, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { IntlProvider } from "react-intl";

import { JoinPage } from "./pages/JoinPage";
import { JoiningPage } from "./pages/JoiningPage";
import { JoinedPage } from "./pages/JoinedPage";
import { ScoreBoard } from "./pages/ScoreBoard";

import { Layout } from "./Layout";
import { Spinner } from "./Spinner";
import { Footer } from "./Footer";

const AdminPage = lazy(() => import("./pages/AdminPage"));

const LoadingPage = () => <Spinner />;

function App() {
  const [locale, setLocale] = useState("en");
  const [messages, setMessages] = useState({});

  const navigatorLocale = navigator.language;
  useEffect(() => {
    setLocale(navigatorLocale);
  }, [navigatorLocale]);

  const switchLanguage = async ({ key, messageLoader }) => {
    const messages = (await messageLoader).default;

    setMessages(messages);
    setLocale(key);
  };

  return (
    <IntlProvider defaultLocale="en" locale={locale} messages={messages}>
      <>
        <BrowserRouter basename="/balancer">
          <Suspense fallback={<LoadingPage />}>
            <Routes>
              <Route
                path="/"
                exact
                element={
                  <Layout
                    footer={
                      <Footer
                        selectedLocale={locale}
                        switchLanguage={switchLanguage}
                      />
                    }
                  >
                    <JoinPage />
                  </Layout>
                }
              />
              <Route
                path="/admin"
                element={
                  <Layout
                    footer={
                      <Footer
                        selectedLocale={locale}
                        switchLanguage={switchLanguage}
                      />
                    }
                    wide={true}
                  >
                    <AdminPage />
                  </Layout>
                }
              />
              <Route
                path="/teams/:team/joining/"
                element={
                  <Layout
                    footer={
                      <Footer
                        selectedLocale={locale}
                        switchLanguage={switchLanguage}
                      />
                    }
                  >
                    <JoiningPage />
                  </Layout>
                }
              />
              <Route
                path="/teams/:team/joined/"
                element={
                  <Layout
                    footer={
                      <Footer
                        selectedLocale={locale}
                        switchLanguage={switchLanguage}
                      />
                    }
                  >
                    <JoinedPage />
                  </Layout>
                }
              />
              <Route
                path="/score-board/"
                element={
                  <Layout
                    footer={
                      <Footer
                        selectedLocale={locale}
                        switchLanguage={switchLanguage}
                      />
                    }
                  >
                    <ScoreBoard />
                  </Layout>
                }
              />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </>
    </IntlProvider>
  );
}

export default App;
