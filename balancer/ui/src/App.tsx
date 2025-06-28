import { Suspense, lazy, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { IntlProvider } from "react-intl";

import { JoinPage } from "./pages/JoinPage";
import { JoiningPage } from "./pages/JoiningPage";
import { TeamStatusPage } from "./pages/TeamStatusPage";

import { Layout } from "./Layout";
import { Spinner } from "./components/Spinner";
import { MessageLoader } from "./translations/index";
import { Toaster } from "react-hot-toast";

const AdminPage = lazy(() => import("./pages/AdminPage"));
const ScoreOverviewPage = lazy(() => import("./pages/ScoreOverview"));
const IndividualScorePage = lazy(() => import("./pages/IndividualScorePage"));
const ScoreboardV2Page = lazy(() => import("./pages/v2/ScoreboardV2Page"));
const TeamDetailPageV2 = lazy(() => import("./pages/v2/TeamDetailPageV2"));
const ChallengeDetailPageV2 = lazy(() => import("./pages/v2/ChallengeDetailPageV2"));


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
            path="*"
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
                      path="/score-overview/"
                      element={<ScoreOverviewPage activeTeam={activeTeam} />}
                    />
                    <Route
                      path="/score-overview/teams/:team"
                      element={<IndividualScorePage />}
                    />
                    <Route 
                      path="/v2" 
                      element={<ScoreboardV2Page />} 
                    />
                    <Route 
                      path="/v2/teams/:team" 
                      element={<TeamDetailPageV2 />} 
                    />
                    <Route 
                      path="/v2/challenges/:challengeKey"
                      element={<ChallengeDetailPageV2 />} 
                    />
                  </Routes>
                </Suspense>
              </Layout>
            }
          ></Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </IntlProvider>
  );
}

export default App;
