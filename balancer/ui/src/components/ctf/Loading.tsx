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
    <div className="fixed top-0 left-0 w-screen h-screen bg-ctf-bg flex flex-col items-center justify-center z-[1000] transition-opacity duration-500">
      <div
        className="text-xl tracking-[4px] uppercase mb-8 animate-pulse text-ctf-primary"
        style={{
          textShadow:
            "0 0 10px var(--color-ctf-primary), 0 0 20px var(--color-ctf-primary)",
        }}
      >
        {message}
      </div>
      <div className="w-[300px] h-1 bg-[rgba(0,255,255,0.2)] border border-ctf-primary overflow-hidden shadow-[0_0_10px_var(--color-ctf-primary)]">
        <div
          className="h-full bg-ctf-primary transition-[width] duration-300 ease-out"
          style={{
            width: `${progress}%`,
            boxShadow:
              "0 0 10px var(--color-ctf-primary), 0 0 20px var(--color-ctf-primary)",
          }}
        />
      </div>
    </div>
  );
}
