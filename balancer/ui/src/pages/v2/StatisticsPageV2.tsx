import { useState, useEffect } from "react";
import { Card } from "../../components/Card";
import { Spinner } from "../../components/Spinner";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { FormattedMessage } from "react-intl";

// --- Type Definitions ---
interface CategoryStat {
  category: string;
  solves: number;
}
interface ScoreBucket {
  range: string;
  count: number;
}
interface StatisticsData {
  categoryStats: CategoryStat[];
  scoreDistribution: ScoreBucket[];
}

// --- API Fetching ---
async function fetchStatistics(): Promise<StatisticsData> {
  const response = await fetch("/balancer/api/v2/statistics");
  if (!response.ok) {
    throw new Error("Failed to fetch statistics");
  }
  return response.json();
}

// --- Chart Components ---
const COLORS = ['#FF8042', '#0088FE', '#00C49F', '#FFBB28', '#FF4444', '#A463F2'];

const CategoryPieChart = ({ data }: { data: CategoryStat[] }) => (
  <Card className="p-4 border-t-4 border-orange-500">
    <h3 className="font-bold mb-4">
      <FormattedMessage id="v2.stats.category_solves" defaultMessage="Challenge Solves by Category" />
    </h3>
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="solves" nameKey="category" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  </Card>
);

const ScoreDistributionChart = ({ data }: { data: ScoreBucket[] }) => (
  <Card className="p-4 border-t-4 border-orange-500">
    <h3 className="font-bold mb-4">
      <FormattedMessage id="v2.stats.score_distribution" defaultMessage="Score Distribution" />
    </h3>
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="range" width={80} />
          <Tooltip />
          <Bar dataKey="count" fill="#FF8042" barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </Card>
);

const PlaceholderChart = () => (
    <Card className="p-4 border-t-4 border-gray-400">
        <h3 className="font-bold mb-4 text-gray-500">
            <FormattedMessage id="v2.stats.score_progression" defaultMessage="Score Progression" />
        </h3>
        <div className="h-[300px] flex items-center justify-center text-gray-400">
            <FormattedMessage id="v2.stats.coming_soon" defaultMessage="Chart coming soon! (Requires backend changes for historical data)" />
        </div>
    </Card>
);


// --- Main Page Component ---
export const StatisticsPageV2 = () => {
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchStatistics();
        setStats(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  if (isLoading) {
    return <Spinner />;
  }

  if (!stats) {
    return <p>Could not load statistics.</p>;
  }

  const hasData = stats.categoryStats.length > 0;

  return (
    <div className="w-full">
      <div className="mb-6">
        <PlaceholderChart />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {hasData ? (
          <>
            <CategoryPieChart data={stats.categoryStats} />
            <ScoreDistributionChart data={stats.scoreDistribution} />
          </>
        ) : (
          <div className="md:col-span-2 text-center p-8 text-gray-500">
            <FormattedMessage id="v2.stats.no_data" defaultMessage="Awaiting first solve to generate statistics..." />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatisticsPageV2;