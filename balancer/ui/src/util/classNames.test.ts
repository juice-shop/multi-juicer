import { describe, it, expect } from "vitest";
import { classNames } from "./classNames";

describe("classNames", () => {
  it("should return a single class name", () => {
    expect(classNames("class1")).toBe("class1");
  });

  it("should join multiple class names with a space", () => {
    expect(classNames("class1", "class2")).toBe("class1 class2");
  });

  it("should filter out falsy values", () => {
    expect(
      classNames("class1", false, "class2", null, undefined, "class3", "")
    ).toBe("class1 class2 class3");
  });

  it("should return an empty string if no class names are provided", () => {
    expect(classNames()).toBe("");
  });

  it("should filter out extra leading white spaces", () => {
    expect(classNames("class1", " class2")).toBe("class1 class2");
  });
});
