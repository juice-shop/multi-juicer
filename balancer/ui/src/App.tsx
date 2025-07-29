import { Suspense, lazy, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { IntlProvider } from "react-intl";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Spinner } from "./components/Spinner";
import { Layout } from "./Layout";
import { LayoutV2 } from "./LayoutV2";
import { JoiningPage } from "./pages/JoiningPage";
import { JoinPage } from "./pages/JoinPage";
import { TeamStatusPage } from "./pages/TeamStatusPage";
import { MessageLoader } from "./translations/index";

const AdminPage = lazy(() => import("./pages/AdminPage"));
const ScoreOverviewPage = lazy(() => import("./pages/ScoreOverview"));
const IndividualScorePage = lazy(() => import("./pages/IndividualScorePage"));
const ScoreboardV2Page = lazy(() => import("./pages/v2/ScoreboardV2Page"));
const TeamDetailPageV2 = lazy(() => import("./pages/v2/TeamDetailPageV2"));
const ChallengeDetailPageV2 = lazy(
  () => import("./pages/v2/ChallengeDetailPageV2")
);
const StatisticsPageV2 = lazy(() => import("./pages/v2/StatisticsPageV2"));

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
          {/* --- V2 Routes with the new LayoutV2 --- */}
          <Route
            path="/v2/*" // Match all routes starting with /v2
            element={
              <LayoutV2>
                <Suspense fallback={<Spinner />}>
                  <Routes>
                    <Route path="/" element={<ScoreboardV2Page />} />
                    <Route path="/statistics" element={<StatisticsPageV2 />} />
                    <Route path="/teams/:team" element={<TeamDetailPageV2 />} />
                    <Route
                      path="/challenges/:challengeKey"
                      element={<ChallengeDetailPageV2 />}
                    />
                  </Routes>
                </Suspense>
              </LayoutV2>
            }
          />

          {/* --- V1 (Old) Routes with the old Layout --- */}
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
                      path="/score-overview/"
                      element={<ScoreOverviewPage activeTeam={activeTeam} />}
                    />
                    <Route
                      path="/score-overview/teams/:team"
                      element={<IndividualScorePage />}
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
