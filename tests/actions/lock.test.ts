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
  getLockIcon: vi.fn((isLocked: boolean, apiIcon?: string) => `imgs/icons/${apiIcon ?? "lock"}-${isLocked ? "on" : "off"}.png`),
}));

import { LockAction } from "../../src/actions/lock";
import { ItsyhomeClient } from "../../src/api/itsyhome-client";
import streamDeck from "@elgato/streamdeck";

describe("LockAction", () => {
  let action: LockAction;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient();
    vi.mocked(ItsyhomeClient).mockImplementation(() => mockClient as unknown as ItsyhomeClient);
    action = new LockAction();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("updates state showing locked", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Front Door", type: "lock", reachable: true, state: { locked: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Front Door", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/icons/lock-on.png");
      expect(ev.action.setState).toHaveBeenCalledWith(1);
    });

    it("updates state showing unlocked", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Front Door", type: "lock", reachable: true, state: { locked: false },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Front Door", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/icons/lock-off.png");
      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("uses icon from API response", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Front Door", type: "lock", icon: "shield", reachable: true, state: { locked: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Front Door", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/icons/shield-on.png");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lock", type: "lock", reachable: true, state: { locked: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lock", port: 5555 } },
      };

      await action.onWillAppear(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 5555);
    });

    it("does nothing when target is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("defaults to locked when state.locked is undefined", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lock", type: "lock", reachable: true, state: {},
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lock", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(1);
    });

    it("handles array response", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Lock", type: "lock", reachable: true, state: { locked: false } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lock", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("handles empty array", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lock", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });

    it("silently ignores errors", async () => {
      mockClient.getDeviceInfo.mockRejectedValue(new Error("ECONNREFUSED"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lock", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });
  });

  describe("onWillDisappear", () => {
    it("stops polling when last context disappears", async () => {
      const ev = {
        action: { ...createMockAction(), id: "ctx-1" },
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      action.onWillDisappear(ev as any);
    });
  });

  describe("onDidReceiveSettings", () => {
    it("updates state with new settings", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lock", type: "lock", reachable: true, state: { locked: false },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lock", port: 0 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lock", type: "lock", reachable: true, state: { locked: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lock", port: 3333 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 3333);
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

    it("toggles lock with optimistic update to unlocked", async () => {
      // Set up cache as locked
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lock", type: "lock", reachable: true, state: { locked: true },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Lock", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setImage.mockClear();
      mockAction.setState.mockClear();

      mockClient.toggle.mockResolvedValue({ status: "success" });
      vi.spyOn(Date, "now").mockReturnValue(1000);

      await action.onKeyDown(ev as any);

      expect(mockClient.toggle).toHaveBeenCalledWith("Lock");
      expect(mockAction.setImage).toHaveBeenCalledWith("imgs/icons/lock-off.png");
      expect(mockAction.setState).toHaveBeenCalledWith(0);
    });

    it("holds optimistic state for 30s preventing poll override", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lock", type: "lock", reachable: true, state: { locked: true },
      });

      const mockAction = { ...createMockAction(), id: "ctx-1" };
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Lock", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      mockClient.toggle.mockResolvedValue({ status: "success" });
      vi.spyOn(Date, "now").mockReturnValue(5000);

      await action.onKeyDown(ev as any);

      // Now simulate a poll while within the 30s hold window
      const pollAction = {
        ...createMockAction(),
        setState: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ target: "Lock" }),
      };
      Object.defineProperty(action, "actions", {
        get: () => [pollAction],
        configurable: true,
      });

      vi.spyOn(Date, "now").mockReturnValue(10000); // 5s after key press, still within 30s

      mockClient.getDeviceInfo.mockClear();
      await vi.advanceTimersByTimeAsync(3000);

      // Should NOT have called getDeviceInfo because we're within the optimistic hold
      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("allows poll after 30s optimistic hold expires", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lock", type: "lock", reachable: true, state: { locked: true },
      });

      const mockAction = { ...createMockAction(), id: "ctx-1" };
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Lock", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      mockClient.toggle.mockResolvedValue({ status: "success" });
      vi.spyOn(Date, "now").mockReturnValue(1000);

      await action.onKeyDown(ev as any);

      // Simulate poll after 30s expiry
      const pollAction = {
        ...createMockAction(),
        setState: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ target: "Lock" }),
      };
      Object.defineProperty(action, "actions", {
        get: () => [pollAction],
        configurable: true,
      });

      vi.spyOn(Date, "now").mockReturnValue(32000); // Past 30s hold

      mockClient.getDeviceInfo.mockClear();
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lock", type: "lock", reachable: true, state: { locked: true },
      });

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).toHaveBeenCalledWith("Lock");
    });

    it("defaults wasLocked to true when cache is empty", async () => {
      mockClient.toggle.mockResolvedValue({ status: "success" });
      vi.spyOn(Date, "now").mockReturnValue(1000);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "NewLock", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      // wasLocked defaults to true, so nowLocked = false
      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/icons/lock-off.png");
      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("shows alert on toggle error status", async () => {
      mockClient.toggle.mockResolvedValue({ status: "error", message: "fail" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lock", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("shows alert on network error", async () => {
      mockClient.toggle.mockRejectedValue(new Error("network"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Lock", port: 0 } },
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
        payload: { settings: { target: "", port: 0 } },
      };
      const ev2 = {
        action: { ...createMockAction(), id: "ctx-2" },
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onWillAppear(ev1 as any);
      await action.onWillAppear(ev2 as any);
    });

    it("polls all actions at 3s intervals", async () => {
      const pollAction = {
        ...createMockAction(),
        setState: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ target: "Lock" }),
      };
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lock", type: "lock", reachable: true, state: { locked: true },
      });

      Object.defineProperty(action, "actions", {
        get: () => [pollAction],
        configurable: true,
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      mockClient.getDeviceInfo.mockClear();

      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Lock", type: "lock", reachable: true, state: { locked: false },
      });

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).toHaveBeenCalledWith("Lock");
    });

    it("skips actions without setState", async () => {
      const pollAction = { getSettings: vi.fn().mockResolvedValue({ target: "Lock" }) };
      Object.defineProperty(action, "actions", {
        get: () => [pollAction],
        configurable: true,
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("skips actions with no target", async () => {
      const pollAction = {
        ...createMockAction(),
        setState: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ target: "" }),
      };
      Object.defineProperty(action, "actions", {
        get: () => [pollAction],
        configurable: true,
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
});
