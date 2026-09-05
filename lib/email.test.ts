import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isEmailConfigured, sendPasswordResetEmail } from "@/lib/email";

const RESET_URL = "https://app.example.com/reset-password?token=abc-123";

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isEmailConfigured", () => {
  it("needs both the key and the from address", () => {
    vi.stubEnv("RESEND_API_KEY", "re_123");
    expect(isEmailConfigured()).toBe(false);

    vi.stubEnv("EMAIL_FROM", "Slipway <hi@example.com>");
    expect(isEmailConfigured()).toBe(true);
  });
});

describe("sendPasswordResetEmail without credentials", () => {
  it("logs the link instead of sending, outside production", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await sendPasswordResetEmail("ada@example.com", RESET_URL);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining(RESET_URL),
    );
  });

  it("refuses outright in production rather than logging a live token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      sendPasswordResetEmail("ada@example.com", RESET_URL),
    ).rejects.toThrow(/RESEND_API_KEY/);

    expect(console.info).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("sendPasswordResetEmail with credentials", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_123");
    vi.stubEnv("EMAIL_FROM", "Slipway <hi@example.com>");
  });

  function mockFetch(response: Response) {
    return vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(response) as unknown as ReturnType<typeof vi.fn>;
  }

  it("posts the message to Resend as the configured sender", async () => {
    const fetchSpy = mockFetch(new Response("{}", { status: 200 }));

    await sendPasswordResetEmail("ada@example.com", RESET_URL);

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_123");

    const body = JSON.parse(init.body as string);
    expect(body.from).toBe("Slipway <hi@example.com>");
    expect(body.to).toEqual(["ada@example.com"]);
    expect(body.subject).toContain("Slipway");
    expect(body.text).toContain(RESET_URL);
  });

  it("escapes the link before putting it in the HTML body", async () => {
    const fetchSpy = mockFetch(new Response("{}", { status: 200 }));
    const urlWithAmp = "https://app.example.com/reset-password?token=abc&x=1";

    await sendPasswordResetEmail("ada@example.com", urlWithAmp);

    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body as string);
    // The plain-text part carries the URL verbatim...
    expect(body.text).toContain(urlWithAmp);
    // ...while the HTML part has it entity-encoded, in the href and the
    // fallback line both, and never raw.
    expect(body.html).toContain('href="https://app.example.com/reset-password?token=abc&amp;x=1"');
    expect(body.html).not.toContain("token=abc&x=1");
  });

  it("surfaces the provider's reason when it rejects the message", async () => {
    mockFetch(
      new Response('{"message":"domain is not verified"}', { status: 403 }),
    );

    await expect(
      sendPasswordResetEmail("ada@example.com", RESET_URL),
    ).rejects.toThrow(/403[\s\S]*domain is not verified/);
  });
});
