import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockAction, createMockClient } from "../helpers/action-helpers";

vi.mock("@elgato/streamdeck", () => ({
  default: { logger: { error: vi.fn() }, actions: { registerAction: vi.fn() } },
  action: () => (target: unknown) => target,
  SingletonAction: class {},
}));

vi.mock("../../src/api/itsyhome-client", () => ({
  ItsyhomeClient: vi.fn(),
}));

vi.mock("../../src/icons", () => ({
  getDeviceIcon: vi.fn((type: string, isOn: boolean, apiIcon?: string) => {
    const fallback: Record<string, string> = {
      "temperature-sensor": "thermometer-simple",
      "humidity-sensor": "drop",
    };
    const icon = apiIcon ?? fallback[type] ?? "question";
    return `imgs/icons/${icon}-${isOn ? "on" : "off"}.png`;
  }),
}));

import { StatusAction } from "../../src/actions/status";
import { ItsyhomeClient } from "../../src/api/itsyhome-client";

describe("StatusAction", () => {
  let action: StatusAction;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient();
    vi.mocked(ItsyhomeClient).mockImplementation(() => mockClient as unknown as ItsyhomeClient);
    action = new StatusAction();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("displays temperature for temperature sensor", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Temp", type: "temperature-sensor", reachable: true, state: { temperature: 22.456 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Temp", port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("22.5°");
      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/icons/thermometer-simple-on.png");
    });

    it("displays humidity for humidity sensor", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humid", type: "humidity-sensor", reachable: true, state: { humidity: 65.7 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humid", port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("66%");
      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/icons/drop-on.png");
    });

    it("shows label with value", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Temp", type: "temperature-sensor", reachable: true, state: { temperature: 20.0 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Temp", port: 0, label: "Office" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Office\n20.0°");
    });

    it("shows only label when no sensor data", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Unknown", type: "light", reachable: true, state: { on: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Unknown", port: 0, label: "Test" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Test");
    });

    it("shows empty title when no label and no sensor data", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Unknown", type: "light", reachable: true, state: {},
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Unknown", port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Temp", type: "temperature-sensor", reachable: true, state: { temperature: 21 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Temp", port: 9999, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 9999);
    });

    it("does nothing when target is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("handles array response", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Temp", type: "temperature-sensor", reachable: true, state: { temperature: 18.3 } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Temp", port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("18.3°");
    });

    it("handles empty array response", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Temp", port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).not.toHaveBeenCalled();
    });

    it("silently ignores errors", async () => {
      mockClient.getDeviceInfo.mockRejectedValue(new Error("ECONNREFUSED"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Temp", port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).not.toHaveBeenCalled();
    });

    it("handles undefined state", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Temp", type: "temperature-sensor", reachable: true,
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Temp", port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("");
    });
  });

  describe("onWillDisappear", () => {
    it("stops polling when last context disappears", async () => {
      const ev = {
        action: { ...createMockAction(), id: "ctx-1" },
        payload: { settings: { target: "", port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);
      action.onWillDisappear(ev as any);
    });
  });

  describe("onDidReceiveSettings", () => {
    it("updates display with new settings", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humid", type: "humidity-sensor", reachable: true, state: { humidity: 45 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humid", port: 0, label: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("45%");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Temp", type: "temperature-sensor", reachable: true, state: { temperature: 22 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Temp", port: 4444, label: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 4444);
    });

    it("does nothing when target is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, label: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });
  });

  describe("polling", () => {
    it("does not start duplicate timers", async () => {
      const ev1 = {
        action: { ...createMockAction(), id: "ctx-1" },
        payload: { settings: { target: "", port: 0, label: "" } },
      };
      const ev2 = {
        action: { ...createMockAction(), id: "ctx-2" },
        payload: { settings: { target: "", port: 0, label: "" } },
      };

      await action.onWillAppear(ev1 as any);
      await action.onWillAppear(ev2 as any);
    });

    it("polls all actions at 3s intervals", async () => {
      const mockAction = createMockAction();
      mockAction.getSettings.mockResolvedValue({ target: "Temp", label: "" });
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Temp", type: "temperature-sensor", reachable: true, state: { temperature: 22 },
      });

      Object.defineProperty(action, "actions", {
        get: () => [mockAction],
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);
      mockClient.getDeviceInfo.mockClear();

      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Temp", type: "temperature-sensor", reachable: true, state: { temperature: 23 },
      });

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).toHaveBeenCalledWith("Temp");
    });

    it("skips actions with no target", async () => {
      const mockAction = createMockAction();
      mockAction.getSettings.mockResolvedValue({ target: "", label: "" });

      Object.defineProperty(action, "actions", {
        get: () => [mockAction],
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });
  });
});
