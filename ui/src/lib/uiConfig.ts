export interface ViewConfig {
  enabled: boolean;
}

export interface UIConfig {
  views: {
    scoreOverview: ViewConfig;
    ctf: ViewConfig;
  };
}

export const defaultUIConfig: UIConfig = {
  views: {
    scoreOverview: { enabled: true },
    ctf: { enabled: true },
  },
};

export const UI_CONFIG_ELEMENT_ID = "multi-juicer-ui-config";

/**
 * Parses the ui config the balancer embeds into the index.html.
 * Missing or invalid values fall back to the defaults, e.g. when running the ui via the vite dev server.
 */
export function parseUIConfig(raw: string | null | undefined): UIConfig {
  let parsed: Partial<UIConfig> = {};
  try {
    const value = JSON.parse(raw ?? "{}");
    if (value && typeof value === "object") {
      parsed = value;
    }
  } catch {
    // fall back to defaults
  }

  return {
    views: {
      scoreOverview: {
        ...defaultUIConfig.views.scoreOverview,
        ...parsed.views?.scoreOverview,
      },
      ctf: { ...defaultUIConfig.views.ctf, ...parsed.views?.ctf },
    },
  };
}

/**
 * Read synchronously on module load, so the config is available on the very first render and the ui doesn't shift once it loads.
 */
export const uiConfig: UIConfig = parseUIConfig(
  typeof document === "undefined"
    ? null
    : document.getElementById(UI_CONFIG_ELEMENT_ID)?.textContent
);
