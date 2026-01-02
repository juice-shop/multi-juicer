export function InfoPanel() {
  return (
    <div className="p-5 bg-ctf-bg-panel border-2 border-ctf-primary backdrop-blur-[5px] uppercase tracking-[2px] flex flex-col items-center justify-center shadow-[0_0_5px_rgba(255,107,107,0.3),inset_0_0_5px_rgba(255,107,107,0.05)]">
      <h1
        className="text-2xl font-bold m-0 text-center flex items-center gap-2.5 text-ctf-primary"
        style={{
          textShadow:
            "0 0 10px var(--color-ctf-primary), 0 0 20px var(--color-ctf-primary)",
        }}
      >
        <img
          src="/balancer/favicon.svg"
          alt="MultiJuicer Logo"
          className="h-[1.4em] w-auto align-middle"
        />
        MultiJuicer CTF
      </h1>
    </div>
  );
}
