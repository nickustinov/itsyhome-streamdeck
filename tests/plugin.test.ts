import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@elgato/streamdeck", () => {
  const actions = { registerAction: vi.fn() };
  const connect = vi.fn();
  return {
    default: { actions, connect, logger: { error: vi.fn() } },
    action: () => (target: unknown) => target,
    SingletonAction: class {},
    WillAppearEvent: class {},
    WillDisappearEvent: class {},
    KeyDownEvent: class {},
    DidReceiveSettingsEvent: class {},
  };
});

vi.mock("../src/api/itsyhome-client", () => ({
  ItsyhomeClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("../src/icons", () => ({
  getDeviceIcon: vi.fn(),
  getThermostatIcon: vi.fn(),
  getGroupIcon: vi.fn(),
}));

describe("plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers all 8 actions and calls connect", async () => {
    const streamDeck = await import("@elgato/streamdeck");
    await import("../src/plugin");

    expect(streamDeck.default.actions.registerAction).toHaveBeenCalledTimes(8);
    expect(streamDeck.default.connect).toHaveBeenCalledTimes(1);
  });
});
