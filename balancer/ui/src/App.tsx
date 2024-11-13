import { Suspense, lazy, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { IntlProvider } from "react-intl";

import { JoinPage } from "./pages/JoinPage";
import { JoiningPage } from "./pages/JoiningPage";
import { ScoreBoard } from "./pages/ScoreBoard";
import { TeamStatusPage } from "./pages/TeamStatusPage";

import { Layout } from "./Layout";
import { Spinner } from "./Spinner";
import { MessageLoader } from "./translations/index";

const AdminPage = lazy(() => import("./pages/AdminPage"));

const LoadingPage = () => <Spinner />;

function App() {
  const [locale, setLocale] = useState("en");
  const [messages, setMessages] = useState({});
  const [activeTeam, setActiveTeam] = useState<string | null>(null);

  const navigatorLocale = navigator.language;
  useEffect(() => {
    let locale = navigatorLocale;
    if (navigatorLocale.startsWith("en")) {
      locale = "en";
    }
    setLocale(locale);
  }, [navigatorLocale]);

  const switchLanguage = async ({
    key,
    messageLoader,
  }: {
    key: string;
    messageLoader: MessageLoader;
  }) => {
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
              <Layout
                activeTeam={activeTeam}
                switchLanguage={switchLanguage}
                selectedLocale={locale}
              >
                <Suspense fallback={<LoadingPage />}>
                  <Routes>
                    <Route
                      path="/"
                      element={
                        <JoinPage
                          activeTeam={activeTeam}
                          setActiveTeam={setActiveTeam}
                        />
                      }
                    />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route
                      path="/teams/:team/status/"
                      element={<TeamStatusPage setActiveTeam={setActiveTeam} />}
                    />
                    <Route
                      path="/teams/:team/joining/"
                      element={<JoiningPage setActiveTeam={setActiveTeam} />}
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
