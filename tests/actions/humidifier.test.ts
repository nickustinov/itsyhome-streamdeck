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

vi.mock("../../src/icon-renderer", () => ({
  renderIcon: vi.fn((iconName: string, color: string, useFill: boolean, text?: string) => {
    const state = useFill ? "on" : "off";
    const textPart = text ? `-${text}` : "";
    return Promise.resolve(`data:image/png;base64,mock-${iconName}-${state}${textPart}`);
  }),
}));

import { HumidifierAction } from "../../src/actions/humidifier";
import { ItsyhomeClient } from "../../src/api/itsyhome-client";
import streamDeck from "@elgato/streamdeck";

describe("HumidifierAction", () => {
  let action: HumidifierAction;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient();
    vi.mocked(ItsyhomeClient).mockImplementation(() => mockClient as unknown as ItsyhomeClient);
    action = new HumidifierAction();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("updates state when target is set", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Bedroom/Humidifier", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-drop-on");
      expect(ev.action.setState).toHaveBeenCalledWith(1);
    });

    it("uses custom port when provided", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: false },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 9999 } },
      };

      await action.onWillAppear(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 9999);
    });

    it("does nothing when target is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("uses API icon when provided", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", icon: "drop-half", reachable: true, state: { on: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-drop-half-on");
    });

    it("handles array response from getDeviceInfo", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: false } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-drop-off");
      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("handles empty array response", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });

    it("silently ignores errors from getDeviceInfo", async () => {
      mockClient.getDeviceInfo.mockRejectedValue(new Error("ECONNREFUSED"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });

    it("displays humidity percentage in title", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: true, humidity: 45 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("45%");
    });

    it("displays humidity even when device is off", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: false, humidity: 60 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("60%");
    });

    it("clears title when no humidity and no label", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: false },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("");
    });

    it("shows label with humidity", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: true, humidity: 55 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0, label: "Bedroom" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Bedroom\n55%");
    });

    it("shows only label when no humidity data", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0, label: "Living Room" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Living Room");
    });
  });

  describe("onWillDisappear", () => {
    it("stops polling when last context disappears", async () => {
      const ev1 = {
        action: { ...createMockAction(), id: "ctx-1" },
        payload: { settings: { target: "", port: 0 } },
      };
      const ev2 = {
        action: { ...createMockAction(), id: "ctx-2" },
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onWillAppear(ev1 as any);
      await action.onWillAppear(ev2 as any);

      action.onWillDisappear(ev1 as any);
      action.onWillDisappear(ev2 as any);
    });
  });

  describe("onDidReceiveSettings", () => {
    it("updates state with new settings", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-drop-on");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: false },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 1234 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 1234);
    });

    it("does nothing when target is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });
  });

  describe("onKeyDown", () => {
    it("shows alert when no target", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("toggles humidifier and updates cache optimistically", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: true, humidity: 50 },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Humidifier", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setImage.mockClear();
      mockAction.setState.mockClear();

      mockClient.toggle.mockResolvedValue({ status: "success" });

      await action.onKeyDown(ev as any);

      expect(mockClient.toggle).toHaveBeenCalledWith("Humidifier");
      expect(mockAction.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-drop-off");
      expect(mockAction.setState).toHaveBeenCalledWith(0);
    });

    it("preserves humidity in title after toggle", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: false, humidity: 48 },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Humidifier", port: 0, label: "Bedroom" } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setTitle.mockClear();

      mockClient.toggle.mockResolvedValue({ status: "success" });

      await action.onKeyDown(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith("Bedroom\n48%");
    });

    it("shows alert on toggle error status", async () => {
      mockClient.toggle.mockResolvedValue({ status: "error", message: "fail" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("shows alert on network error", async () => {
      mockClient.toggle.mockRejectedValue(new Error("network"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("does not update visual when cache is empty", async () => {
      mockClient.toggle.mockResolvedValue({ status: "success" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Uncached", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });
  });

  describe("polling", () => {
    it("polls all actions at 3s intervals", async () => {
      const mockAction = createMockAction();
      mockAction.getSettings.mockResolvedValue({ target: "Humidifier" });
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: true },
      });

      Object.defineProperty(action, "actions", {
        get: () => [mockAction],
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      mockClient.getDeviceInfo.mockClear();

      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: { on: false },
      });

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).toHaveBeenCalledWith("Humidifier");
    });

    it("skips actions without setState", async () => {
      const mockAction = { getSettings: vi.fn().mockResolvedValue({ target: "Humidifier" }) };
      Object.defineProperty(action, "actions", {
        get: () => [mockAction],
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("does not start duplicate timers", async () => {
      const ev = {
        action: { ...createMockAction(), id: "ctx-1" },
        payload: { settings: { target: "", port: 0 } },
      };
      const ev2 = {
        action: { ...createMockAction(), id: "ctx-2" },
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      await action.onWillAppear(ev2 as any);
    });

    it("skips actions with no target during poll", async () => {
      const mockAction = {
        ...createMockAction(),
        setState: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ target: "" }),
      };
      Object.defineProperty(action, "actions", {
        get: () => [mockAction],
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });
  });

  describe("state handling", () => {
    it("defaults isOn to false when state.on is undefined", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true, state: {},
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("defaults isOn to false when state is undefined", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Humidifier", type: "humidifier-dehumidifier", reachable: true,
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Humidifier", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });
  });
});
