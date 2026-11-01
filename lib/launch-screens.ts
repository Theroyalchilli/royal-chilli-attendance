// iPhone launch screens (app/launch-screen): iOS only shows one whose size
// exactly matches the phone, so every iPhone screen is listed — CSS width ×
// height in points and the pixel ratio. Add new models here.
export const LAUNCH_SIZES: { w: number; h: number; dpr: number }[] = [
  { w: 440, h: 956, dpr: 3 }, // 16/17 Pro Max
  { w: 402, h: 874, dpr: 3 }, // 16 Pro, 17, 17 Pro
  { w: 420, h: 912, dpr: 3 }, // Air
  { w: 430, h: 932, dpr: 3 }, // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  { w: 393, h: 852, dpr: 3 }, // 14 Pro, 15, 15 Pro, 16, 16e
  { w: 428, h: 926, dpr: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 390, h: 844, dpr: 3 }, // 12, 13, 14, 12/13 Pro
  { w: 375, h: 812, dpr: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 414, h: 896, dpr: 3 }, // XS Max, 11 Pro Max
  { w: 414, h: 896, dpr: 2 }, // XR, 11
  { w: 414, h: 736, dpr: 3 }, // 6/7/8 Plus
  { w: 375, h: 667, dpr: 2 }, // 6/7/8, SE 2nd/3rd gen
  { w: 320, h: 568, dpr: 2 }, // SE 1st gen
];

/** For the root layout's metadata (appleWebApp.startupImage). */
export const launchScreens = LAUNCH_SIZES.map(({ w, h, dpr }) => ({
  url: `/launch-screen?w=${w * dpr}&h=${h * dpr}`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}));
