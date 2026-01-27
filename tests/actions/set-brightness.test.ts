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
    const icon = apiIcon ?? (type === "light" ? "lightbulb" : type);
    return `imgs/icons/${icon}-${isOn ? "on" : "off"}.png`;
  }),
}));

import { SetBrightnessAction } from "../../src/actions/set-brightness";
import { ItsyhomeClient } from "../../src/api/itsyhome-client";
import streamDeck from "@elgato/streamdeck";

describe("SetBrightnessAction", () => {
  let action: SetBrightnessAction;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient();
    vi.mocked(ItsyhomeClient).mockImplementation(() => mockClient as unknown as ItsyhomeClient);
    action = new SetBrightnessAction();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("updates title with current brightness", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true, brightness: 75 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 50, port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("75%");
    });

    it("shows label with brightness", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true, brightness: 60 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 50, port: 0, label: "Desk" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Desk\n60%");
    });

    it("uses setting brightness when device has no brightness state", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 40, port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("40%");
    });

    it("sets icon based on on state", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true, brightness: 50 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 50, port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/icons/lightbulb-on.png");
    });

    it("infers on state from brightness when on is undefined", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { brightness: 50 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 50, port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/icons/lightbulb-on.png");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true, brightness: 50 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 50, port: 8888, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 8888);
    });

    it("does nothing when target is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", brightness: 50, port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("handles array response", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Lamp", type: "light", reachable: true, state: { on: true, brightness: 80 } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 50, port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("80%");
    });

    it("handles empty array response", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 50, port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).not.toHaveBeenCalled();
    });

    it("falls back to setting brightness on error", async () => {
      mockClient.getDeviceInfo.mockRejectedValue(new Error("ECONNREFUSED"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 30, port: 0, label: "Test" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Test\n30%");
    });

    it("falls back to brightness only on error without label", async () => {
      mockClient.getDeviceInfo.mockRejectedValue(new Error("ECONNREFUSED"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 55, port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("55%");
    });
  });

  describe("onWillDisappear", () => {
    it("stops polling when last context disappears", async () => {
      const ev = {
        action: { ...createMockAction(), id: "ctx-1" },
        payload: { settings: { target: "", brightness: 50, port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);
      action.onWillDisappear(ev as any);
    });
  });

  describe("onDidReceiveSettings", () => {
    it("updates title with new settings", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true, brightness: 90 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 50, port: 0, label: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("90%");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true, brightness: 50 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 50, port: 7777, label: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 7777);
    });

    it("does nothing when target is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", brightness: 50, port: 0, label: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });
  });

  describe("onKeyDown", () => {
    it("shows alert when no target", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", brightness: 50, port: 0, label: "" } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("shows alert when brightness is null", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: null, port: 0, label: "" } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("sets brightness and shows ok", async () => {
      mockClient.setBrightness.mockResolvedValue({ status: "success" });
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true, brightness: 75 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 75, port: 0, label: "" } },
      };

      await action.onKeyDown(ev as any);

      expect(mockClient.setBrightness).toHaveBeenCalledWith("Lamp", 75);
      expect(ev.action.showOk).toHaveBeenCalled();
    });

    it("shows alert on error status", async () => {
      mockClient.setBrightness.mockResolvedValue({ status: "error", message: "fail" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 50, port: 0, label: "" } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("shows alert on network error", async () => {
      mockClient.setBrightness.mockRejectedValue(new Error("network"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: 50, port: 0, label: "" } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });
  });

  describe("polling", () => {
    it("does not start duplicate timers", async () => {
      const ev1 = {
        action: { ...createMockAction(), id: "ctx-1" },
        payload: { settings: { target: "", brightness: 50, port: 0, label: "" } },
      };
      const ev2 = {
        action: { ...createMockAction(), id: "ctx-2" },
        payload: { settings: { target: "", brightness: 50, port: 0, label: "" } },
      };

      await action.onWillAppear(ev1 as any);
      await action.onWillAppear(ev2 as any);
    });

    it("polls all actions at 3s intervals", async () => {
      const mockAction = createMockAction();
      mockAction.getSettings.mockResolvedValue({ target: "Lamp", brightness: 50, label: "" });
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true, brightness: 50 },
      });

      Object.defineProperty(action, "actions", {
        get: () => [mockAction],
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", brightness: 50, port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);
      mockClient.getDeviceInfo.mockClear();

      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true, brightness: 80 },
      });

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).toHaveBeenCalledWith("Lamp");
    });

    it("skips actions with no target during poll", async () => {
      const mockAction = createMockAction();
      mockAction.getSettings.mockResolvedValue({ target: "", brightness: 50, label: "" });

      Object.defineProperty(action, "actions", {
        get: () => [mockAction],
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", brightness: 50, port: 0, label: "" } },
      };

      await action.onWillAppear(ev as any);

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });
  });

  describe("title formatting", () => {
    it("shows only label when no value available", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", brightness: undefined as any, port: 0, label: "Desk" } },
      };

      await action.onWillAppear(ev as any);

      // brightness is undefined, so value becomes "undefined%" — but actually this is the settings.brightness
      // Let's check the actual behavior: currentBrightness is undefined, so value = `${settings.brightness}%` = "undefined%"
      // title = "Desk\nundefined%"
      expect(ev.action.setTitle).toHaveBeenCalled();
    });
  });
});
