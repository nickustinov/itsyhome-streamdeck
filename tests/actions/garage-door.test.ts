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

import { GarageDoorAction } from "../../src/actions/garage-door";
import { ItsyhomeClient } from "../../src/api/itsyhome-client";
import streamDeck from "@elgato/streamdeck";

describe("GarageDoorAction", () => {
  let action: GarageDoorAction;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient();
    vi.mocked(ItsyhomeClient).mockImplementation(() => mockClient as unknown as ItsyhomeClient);
    action = new GarageDoorAction();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("shows closed state initially and updates from server", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "open" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      // First call is the initial "closed" state
      expect(ev.action.setImage).toHaveBeenNthCalledWith(1, "imgs/device-types/garage-door-off.png");
      // Second call is the server response "open"
      expect(ev.action.setImage).toHaveBeenNthCalledWith(2, "imgs/device-types/garage-door-on.png");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "closed" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Garage", port: 4444, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 4444);
    });

    it("shows closed state when no target", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/device-types/garage-door-off.png");
      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("uses custom iconStyle", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "closed" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Garage", port: 0, iconStyle: "car" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenNthCalledWith(1, "imgs/device-types/car-off.png");
    });

    it("treats opening as open", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "opening" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenNthCalledWith(2, "imgs/device-types/garage-door-on.png");
      expect(ev.action.setState).toHaveBeenLastCalledWith(1);
    });

    it("treats closing as closed", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "closing" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenNthCalledWith(2, "imgs/device-types/garage-door-off.png");
      expect(ev.action.setState).toHaveBeenLastCalledWith(0);
    });

    it("defaults doorState to closed", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: {},
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenLastCalledWith(0);
    });

    it("handles array response", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Garage", type: "garage-door", reachable: true, state: { doorState: "open" } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenLastCalledWith(1);
    });

    it("handles empty array", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      // Only the initial "closed" state visual should be set
      expect(ev.action.setImage).toHaveBeenCalledTimes(1);
    });

    it("silently ignores errors", async () => {
      mockClient.getDeviceInfo.mockRejectedValue(new Error("ECONNREFUSED"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      // Only the initial "closed" state visual should be set
      expect(ev.action.setImage).toHaveBeenCalledTimes(1);
    });
  });

  describe("onWillDisappear", () => {
    it("stops polling when last context disappears", async () => {
      const ev = {
        action: { ...createMockAction(), id: "ctx-1" },
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);
      action.onWillDisappear(ev as any);
    });
  });

  describe("onDidReceiveSettings", () => {
    it("updates state with new settings", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "open" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(1);
    });

    it("shows closed when no target", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/device-types/garage-door-off.png");
      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "closed" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Garage", port: 3333, iconStyle: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 3333);
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

    it("toggles from closed to open with optimistic update", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "closed" },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setImage.mockClear();
      mockAction.setState.mockClear();

      mockClient.toggle.mockResolvedValue({ status: "success" });
      vi.spyOn(Date, "now").mockReturnValue(1000);

      await action.onKeyDown(ev as any);

      expect(mockAction.setImage).toHaveBeenCalledWith("imgs/device-types/garage-door-on.png");
      expect(mockAction.setState).toHaveBeenCalledWith(1);
    });

    it("toggles from open to closed", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "open" },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setImage.mockClear();
      mockAction.setState.mockClear();

      mockClient.toggle.mockResolvedValue({ status: "success" });
      vi.spyOn(Date, "now").mockReturnValue(1000);

      await action.onKeyDown(ev as any);

      expect(mockAction.setImage).toHaveBeenCalledWith("imgs/device-types/garage-door-off.png");
      expect(mockAction.setState).toHaveBeenCalledWith(0);
    });

    it("toggles from closing to open", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "closing" },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setImage.mockClear();
      mockAction.setState.mockClear();

      mockClient.toggle.mockResolvedValue({ status: "success" });
      vi.spyOn(Date, "now").mockReturnValue(1000);

      await action.onKeyDown(ev as any);

      // closing is treated as closed/closing → should toggle to open
      expect(mockAction.setImage).toHaveBeenCalledWith("imgs/device-types/garage-door-on.png");
      expect(mockAction.setState).toHaveBeenCalledWith(1);
    });

    it("defaults to closed when no cache entry", async () => {
      mockClient.toggle.mockResolvedValue({ status: "success" });
      vi.spyOn(Date, "now").mockReturnValue(1000);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "NewGarage", port: 0, iconStyle: "" } },
      };

      await action.onKeyDown(ev as any);

      // default "closed" → opens
      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/device-types/garage-door-on.png");
      expect(ev.action.setState).toHaveBeenCalledWith(1);
    });

    it("holds optimistic state for 30s", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "closed" },
      });

      const mockAction = { ...createMockAction(), id: "ctx-1" };
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      mockClient.toggle.mockResolvedValue({ status: "success" });
      vi.spyOn(Date, "now").mockReturnValue(5000);

      await action.onKeyDown(ev as any);

      // Simulate poll within the 30s hold
      const pollAction = {
        ...createMockAction(),
        setState: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ target: "Garage", iconStyle: "" }),
      };
      Object.defineProperty(action, "actions", {
        get: () => [pollAction],
        configurable: true,
      });

      vi.spyOn(Date, "now").mockReturnValue(10000); // Still within 30s

      mockClient.getDeviceInfo.mockClear();
      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("allows poll after 30s hold expires", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "closed" },
      });

      const mockAction = { ...createMockAction(), id: "ctx-1" };
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      mockClient.toggle.mockResolvedValue({ status: "success" });
      vi.spyOn(Date, "now").mockReturnValue(1000);

      await action.onKeyDown(ev as any);

      const pollAction = {
        ...createMockAction(),
        setState: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ target: "Garage", iconStyle: "" }),
      };
      Object.defineProperty(action, "actions", {
        get: () => [pollAction],
        configurable: true,
      });

      vi.spyOn(Date, "now").mockReturnValue(32000);

      mockClient.getDeviceInfo.mockClear();
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "open" },
      });

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).toHaveBeenCalledWith("Garage");
    });

    it("shows alert on toggle error status", async () => {
      mockClient.toggle.mockResolvedValue({ status: "error", message: "fail" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("shows alert on network error", async () => {
      mockClient.toggle.mockRejectedValue(new Error("network"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Garage", port: 0, iconStyle: "" } },
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
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };
      const ev2 = {
        action: { ...createMockAction(), id: "ctx-2" },
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev1 as any);
      await action.onWillAppear(ev2 as any);
    });

    it("polls all actions at 3s intervals", async () => {
      const pollAction = {
        ...createMockAction(),
        setState: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ target: "Garage", iconStyle: "" }),
      };
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "closed" },
      });

      Object.defineProperty(action, "actions", {
        get: () => [pollAction],
        configurable: true,
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);
      mockClient.getDeviceInfo.mockClear();

      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Garage", type: "garage-door", reachable: true, state: { doorState: "open" },
      });

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).toHaveBeenCalledWith("Garage");
    });

    it("skips actions without setState", async () => {
      const pollAction = { getSettings: vi.fn().mockResolvedValue({ target: "Garage" }) };
      Object.defineProperty(action, "actions", {
        get: () => [pollAction],
        configurable: true,
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, iconStyle: "" } },
      };

      await action.onWillAppear(ev as any);

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("skips actions with no target", async () => {
      const pollAction = {
        ...createMockAction(),
        setState: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ target: "", iconStyle: "" }),
      };
      Object.defineProperty(action, "actions", {
        get: () => [pollAction],
        configurable: true,
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
});
