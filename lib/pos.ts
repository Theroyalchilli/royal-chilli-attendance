// Link back to the POS's Staff Hub for the full HR record (contracts, docs,
// everything beyond attendance/payroll). Update once royalchilli.com's POS
// subdomain goes live (Phase 8).
export const POS_URL = process.env.NEXT_PUBLIC_POS_URL || "https://royal-chilli-pos.vercel.app";
export const POS_HR_URL = `${POS_URL}/staff/hr`;
