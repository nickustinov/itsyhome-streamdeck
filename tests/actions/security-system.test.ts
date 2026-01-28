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

import { SecuritySystemAction } from "../../src/actions/security-system";
import { ItsyhomeClient } from "../../src/api/itsyhome-client";
import streamDeck from "@elgato/streamdeck";

// Security states
const STAY_ARM = 0;
const AWAY_ARM = 1;
const NIGHT_ARM = 2;
const DISARMED = 3;
const ALARM_TRIGGERED = 4;

describe("SecuritySystemAction", () => {
  let action: SecuritySystemAction;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient();
    vi.mocked(ItsyhomeClient).mockImplementation(() => mockClient as unknown as ItsyhomeClient);
    action = new SecuritySystemAction();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("updates state when target is set", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: DISARMED },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Home/Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-shield-check-off");
      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("shows armed state with green color", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: AWAY_ARM },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-shield-check-on");
      expect(ev.action.setState).toHaveBeenCalledWith(1);
    });

    it("uses custom port when provided", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: DISARMED },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 9999 } },
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
        name: "Security", type: "security-system", icon: "shield", reachable: true, state: { securityState: STAY_ARM },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-shield-on");
    });

    it("handles array response from getDeviceInfo", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Security", type: "security-system", reachable: true, state: { securityState: DISARMED } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-shield-check-off");
      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("handles empty array response", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });

    it("silently ignores errors from getDeviceInfo", async () => {
      mockClient.getDeviceInfo.mockRejectedValue(new Error("ECONNREFUSED"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });

    it("displays 'Off' in title when disarmed", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: DISARMED },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Off");
    });

    it("displays 'Stay' in title when stay armed", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: STAY_ARM },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Stay");
    });

    it("displays 'Away' in title when away armed", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: AWAY_ARM },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Away");
    });

    it("displays 'Night' in title when night armed", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: NIGHT_ARM },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Night");
    });

    it("displays 'Alarm!' in title when alarm triggered", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: ALARM_TRIGGERED },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Alarm!");
    });

    it("shows label with state", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: AWAY_ARM },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0, label: "Home" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Home\nAway");
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
        name: "Security", type: "security-system", reachable: true, state: { securityState: STAY_ARM },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-shield-check-on");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: DISARMED },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 1234 } },
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

    it("arms to Away mode by default when disarmed", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: DISARMED },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setImage.mockClear();
      mockAction.setState.mockClear();

      mockClient.armSecurity.mockResolvedValue({ status: "success" });

      await action.onKeyDown(ev as any);

      expect(mockClient.armSecurity).toHaveBeenCalledWith("Security", AWAY_ARM);
      expect(mockAction.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-shield-check-on");
      expect(mockAction.setState).toHaveBeenCalledWith(1);
    });

    it("arms to configured mode when disarmed", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: DISARMED },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Security", port: 0, armMode: NIGHT_ARM } },
      };

      await action.onWillAppear(ev as any);
      mockClient.armSecurity.mockResolvedValue({ status: "success" });

      await action.onKeyDown(ev as any);

      expect(mockClient.armSecurity).toHaveBeenCalledWith("Security", NIGHT_ARM);
    });

    it("disarms when currently armed", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: AWAY_ARM },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setImage.mockClear();
      mockAction.setState.mockClear();

      mockClient.disarmSecurity.mockResolvedValue({ status: "success" });

      await action.onKeyDown(ev as any);

      expect(mockClient.disarmSecurity).toHaveBeenCalledWith("Security");
      expect(mockAction.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-shield-check-off");
      expect(mockAction.setState).toHaveBeenCalledWith(0);
    });

    it("disarms when alarm is triggered", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: ALARM_TRIGGERED },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      mockClient.disarmSecurity.mockResolvedValue({ status: "success" });

      await action.onKeyDown(ev as any);

      expect(mockClient.disarmSecurity).toHaveBeenCalledWith("Security");
    });

    it("updates title after toggle", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: DISARMED },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Security", port: 0, label: "Home", armMode: STAY_ARM } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setTitle.mockClear();

      mockClient.armSecurity.mockResolvedValue({ status: "success" });

      await action.onKeyDown(ev as any);

      expect(mockAction.setTitle).toHaveBeenCalledWith("Home\nStay");
    });

    it("shows alert on arm error status", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: DISARMED },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      mockClient.armSecurity.mockResolvedValue({ status: "error", message: "fail" });

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("shows alert on network error", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: DISARMED },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      mockClient.armSecurity.mockRejectedValue(new Error("network"));

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("does not update visual when cache is empty", async () => {
      mockClient.armSecurity.mockResolvedValue({ status: "success" });

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
      mockAction.getSettings.mockResolvedValue({ target: "Security" });
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: { securityState: DISARMED },
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
        name: "Security", type: "security-system", reachable: true, state: { securityState: AWAY_ARM },
      });

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).toHaveBeenCalledWith("Security");
    });

    it("skips actions without setState", async () => {
      const mockAction = { getSettings: vi.fn().mockResolvedValue({ target: "Security" }) };
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
    it("defaults securityState to DISARMED when state.securityState is undefined", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true, state: {},
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(0);
      expect(ev.action.setTitle).toHaveBeenCalledWith("Off");
    });

    it("defaults securityState to DISARMED when state is undefined", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Security", type: "security-system", reachable: true,
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Security", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(0);
      expect(ev.action.setTitle).toHaveBeenCalledWith("Off");
    });
  });
});
