import supabase from "./supabase";
import { getBusiness } from "./business";

// Each business's colours in Attendance (agreed 2026-11-07), built the same way
// as royal-chilli-pos/lib/business-theme.ts. The colours in app/globals.css are
// The Royal Chilli's own and are the starting point. Warning colours aren't here
// on purpose: errors and delete stay red, warnings amber, done green, everywhere.

export type ThemeInput = { main?: string | null; accent?: string | null; classic?: boolean };

const NEUTRAL = "#3F3A36";
const HEX = /^#[0-9a-f]{6}$/i;

type Rgb = [number, number, number];
const toRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const triple = (c: Rgb) => c.map(Math.round).join(" ");
const mix = (c: Rgb, other: Rgb, otherShare: number): Rgb => c.map((v, i) => v + (other[i] - v) * otherShare) as Rgb;
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const DARK_TEXT: Rgb = [26, 26, 26];

function luminance(c: Rgb): number {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const textOn = (c: Rgb): Rgb => (contrast(WHITE, c) >= 3 ? WHITE : DARK_TEXT);

/** The CSS for a business's colours, or null to keep The Royal Chilli's in globals.css. */
export function themeCss(input: ThemeInput): string | null {
  const saved = input.main && HEX.test(input.main) ? input.main : null;
  if (!saved && input.classic) return null;

  const main = toRgb(saved ?? NEUTRAL);
  const accent = input.accent && HEX.test(input.accent) ? toRgb(input.accent) : main;
  const tint = (share: number) => mix(main, WHITE, share);

  const vars: Record<string, string> = {
    "--brand-main": triple(main), "--brand-deep": triple(mix(main, BLACK, 0.18)), "--brand-on": triple(textOn(main)),
    "--brand-accent": triple(accent), "--brand-on-accent": triple(contrast(main, accent) >= 4.5 ? main : textOn(accent)),
    "--brand-tint": triple(tint(0.9)), "--brand-page": triple(tint(0.965)), "--brand-line": triple(tint(0.8)),
    "--brand-cream": triple(tint(0.92)), "--brand-wash": triple(tint(0.97)),
  };
  return `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}`;
}

/** This business's colours for a page, or null to keep the standard ones. */
export async function businessThemeCss(businessId: number): Promise<string | null> {
  const [business, { data }] = await Promise.all([
    getBusiness(businessId),
    supabase.from("business_settings").select("key, value").eq("business_id", businessId).in("key", ["brand_accent", "hub_theme"]),
  ]);
  const setting = (key: string) => data?.find((r) => r.key === key)?.value;
  const accent = setting("brand_accent");
  return themeCss({ main: business?.brand_colour, accent: typeof accent === "string" ? accent : null, classic: setting("hub_theme") === "classic" });
}
