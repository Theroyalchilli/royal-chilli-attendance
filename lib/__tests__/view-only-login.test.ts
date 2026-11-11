import { NextRequest } from "next/server";

let viewOnly = true;
jest.mock("../supabase", () => ({
  __esModule: true,
  default: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { view_only: viewOnly }, error: null }) }) }) }) },
}));

const req = async (method: string, path: string, owner = true, id = 26) => {
  const { createSession, getSessionFromRequest } = await import("../auth");
  const token = await createSession({ id, name: "Owner", role: "admin", businessId: 1, ...(owner ? { owner: true } : {}) });
  return getSessionFromRequest(new NextRequest(`http://x${path}`, { method, headers: { cookie: `pos_session=${token}` } }));
};

describe("view-only Super admin login (148, 2026-11-11)", () => {
  it("can read everything", async () => {
    expect(await req("GET", "/api/staff/wages")).toMatchObject({ id: 26 });
  });
  it("every save, change or delete is refused", async () => {
    expect(await req("POST", "/api/staff/wages", true, 27)).toBeNull();
    expect(await req("DELETE", "/api/staff/delivery-trips", true, 28)).toBeNull();
  });
  it("can still sign out and switch business", async () => {
    expect(await req("POST", "/api/auth/logout", true, 29)).not.toBeNull();
    expect(await req("POST", "/api/auth/switch-business", true, 30)).not.toBeNull();
  });
  it("a full Super admin and ordinary staff are unaffected", async () => {
    viewOnly = false;
    expect(await req("POST", "/api/staff/wages", true, 31)).not.toBeNull();
    viewOnly = true;
    expect(await req("POST", "/api/staff/wages", false, 32)).not.toBeNull();
  });
});
