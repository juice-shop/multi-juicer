import { FormattedMessage } from "react-intl";
import { Card } from "../../components/Card";

// Dummy data for now. In the future, this would come from an API.
const dummyStats = {
  totalChallenges: 102,
  totalSolves: 158,
  mostSolvedChallenge: { name: "Score Board", solves: 12 },
  leastSolvedChallenge: { name: "Forged Feedback", solves: 1 },
};

const StatCard = ({ title, value }: { title: React.ReactNode; value: string | number }) => (
  <Card className="p-4 text-center">
    <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-2xl font-bold">{value}</p>
  </Card>
);

export const StatisticsPage = () => {
  return (
    <div className="w-full">
      <h1 className="text-3xl font-bold text-center mb-6">
        <FormattedMessage id="v2.statistics.title" defaultMessage="Event Statistics" />
      </h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title={<FormattedMessage id="stats.total_challenges" defaultMessage="Total Challenges" />}
          value={dummyStats.totalChallenges}
        />
        <StatCard 
          title={<FormattedMessage id="stats.total_solves" defaultMessage="Total Solves" />}
          value={dummyStats.totalSolves}
        />
        <StatCard 
          title={<FormattedMessage id="stats.most_solved" defaultMessage="Most Solved" />}
          value={dummyStats.mostSolvedChallenge.name}
        />
        <StatCard 
          title={<FormattedMessage id="stats.least_solved" defaultMessage="Least Solved" />}
          value={dummyStats.leastSolvedChallenge.name}
        />
      </div>
      <div className="mt-8 text-center text-gray-400">
        <p>
          <FormattedMessage id="stats.more_to_come" defaultMessage="More detailed charts and visualizations coming soon!" />
        </p>
      </div>
    </div>
  );
};