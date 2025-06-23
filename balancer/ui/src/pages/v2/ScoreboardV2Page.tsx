import { Link } from "react-router-dom";

export const ScoreboardV2Page = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold">Scoreboard V2</h1>
      <p>This is the new and improved scoreboard.</p>
      <div className="mt-4">
        <h2 className="text-lg">Placeholder Links:</h2>
        <ul>
          <li><Link to="/v2/teams/team-alpha" className="text-blue-400">View Team Alpha</Link></li>
          <li><Link to="/v2/challenges/scoreBoardChallenge" className="text-blue-400">View Score Board Challenge</Link></li>
        </ul>
      </div>
    </div>
  );
};