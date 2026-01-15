import { useState } from "react";

import { CheatScoreChart } from "./CheatScoreChart";
import { CheatScoreGraphDialog } from "./CheatScoreGraphDialog";

interface DefaultProps {
  history: {
    totalCheatScore: number;
    timestamp: string;
  }[];
  teamname: string;
}

export function CheatScoreGraph({ history, teamname }: DefaultProps) {
  const [expandedOpen, setExpandedOpen] = useState(false);

  return (
    <div className="relative group">
      {/* Expand Button */}
      {!expandedOpen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpandedOpen(true);
          }}
          className="cursor-pointer absolute top-2 right-2 z-20 text-gray-100 hover:text-white transition bg-gray-800/60 hover:bg-gray-800 p-1 rounded backdrop-blur-sm focus:outline-none focus:ring-0"
          title="Expand"
        >
          ⤢
        </button>
      )}
      <div className="absolute top-3 left-3 z-10 pointer-events-none">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-800 dark:text-gray-400">
          Cheat Score History ·{" "}
          <span className="text-gray-500 lowercase">{teamname}</span>
        </h3>
      </div>
      <div className="w-[400px] h-[170px]">
        <CheatScoreChart history={history} variant="popup" />
      </div>

      <CheatScoreGraphDialog
        open={expandedOpen}
        onClose={() => setExpandedOpen(false)}
        history={history}
        teamname={teamname}
      />
    </div>
  );
}
