import { Suspense, lazy, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { IntlProvider } from "react-intl";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Spinner } from "./components/Spinner";
import { Layout } from "./Layout";
import { JoiningPage } from "./pages/JoiningPage";
import { JoinPage } from "./pages/JoinPage";
import { TeamStatusPage } from "./pages/TeamStatusPage";
import availableLanguages, { MessageLoader } from "./translations/index";

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

const LOCALE_STORAGE_KEY = "multijuicer:locale";

function App() {
  const [locale, setLocale] = useState(() => {
    // Try to get locale from localStorage first
    const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (storedLocale) {
      return storedLocale;
    }
    // Fall back to navigator language
    const navigatorLocale = navigator.language;
    if (navigatorLocale.startsWith("en")) {
      return "en";
    }
    return navigatorLocale;
  });
  const [messages, setMessages] = useState({});
  const [activeTeam, setActiveTeam] = useState<string | null>(null);

  // Load initial messages for the stored locale
  useEffect(() => {
    async function loadInitialMessages() {
      const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (storedLocale && storedLocale !== "en") {
        const language = availableLanguages.find(
          (lang) => lang.key === storedLocale
        );
        if (language) {
          const { default: messages } = await language.messageLoader();
          setMessages(messages);
        }
      }
    }
    loadInitialMessages();
  }, []);

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
    localStorage.setItem(LOCALE_STORAGE_KEY, key);
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
                setActiveTeam={setActiveTeam}
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
                      element={<ScoreOverviewPage activeTeam={activeTeam} />}
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
