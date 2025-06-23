import { useParams } from "react-router-dom";

export const ChallengeDetailPageV2 = () => {
  const { challengeKey } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold">Challenge Detail: {challengeKey}</h1>
      <p>Details for this challenge will be shown here.</p>
    </div>
  );
};