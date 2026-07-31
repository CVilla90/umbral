import { afterEach, describe, expect, it } from "vitest";
import { devToolsEnabled } from "./dev";

/**
 * The gate on every dev-only route. These routes hand out a session without a
 * password (`/api/auth/dev`) and delete a student's answers (`/api/dev/rewind`),
 * so the cost of the gate being wrong on the deployed host is the instrument
 * itself. It is cheap to assert and it would fail silently otherwise — nothing
 * about a *working* dev login in development tells you it is closed in
 * production.
 */

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

function env(nodeEnv: string | undefined, devLogin: string | undefined) {
  // NODE_ENV is typed readonly by Next but is writable at runtime, and setting it
  // is the only way to exercise the production branch from a test.
  const vars = process.env as Record<string, string | undefined>;
  if (nodeEnv === undefined) delete vars.NODE_ENV;
  else vars.NODE_ENV = nodeEnv;
  if (devLogin === undefined) delete vars.DEV_LOGIN;
  else vars.DEV_LOGIN = devLogin;
}

describe("devToolsEnabled", () => {
  it("is open only in development WITH the flag set", () => {
    env("development", "1");
    expect(devToolsEnabled()).toBe(true);
  });

  it("is closed in production even when DEV_LOGIN is set", () => {
    // The realistic accident: `.env` gets copied to the host wholesale.
    env("production", "1");
    expect(devToolsEnabled()).toBe(false);
  });

  it("is closed in development when DEV_LOGIN is absent", () => {
    env("development", undefined);
    expect(devToolsEnabled()).toBe(false);
  });

  it("is closed when DEV_LOGIN is set to an empty string", () => {
    // `DEV_LOGIN=` in a .env file yields "" — truthy as a *set* variable to a
    // careless check, falsy as a value. It must read as closed.
    env("development", "");
    expect(devToolsEnabled()).toBe(false);
  });

  it("is closed in production with no flag at all — the deployed state", () => {
    env("production", undefined);
    expect(devToolsEnabled()).toBe(false);
  });
});
