import React, { useState, useRef, useLayoutEffect } from "react";
import {
  FormattedDate,
  FormattedMessage,
  FormattedTime,
  useIntl,
} from "react-intl";

interface CheatScoreChartProps {
  history: {
    totalCheatScore: number;
    timestamp: string;
  }[];
  variant: "popup" | "dialog";
}

export function CheatScoreChart({ history, variant }: CheatScoreChartProps) {
  const intl = useIntl();
  const [hoverData, setHoverData] = useState<{
    x: number;
    y: number;
    score: number;
    timestamp: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const measure = () => {
      if (variant === "popup") {
        setDimensions({ width: 400, height: 170 });
      } else {
        const { clientWidth, clientHeight } = containerRef.current!;
        setDimensions({ width: clientWidth, height: clientHeight || 400 });
      }
    };

    measure();
  }, [variant]);

  const { width, height } = dimensions;
  const padding = 50;

  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const points =
    history.length < 2 || width === 0 || height === 0
      ? []
      : sortedHistory.map((h, index) => {
          const x =
            padding +
            (index / (sortedHistory.length - 1)) * (width - 2 * padding);
          const y =
            height - padding - h.totalCheatScore * (height - 2 * padding);
          return { x, y, score: h.totalCheatScore, timestamp: h.timestamp };
        });

  const pathData =
    points.length === 0
      ? ""
      : points.reduce((acc, point, i) => {
          if (i === 0) return `M ${point.x} ${point.y}`;
          return `${acc} L ${point.x} ${point.y}`;
        }, "");

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || points.length === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;

    const scaleX = width / rect.width;
    const scaledCursorX = cursorX * scaleX;

    let closestPoint = points[0];
    let minDistance = Math.abs(scaledCursorX - closestPoint.x);

    for (let i = 1; i < points.length; i++) {
      const d = Math.abs(scaledCursorX - points[i].x);
      if (d < minDistance) {
        minDistance = d;
        closestPoint = points[i];
      }
    }

    setHoverData(closestPoint);
  };

  if (history.length < 2) {
    return (
      <div className="text-gray-500 text-sm p-4 text-center">
        <FormattedMessage
          id="cheat_score_graph.not_enough_data"
          defaultMessage="Not enough data for graph"
        />
      </div>
    );
  }

  const horizontalLines = variant === "dialog" ? 11 : 4;
  const verticalLines =
    variant === "dialog"
      ? Math.min(points.length, 20)
      : Math.min(points.length, 10);

  return (
    <div
      className={`relative rounded-xl shadow-lg overflow-hidden bg-gray-100 dark:bg-black ${
        variant === "popup"
          ? "w-[400] h-[170] border border-gray-900 dark:border-none"
          : "w-full h-full"
      }`}
      ref={containerRef}
    >
      <svg
        width="100%"
        height="100%"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverData(null)}
        className="cursor-crosshair w-full h-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        {/* Horizontal grid + labels */}
        {Array.from({ length: horizontalLines }).map((_, i) => {
          const value = 1 - i / (horizontalLines - 1);
          const y = height - padding - value * (height - 2 * padding);

          return (
            <g key={i}>
              <line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="currentColor"
                className="text-gray-300 dark:text-gray-600"
              />
              <text
                x={padding - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-gray-600 dark:fill-gray-400 text-[11px]"
              >
                {(value * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}

        {/* Vertical grid */}
        {Array.from({ length: verticalLines }).map((_, i) => {
          const x = padding + (i / (verticalLines - 1)) * (width - 2 * padding);

          return (
            <line
              key={i}
              x1={x}
              y1={padding}
              x2={x}
              y2={height - padding}
              stroke="currentColor"
              className="text-gray-300/50 dark:text-gray-600/50"
            />
          );
        })}

        {/* Axis lines */}
        <line
          x1={padding}
          y1={padding - 5}
          x2={padding}
          y2={height - padding}
          className="stroke-gray-400 dark:stroke-gray-500"
        />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding + 5}
          y2={height - padding}
          className="stroke-gray-400 dark:stroke-gray-500"
        />

        {/* X-axis title */}
        <text
          x={width / 2}
          y={height - 25}
          textAnchor="middle"
          className="fill-gray-600 dark:fill-gray-400 text-[11px] font-medium"
        >
          {intl.formatMessage({
            id: "cheat_score_graph.x_axis_label",
            defaultMessage: "Challenges Solved →",
          })}
        </text>

        {/* Data line */}
        <path
          d={pathData}
          fill="none"
          stroke="currentColor"
          className="text-blue-500"
          strokeWidth={variant === "dialog" ? "2.5" : "1.75"}
        />

        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={variant === "dialog" ? "3.2" : "2"}
            className="fill-blue-500"
          />
        ))}

        {/* Hover highlight */}
        {hoverData && (
          <>
            <line
              x1={hoverData.x}
              y1={hoverData.y}
              x2={hoverData.x}
              y2={height - padding}
              className="stroke-gray-400 dark:stroke-gray-500"
              strokeDasharray="5 5"
            />

            <circle
              cx={hoverData.x}
              cy={hoverData.y}
              r={variant === "dialog" ? "11" : "8"}
              className="fill-orange-400/25"
            />

            <circle
              cx={hoverData.x}
              cy={hoverData.y}
              r={variant === "dialog" ? "4.5" : "2"}
              className="fill-blue-500 stroke-white dark:stroke-gray-900"
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hoverData && (
        <div
          className="absolute bg-gray-100 dark:bg-gray-800 text-gray=900 dark:text-white text-xs rounded-lg px-3 py-2 pointer-events-none z-50 whitespace-nowrap shadow-xl border border-gray-700 dark:border-gray-600"
          style={{
            left: hoverData.x,
            top: hoverData.y,
            transform: "translate(-50%, -100%) translateY(-15px)",
          }}
        >
          <div className="font-semibold">
            {(hoverData.score * 100).toFixed(1)}%
          </div>

          <div className="text-gray-600 dark:text-gray-300 text-[10px]">
            <FormattedDate
              value={hoverData.timestamp}
              month="short"
              day="2-digit"
            />{" "}
            <FormattedTime value={hoverData.timestamp} />
          </div>
          <div className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-gray-100 dark:border-t-gray-800" />
        </div>
      )}
    </div>
  );
}
