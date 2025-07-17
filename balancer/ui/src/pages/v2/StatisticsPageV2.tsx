import { useState, useEffect } from "react";
import { FormattedMessage } from "react-intl";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend
} from 'recharts';
import { Card } from "../../components/Card";
import { Spinner } from "../../components/Spinner";

// --- Type Definitions ---
interface CategoryStat {
  category: string;
  solves: number;
}

interface ScoreBucket {
  range: string;
  count: number;
}

interface DataPoint {
  time: string; // ISO String
  score: number;
}

interface TeamSeries {
  team: string;
  datapoints: DataPoint[];
}

interface StatisticsData {
  categoryStats: CategoryStat[];
  scoreDistribution: ScoreBucket[];
  scoreProgression: TeamSeries[];
}

// --- API Fetching Logic ---
async function fetchStatistics(): Promise<StatisticsData> {
  // Fetch both statistics and progression data in parallel
  const [statsRes, progressionRes] = await Promise.all([
    fetch('/balancer/api/v2/statistics'),
    fetch('/balancer/api/v2/statistics/score-progression')
  ]);

  if (!statsRes.ok || !progressionRes.ok) {
    throw new Error("Failed to fetch statistics data");
  }

  const statsData = await statsRes.json();
  const progressionData = await progressionRes.json();
  
  return { ...statsData, scoreProgression: progressionData };
}

// --- Chart Components ---

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF", "#FF1919", "#82ca9d"];

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

const ScoreDistributionChart = ({ data }: { data: ScoreBucket[] }) => {
  // Filter out buckets with zero count for a cleaner chart
  const filteredData = data.filter(bucket => bucket.count > 0);

  return (
    <Card className="p-4 border-t-4 border-orange-500">
      <h3 className="font-bold mb-4">
        <FormattedMessage id="v2.stats.score_distribution" defaultMessage="Score Distribution" />
      </h3>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={filteredData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="range" width={80} />
            <Tooltip />
            <Bar dataKey="count" fill="#FF8042" barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

const ScoreProgressionChart = ({ data }: { data: TeamSeries[] }) => {
  // 1. Get a sorted list of all unique timestamps from all series
  const allTimestamps = [...new Set(data.flatMap(series => series.datapoints.map(dp => new Date(dp.time).getTime())))].sort();

  // 2. Transform the data into a format that Recharts LineChart can easily consume.
  // Each object in the array represents a point in time on the X-axis.
  const chartData = allTimestamps.map(ts => {
    const time = new Date(ts);
    const entry: { [key: string]: string | number } = { 
      // Format time for display on the axis
      time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };

    // For each team, find their score at this specific timestamp
    data.forEach(series => {
      // Find the last score at or before this timestamp for this team
      const point = [...series.datapoints].reverse().find(dp => new Date(dp.time).getTime() <= ts);
      entry[series.team] = point ? point.score : 0;
    });
    return entry;
  });

  return (
    <Card className="p-4 border-t-4 border-orange-500">
      <h3 className="font-bold mb-4">
        <FormattedMessage id="v2.stats.score_progression" defaultMessage="Score Progression" />
      </h3>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            {data.map((series, index) => (
              <Line key={series.team} type="monotone" dataKey={series.team} stroke={COLORS[index % COLORS.length]} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};


// --- Main Page Component ---
export const StatisticsPageV2 = () => {
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
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
    return <p><FormattedMessage id="v2.stats.error" defaultMessage="Could not load statistics." /></p>;
  }

  const hasData = stats.categoryStats.length > 0;

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="w-full">
        {hasData ? (
          <ScoreProgressionChart data={stats.scoreProgression} />
        ) : (
          <Card className="p-4 border-t-4 border-gray-400">
              <h3 className="font-bold mb-4 text-gray-500">
                  <FormattedMessage id="v2.stats.score_progression" defaultMessage="Score Progression" />
              </h3>
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                  <FormattedMessage id="v2.stats.awaiting_data" defaultMessage="Awaiting data to generate chart..." />
              </div>
          </Card>
        )}
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