// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { EarlyAccessCapture } from "../EarlyAccessCapture";

function mockFetch(response: { status: number; body?: unknown }) {
  const fn = vi.fn(async () =>
    new Response(JSON.stringify(response.body ?? {}), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EarlyAccessCapture", () => {
  it("submits a valid email, posts to /api/early-access with the right source, and shows the success state", async () => {
    const fetchMock = mockFetch({ status: 200, body: { ok: true } });
    const user = userEvent.setup();

    render(<EarlyAccessCapture source="hero_cta" />);

    await user.type(
      screen.getByPlaceholderText("you@domain.com"),
      "founder@aforce.test",
    );
    await user.click(screen.getByRole("button", { name: /request access/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/you're on the list/i);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/early-access");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "founder@aforce.test",
      source: "hero_cta",
    });
  });

  it("shows the inline error state when the API returns 400", async () => {
    mockFetch({ status: 400, body: { error: "invalid_input" } });
    const user = userEvent.setup();

    render(<EarlyAccessCapture />);
    await user.type(
      screen.getByPlaceholderText("you@domain.com"),
      "ok@aforce.test",
    );
    await user.click(screen.getByRole("button", { name: /request access/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/enter a valid email/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the inline error state when the API returns 429", async () => {
    mockFetch({ status: 429, body: { error: "rate_limited" } });
    const user = userEvent.setup();

    render(<EarlyAccessCapture />);
    await user.type(
      screen.getByPlaceholderText("you@domain.com"),
      "ok@aforce.test",
    );
    await user.click(screen.getByRole("button", { name: /request access/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/too many attempts/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
