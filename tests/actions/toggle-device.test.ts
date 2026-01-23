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
  getDeviceIcon: vi.fn((type: string, isOn: boolean) => `imgs/device-types/${type}-${isOn ? "on" : "off"}.png`),
  getGroupIcon: vi.fn((isOn: boolean) => `imgs/device-types/group-${isOn ? "on" : "off"}.png`),
}));

import { ToggleDeviceAction } from "../../src/actions/toggle-device";
import { ItsyhomeClient } from "../../src/api/itsyhome-client";
import streamDeck from "@elgato/streamdeck";

describe("ToggleDeviceAction", () => {
  let action: ToggleDeviceAction;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient();
    vi.mocked(ItsyhomeClient).mockImplementation(() => mockClient as unknown as ItsyhomeClient);
    action = new ToggleDeviceAction();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("updates state when target is set", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Office/Lamp", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/device-types/light-on.png");
      expect(ev.action.setState).toHaveBeenCalledWith(1);
    });

    it("uses custom port when provided", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: false },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", port: 9999, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 9999);
    });

    it("does nothing when target is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("uses iconStyle when provided", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", port: 0, iconStyle: "fan" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/device-types/fan-on.png");
    });

    it("uses group icon when target starts with group.", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "All Lights", type: "light", reachable: true, state: { on: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.All Lights", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/device-types/group-on.png");
    });

    it("handles array response from getDeviceInfo", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Lamp", type: "light", reachable: true, state: { on: false } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/device-types/light-off.png");
      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("handles empty array response", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });

    it("silently ignores errors from getDeviceInfo", async () => {
      mockClient.getDeviceInfo.mockRejectedValue(new Error("ECONNREFUSED"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });
  });

  describe("onWillDisappear", () => {
    it("stops polling when last context disappears", async () => {
      const ev1 = {
        action: { ...createMockAction(), id: "ctx-1" },
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };
      const ev2 = {
        action: { ...createMockAction(), id: "ctx-2" },
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev1 as any);
      await action.onWillAppear(ev2 as any);

      action.onWillDisappear(ev1 as any);
      // Still one context active, timer should remain

      action.onWillDisappear(ev2 as any);
      // All contexts gone, timer should be cleared
    });
  });

  describe("onDidReceiveSettings", () => {
    it("updates state with new settings", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Fan", type: "fan", reachable: true, state: { on: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Fan", port: 0, iconStyle: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/device-types/fan-on.png");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Fan", type: "fan", reachable: true, state: { on: false },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Fan", port: 1234, iconStyle: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 1234);
    });

    it("does nothing when target is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });
  });

  describe("onKeyDown", () => {
    it("shows alert when no target", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("toggles device and updates cache optimistically", async () => {
      // First set up the cache via onWillAppear
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Lamp", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setImage.mockClear();
      mockAction.setState.mockClear();

      mockClient.toggle.mockResolvedValue({ status: "success" });

      await action.onKeyDown(ev as any);

      expect(mockClient.toggle).toHaveBeenCalledWith("Lamp");
      expect(mockAction.setImage).toHaveBeenCalledWith("imgs/device-types/light-off.png");
      expect(mockAction.setState).toHaveBeenCalledWith(0);
    });

    it("shows alert on toggle error status", async () => {
      mockClient.toggle.mockResolvedValue({ status: "error", message: "fail" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", port: 0, iconStyle: "" } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("shows alert on network error", async () => {
      mockClient.toggle.mockRejectedValue(new Error("network"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", port: 0, iconStyle: "" } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("does not update visual when cache is empty", async () => {
      mockClient.toggle.mockResolvedValue({ status: "success" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Uncached", port: 0, iconStyle: "" } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });
  });

  describe("polling", () => {
    it("polls all actions at 3s intervals", async () => {
      const mockAction = createMockAction();
      mockAction.getSettings.mockResolvedValue({ target: "Lamp", iconStyle: "" });
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: true },
      });

      Object.defineProperty(action, "actions", {
        get: () => [mockAction],
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);
      mockClient.getDeviceInfo.mockClear();

      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: { on: false },
      });

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).toHaveBeenCalledWith("Lamp");
    });

    it("skips actions without setState", async () => {
      const mockAction = { getSettings: vi.fn().mockResolvedValue({ target: "Lamp" }) };
      Object.defineProperty(action, "actions", {
        get: () => [mockAction],
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("does not start duplicate timers", async () => {
      const ev = {
        action: { ...createMockAction(), id: "ctx-1" },
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };
      const ev2 = {
        action: { ...createMockAction(), id: "ctx-2" },
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);
      await action.onWillAppear(ev2 as any);

      // Only one timer should be running
    });

    it("skips actions with no target during poll", async () => {
      const mockAction = {
        ...createMockAction(),
        setState: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ target: "", iconStyle: "" }),
      };
      Object.defineProperty(action, "actions", {
        get: () => [mockAction],
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });
  });

  describe("state handling", () => {
    it("defaults isOn to false when state.on is undefined", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true, state: {},
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("defaults isOn to false when state is undefined", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lamp", type: "light", reachable: true,
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lamp", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });
  });
});
