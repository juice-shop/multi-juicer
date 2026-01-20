import { FormattedMessage, useIntl } from "react-intl";

import { CheatScoreChart } from "./CheatScoreChart";

interface Props {
  open: boolean;
  onClose: () => void;
  history: {
    totalCheatScore: number;
    timestamp: string;
  }[];
  teamname: string;
}

export function CheatScoreGraphDialog({
  open,
  onClose,
  history,
  teamname,
}: Props) {
  const intl = useIntl();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
      <div
        className="relative bg-gray-200 dark:bg-black border border-gray-800 rounded-xl shadow-2xl h-[600px] flex flex-col"
        style={{ width: "calc(100% - 40px)", maxHeight: "90vh" }}
      >
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <h3 className="text-m ml-5 font-semibold uppercase tracking-wider text-gray-800 dark:text-gray-300">
            <FormattedMessage
              id="cheat_score_graph.title"
              defaultMessage="Cheat Score History"
            />{" "}
            · <span className="text-gray-500 lowercase">{teamname}</span>
          </h3>
        </div>

        <button
          onClick={onClose}
          className="cursor-pointer absolute top-4 right-4 z-20 text-gray-300 hover:text-white transition bg-gray-900/50 hover:bg-gray-800 p-2 rounded-full leading-none w-8 h-8 flex items-center justify-center"
          title={intl.formatMessage({
            id: "cheat_score_graph.close",
            defaultMessage: "Close",
          })}
        >
          ✕
        </button>

        <div className="flex-1 w-full h-full p-4 pt-2">
          <CheatScoreChart history={history} variant="dialog" />
        </div>
      </div>
    </div>
  );
}
