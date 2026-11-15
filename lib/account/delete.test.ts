import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { deleteAccount } from "./delete";

type M = { org_id: string; user_id: string; role: string };

function fakeAdmin(members: M[], orgs: { id: string; is_personal: boolean }[]) {
  const deletedOrgs: string[] = [];
  const deletedUsers: string[] = [];
  const q = (rows: Record<string, unknown>[]) => {
    let r = rows;
    let head = false;
    const c: Record<string, unknown> = {
      select: (_s: string, o?: { head?: boolean }) => ((head = !!o?.head), c),
      eq: (k: string, v: unknown) => ((r = r.filter((x) => x[k] === v)), c),
      neq: (k: string, v: unknown) => ((r = r.filter((x) => x[k] !== v)), c),
      in: (k: string, v: unknown[]) => ((r = r.filter((x) => v.includes(x[k]))), c),
      then: (res: (v: unknown) => unknown) => res(head ? { count: r.length, error: null } : { data: r, error: null }),
    };
    return c;
  };
  const admin = {
    from(table: string) {
      if (table === "memberships") return q(members as unknown as Record<string, unknown>[]);
      if (table === "organizations")
        return Object.assign(q(orgs as unknown as Record<string, unknown>[]), {
          delete: () => ({ in: async (_k: string, ids: string[]) => (deletedOrgs.push(...ids), { error: null }) }),
        });
      throw new Error(table);
    },
    auth: { admin: { deleteUser: async (id: string) => (deletedUsers.push(id), { error: null }) } },
  };
  return { admin: admin as never, deletedOrgs, deletedUsers };
}

describe("deleteAccount", () => {
  it("does nothing unless the typed email matches", async () => {
    const f = fakeAdmin([{ org_id: "o1", user_id: "u1", role: "member" }], [{ id: "o1", is_personal: true }]);
    expect(await deleteAccount(f.admin, "u1", "a@b.it", "x@b.it")).toEqual({ ok: false, reason: "confirm_mismatch" });
    expect(f.deletedUsers).toEqual([]);
  });

  it("refuses the last admin before deleting anything", async () => {
    const f = fakeAdmin([{ org_id: "o1", user_id: "u1", role: "admin" }], [{ id: "o1", is_personal: true }]);
    expect(await deleteAccount(f.admin, "u1", "a@b.it", " A@B.it ")).toEqual({ ok: false, reason: "last_admin" });
    expect(f.deletedOrgs).toEqual([]);
    expect(f.deletedUsers).toEqual([]);
  });

  it("deletes the personal organisation it alone belongs to, keeps shared ones, then the user", async () => {
    const f = fakeAdmin(
      [
        { org_id: "personal", user_id: "u1", role: "member" },
        { org_id: "shared", user_id: "u1", role: "member" },
        { org_id: "shared", user_id: "u2", role: "admin" },
        { org_id: "other-personal", user_id: "u2", role: "admin" },
      ],
      [
        { id: "personal", is_personal: true },
        { id: "shared", is_personal: false },
        { id: "other-personal", is_personal: true },
      ],
    );
    expect(await deleteAccount(f.admin, "u1", "a@b.it", "a@b.it")).toEqual({ ok: true });
    expect(f.deletedOrgs).toEqual(["personal"]);
    expect(f.deletedUsers).toEqual(["u1"]);
  });

  it("lets an admin go when another admin remains", async () => {
    const f = fakeAdmin(
      [
        { org_id: "o1", user_id: "u1", role: "admin" },
        { org_id: "o2", user_id: "u2", role: "admin" },
      ],
      [{ id: "o1", is_personal: true }, { id: "o2", is_personal: true }],
    );
    expect((await deleteAccount(f.admin, "u1", "a@b.it", "a@b.it")).ok).toBe(true);
  });
});
