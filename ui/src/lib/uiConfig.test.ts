import { describe, expect, test } from "vitest";

import { defaultUIConfig, parseUIConfig } from "./uiConfig";

describe("parseUIConfig", () => {
  test("falls back to the defaults when no config is embedded", () => {
    expect(parseUIConfig(null)).toEqual(defaultUIConfig);
    expect(parseUIConfig(undefined)).toEqual(defaultUIConfig);
    expect(parseUIConfig("{}")).toEqual(defaultUIConfig);
  });

  test("falls back to the defaults for invalid json", () => {
    expect(parseUIConfig("{not json")).toEqual(defaultUIConfig);
    expect(parseUIConfig("null")).toEqual(defaultUIConfig);
  });

  test("uses the embedded values and the defaults for missing keys", () => {
    expect(parseUIConfig('{"views":{"ctf":{"enabled":false}}}')).toEqual({
      views: {
        scoreOverview: { enabled: true },
        ctf: { enabled: false },
      },
    });
  });
});
