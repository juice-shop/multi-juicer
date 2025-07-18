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
  time: string;
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

// --- API Fetching ---
async function fetchStatistics(): Promise<StatisticsData> {
  // Fetch both statistics and score progression data in parallel
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

const CategoryPieChart = ({ data }: { data: CategoryStat[] }) => {
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];
  return (
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
};

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

const ScoreProgressionChart = ({ data }: { data: TeamSeries[] }) => {
  // Combine all data points and get unique timestamps for the X-axis
  const allTimestamps = [...new Set(data.flatMap(series => series.datapoints.map(dp => new Date(dp.time).getTime())))].sort();
  
  // Transform data into a format recharts can use
  const chartData = allTimestamps.map(ts => {
    const entry: { [key: string]: number } = { time: ts };
    data.forEach(series => {
      const point = [...series.datapoints].reverse().find(dp => new Date(dp.time).getTime() <= ts);
      entry[series.team] = point ? point.score : 0;
    });
    return entry;
  });

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF", "#FF1919"];

  const formatXAxis = (tickItem: number) => new Date(tickItem).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatTooltipLabel = (label: number) => new Date(label).toLocaleString();

  return (
    <Card className="p-4 border-t-4 border-orange-500">
      <h3 className="font-bold mb-4">
        <FormattedMessage id="v2.stats.score_progression" defaultMessage="Score Progression" />
      </h3>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              dataKey="time" 
              domain={['dataMin', 'dataMax']} 
              tickFormatter={formatXAxis} 
            />
            <YAxis 
              allowDecimals={false} 
              domain={[0, 'dataMax + 50']}
            />
            <Tooltip labelFormatter={formatTooltipLabel} />
            <Legend />
            {data.map((series, index) => (
              <Line 
                key={series.team} 
                type="linear" 
                dataKey={series.team} 
                stroke={COLORS[index % COLORS.length]} 
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
                strokeWidth={2}
              />
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
    return <p><FormattedMessage id="v2.stats.load_error" defaultMessage="Could not load statistics." /></p>;
  }

  const hasData = stats.categoryStats.length > 0;

  return (
    <div className="w-full">
      <div className="mb-6">
        {hasData ? <ScoreProgressionChart data={stats.scoreProgression} /> : (
            <Card className="p-4 border-t-4 border-gray-400">
                <h3 className="font-bold mb-4 text-gray-500">
                    <FormattedMessage id="v2.stats.score_progression" defaultMessage="Score Progression" />
                </h3>
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                    <FormattedMessage id="v2.stats.coming_soon_no_data" defaultMessage="Awaiting first solve to generate statistics..." />
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