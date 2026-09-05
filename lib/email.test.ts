import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendPasswordResetEmail } from "@/lib/email";

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

describe("sendPasswordResetEmail without credentials", () => {
  it("logs the link instead of sending, outside production", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await sendPasswordResetEmail("ada@example.com", RESET_URL, 3600);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining(RESET_URL),
    );
  });

  it("refuses outright in production rather than logging a live token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      sendPasswordResetEmail("ada@example.com", RESET_URL, 3600),
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

    await sendPasswordResetEmail("ada@example.com", RESET_URL, 3600);

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

    await sendPasswordResetEmail("ada@example.com", urlWithAmp, 3600);

    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body as string);
    // The plain-text part carries the URL verbatim...
    expect(body.text).toContain(urlWithAmp);
    // ...while the HTML part has it entity-encoded, in the href and the
    // fallback line both, and never raw.
    expect(body.html).toContain('href="https://app.example.com/reset-password?token=abc&amp;x=1"');
    expect(body.html).not.toContain("token=abc&x=1");
  });

  it("takes the link lifetime from its caller rather than restating it", async () => {
    const fetchSpy = mockFetch(new Response("{}", { status: 200 }));

    await sendPasswordResetEmail("ada@example.com", RESET_URL, 15 * 60);

    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body as string);
    // Hardcoded here, the copy would keep promising 60 minutes the day someone
    // shortens RESET_TOKEN_TTL_SECONDS.
    expect(body.text).toContain("15 minutes");
    expect(body.html).toContain("15 minutes");
  });

  it("surfaces the provider's reason when it rejects the message", async () => {
    mockFetch(
      new Response('{"message":"domain is not verified"}', { status: 403 }),
    );

    await expect(
      sendPasswordResetEmail("ada@example.com", RESET_URL, 3600),
    ).rejects.toThrow(/403[\s\S]*domain is not verified/);
  });
});
