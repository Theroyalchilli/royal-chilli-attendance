jest.mock("../supabase", () => ({ __esModule: true, default: {} }));
jest.mock("../business", () => ({ __esModule: true, getBusiness: jest.fn() }));

import { themeCss } from "../business-theme";

const value = (css: string, name: string) => css.match(new RegExp(`${name}:([^;}]+)`))?.[1];

describe("themeCss", () => {
  it("keeps the standard colours for a business marked classic, with no colour of its own", () => {
    expect(themeCss({ classic: true })).toBeNull();
  });

  it("a saved colour takes over", () => {
    expect(value(themeCss({ main: "#2F2B5A", classic: true })!, "--brand-main")).toBe("47 43 90");
  });

  it("is neutral with no colour saved, or one that isn't valid", () => {
    expect(value(themeCss({})!, "--brand-main")).toBe("63 58 54");
    expect(value(themeCss({ main: "red;}body{display:none" })!, "--brand-main")).toBe("63 58 54");
  });

  it("uses white on dark colours and dark text on light ones", () => {
    for (const c of ["#2F2B5A", "#D61C5D", "#9A6B9A"]) expect(value(themeCss({ main: c })!, "--brand-on")).toBe("255 255 255");
    expect(value(themeCss({ main: "#EAE014" })!, "--brand-on")).toBe("26 26 26");
  });

  it("gives Pizza2Night's yellow highlight navy text", () => {
    const css = themeCss({ main: "#2F2B5A", accent: "#EAE014" })!;
    expect(value(css, "--brand-accent")).toBe("234 224 20");
    expect(value(css, "--brand-on-accent")).toBe("47 43 90");
  });
});
