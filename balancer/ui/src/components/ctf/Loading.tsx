interface LoadingProps {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

export function Loading({
  isLoading,
  message = "LOADING GEODATA...",
  progress = 0,
}: LoadingProps) {
  if (!isLoading) {
    return null;
  }

  return (
    <div className="loading">
      <div className="loading-text">{message}</div>
      <div className="loading-bar">
        <div className="loading-progress" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
