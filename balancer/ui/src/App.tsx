import { Suspense, lazy, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { IntlProvider } from "react-intl";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Spinner } from "./components/Spinner";
import { Layout } from "./Layout";
import { JoiningPage } from "./pages/JoiningPage";
import { JoinPage } from "./pages/JoinPage";
import { TeamStatusPage } from "./pages/TeamStatusPage";
import { MessageLoader } from "./translations/index";

const AdminPage = lazy(() => import("./pages/AdminPage"));
const ScoreOverviewPage = lazy(() => import("./pages/ScoreOverviewPage"));
const TeamDetailPage = lazy(() => import("./pages/TeamDetailPage"));
const ChallengeDetailPage = lazy(() => import("./pages/ChallengeDetailPage"));

interface SimplifiedTeamStatusResponse {
  name: string;
}

async function fetchTeamStatusData(): Promise<SimplifiedTeamStatusResponse | null> {
  const response = await fetch(`/balancer/api/teams/status`);
  if (!response.ok) {
    return null;
  }
  const status = (await response.json()) as SimplifiedTeamStatusResponse;
  return status;
}

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

  useEffect(() => {
    async function updateStatusData() {
      const status = await fetchTeamStatusData();
      if (!status) {
        return;
      }
      setActiveTeam(status.name);
    }
    updateStatusData();
  }, []);

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
            path="/*"
            element={
              <Layout
                activeTeam={activeTeam}
                switchLanguage={switchLanguage}
                selectedLocale={locale}
              >
                <Suspense fallback={<Spinner />}>
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
                    <Route
                      path="/score-overview"
                      element={<ScoreOverviewPage />}
                    />
                    <Route
                      path="/score-overview/teams/:team"
                      element={<TeamDetailPage />}
                    />
                    <Route
                      path="/score-overview/challenges/:challengeKey"
                      element={<ChallengeDetailPage />}
                    />
                  </Routes>
                </Suspense>
              </Layout>
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </IntlProvider>
  );
}

export default App;
