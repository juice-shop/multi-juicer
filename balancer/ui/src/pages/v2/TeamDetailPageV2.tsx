import { useParams } from "react-router-dom";

export const TeamDetailPageV2 = () => {
  const { team } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold">Team Detail: {team}</h1>
      <p>Details for this team will be shown here.</p>
    </div>
  );
};