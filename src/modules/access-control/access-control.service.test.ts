import { describe, expect, it } from "vitest";
import { evaluateAppAccess } from "./access-control.service";

const verifiedUser = {
  id: "user-1",
  email: "person@example.com",
  email_confirmed_at: "2026-06-09T00:00:00.000Z"
};

describe("evaluateAppAccess", () => {
  it("allows a verified member from an exact allowed domain", async () => {
    const result = await evaluateAppAccess(
      createSupabaseAccessStub({
        access: { role: "member", disabled_at: null },
        domains: ["example.com"]
      }),
      verifiedUser as never
    );

    expect(result).toEqual({ allowed: true, role: "member" });
  });

  it("rejects members outside the exact allowlist", async () => {
    const result = await evaluateAppAccess(
      createSupabaseAccessStub({
        access: { role: "member", disabled_at: null },
        domains: ["other.com"]
      }),
      verifiedUser as never
    );

    expect(result).toMatchObject({ allowed: false, reason: "domain_not_allowed" });
  });

  it("lets owner bypass the domain allowlist", async () => {
    const result = await evaluateAppAccess(
      createSupabaseAccessStub({
        access: { role: "owner", disabled_at: null },
        domains: []
      }),
      verifiedUser as never
    );

    expect(result).toEqual({ allowed: true, role: "owner" });
  });

  it("blocks disabled users even when their domain is allowed", async () => {
    const result = await evaluateAppAccess(
      createSupabaseAccessStub({
        access: { role: "member", disabled_at: "2026-06-09T00:00:00.000Z" },
        domains: ["example.com"]
      }),
      verifiedUser as never
    );

    expect(result).toMatchObject({ allowed: false, reason: "disabled" });
  });
});

function createSupabaseAccessStub({
  access,
  domains
}: {
  access: { role: string; disabled_at: string | null } | null;
  domains: string[];
}) {
  return {
    from(table: string) {
      if (table === "user_access") {
        return createMaybeSingleBuilder(access);
      }

      if (table === "allowed_email_domains") {
        return createThenableBuilder(domains.map((domain) => ({ domain })));
      }

      throw new Error(`Unexpected table ${table}`);
    }
  } as never;
}

function createMaybeSingleBuilder(data: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data, error: null }),
    insert: async () => ({ error: null })
  };

  return builder;
}

function createThenableBuilder(data: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    then: (resolve: (value: unknown) => void) => resolve({ data, error: null })
  };

  return builder;
}
