import { useEffect, useState } from "react";

export interface UIConfig {
  showScoreboardView: boolean;
  showCtfView: boolean;
}

/**
 * Fetches which optional views the UI should link. All of them stay hidden until the config is loaded.
 */
export function useUIConfig(): UIConfig {
  const [uiConfig, setUIConfig] = useState<UIConfig>({
    showScoreboardView: false,
    showCtfView: false,
  });

  useEffect(() => {
    fetch("/multi-juicer/api/ui-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((config) => config && setUIConfig(config))
      .catch(() => {});
  }, []);

  return uiConfig;
}
