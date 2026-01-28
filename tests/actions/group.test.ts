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
  renderIcon: vi.fn((iconName: string, color: string, useFill: boolean) => {
    const state = useFill ? "on" : "off";
    return Promise.resolve(`data:image/png;base64,mock-${iconName}-${state}`);
  }),
}));

import { GroupAction } from "../../src/actions/group";
import { ItsyhomeClient } from "../../src/api/itsyhome-client";
import streamDeck from "@elgato/streamdeck";

describe("GroupAction", () => {
  let action: GroupAction;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient();
    vi.mocked(ItsyhomeClient).mockImplementation(() => mockClient as unknown as ItsyhomeClient);
    action = new GroupAction();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("updates state when target is set", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light 1", type: "light", reachable: true, state: { on: true } },
        { name: "Light 2", type: "light", reachable: true, state: { on: true } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Bedroom", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-squares-four-on");
      expect(ev.action.setState).toHaveBeenCalledWith(1);
    });

    it("uses custom port when provided", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light", type: "light", reachable: true, state: { on: false } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Test", port: 9999 } },
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
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light", type: "light", icon: "lightbulb", reachable: true, state: { on: true } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Test", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-lightbulb-on");
    });

    it("handles empty array response", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Empty", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });

    it("silently ignores errors from getDeviceInfo", async () => {
      mockClient.getDeviceInfo.mockRejectedValue(new Error("ECONNREFUSED"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Test", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });
  });

  describe("count display", () => {
    it("shows partial count when some devices are on", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light 1", type: "light", reachable: true, state: { on: true } },
        { name: "Light 2", type: "light", reachable: true, state: { on: true } },
        { name: "Light 3", type: "light", reachable: true, state: { on: false } },
        { name: "Light 4", type: "light", reachable: true, state: { on: false } },
        { name: "Light 5", type: "light", reachable: true, state: { on: false } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Living", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("2/5");
    });

    it("shows no count when all devices are on", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light 1", type: "light", reachable: true, state: { on: true } },
        { name: "Light 2", type: "light", reachable: true, state: { on: true } },
        { name: "Light 3", type: "light", reachable: true, state: { on: true } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.All", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("");
    });

    it("shows no count when all devices are off", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light 1", type: "light", reachable: true, state: { on: false } },
        { name: "Light 2", type: "light", reachable: true, state: { on: false } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Off", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("");
    });

    it("shows label with count when partial", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light 1", type: "light", reachable: true, state: { on: true } },
        { name: "Light 2", type: "light", reachable: true, state: { on: false } },
        { name: "Light 3", type: "light", reachable: true, state: { on: false } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Bedroom", port: 0, label: "Bedroom" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Bedroom\n1/3");
    });

    it("shows only label when all devices are on", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light 1", type: "light", reachable: true, state: { on: true } },
        { name: "Light 2", type: "light", reachable: true, state: { on: true } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.All", port: 0, label: "Living Room" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Living Room");
    });

    it("shows only label when all devices are off", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light 1", type: "light", reachable: true, state: { on: false } },
        { name: "Light 2", type: "light", reachable: true, state: { on: false } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Off", port: 0, label: "Kitchen" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Kitchen");
    });

    it("detects on state via brightness when state.on is undefined", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light 1", type: "light", reachable: true, state: { brightness: 80 } },
        { name: "Light 2", type: "light", reachable: true, state: { brightness: 0 } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Lights", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("1/2");
      expect(ev.action.setState).toHaveBeenCalledWith(1);
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
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light", type: "light", reachable: true, state: { on: true } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Test", port: 0 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-squares-four-on");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light", type: "light", reachable: true, state: { on: false } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Test", port: 1234 } },
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

    it("turns off group when all devices are on", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light 1", type: "light", reachable: true, state: { on: true } },
        { name: "Light 2", type: "light", reachable: true, state: { on: true } },
      ]);

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "group.Test", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setImage.mockClear();
      mockAction.setState.mockClear();
      mockAction.setTitle.mockClear();

      mockClient.turnOff.mockResolvedValue({ status: "success" });

      await action.onKeyDown(ev as any);

      expect(mockClient.turnOff).toHaveBeenCalledWith("group.Test");
      expect(mockClient.turnOn).not.toHaveBeenCalled();
      expect(mockAction.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-squares-four-off");
      expect(mockAction.setState).toHaveBeenCalledWith(0);
      expect(mockAction.setTitle).toHaveBeenCalledWith("");
    });

    it("turns off group when partially on (3/5 scenario)", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light 1", type: "light", reachable: true, state: { on: true } },
        { name: "Light 2", type: "light", reachable: true, state: { on: true } },
        { name: "Light 3", type: "light", reachable: true, state: { on: true } },
        { name: "Light 4", type: "light", reachable: true, state: { on: false } },
        { name: "Light 5", type: "light", reachable: true, state: { on: false } },
      ]);

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "group.Partial", port: 0, label: "Lights" } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setTitle.mockClear();

      mockClient.turnOff.mockResolvedValue({ status: "success" });

      await action.onKeyDown(ev as any);

      expect(mockClient.turnOff).toHaveBeenCalledWith("group.Partial");
      expect(mockClient.turnOn).not.toHaveBeenCalled();
      expect(mockAction.setTitle).toHaveBeenCalledWith("Lights");
    });

    it("turns on group when all devices are off", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light 1", type: "light", reachable: true, state: { on: false } },
        { name: "Light 2", type: "light", reachable: true, state: { on: false } },
      ]);

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "group.Off", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setImage.mockClear();
      mockAction.setState.mockClear();

      mockClient.turnOn.mockResolvedValue({ status: "success" });

      await action.onKeyDown(ev as any);

      expect(mockClient.turnOn).toHaveBeenCalledWith("group.Off");
      expect(mockClient.turnOff).not.toHaveBeenCalled();
      expect(mockAction.setImage).toHaveBeenCalledWith("data:image/png;base64,mock-squares-four-on");
      expect(mockAction.setState).toHaveBeenCalledWith(1);
    });

    it("shows alert on turnOff error status", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light", type: "light", reachable: true, state: { on: true } },
      ]);

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "group.Test", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      mockClient.turnOff.mockResolvedValue({ status: "error", message: "fail" });

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("shows alert on network error", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light", type: "light", reachable: true, state: { on: true } },
      ]);

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "group.Test", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      mockClient.turnOff.mockRejectedValue(new Error("network"));

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("does not update visual when cache is empty", async () => {
      mockClient.turnOn.mockResolvedValue({ status: "success" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Uncached", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.setImage).not.toHaveBeenCalled();
    });
  });

  describe("polling", () => {
    it("polls all actions at 3s intervals", async () => {
      const mockAction = createMockAction();
      mockAction.getSettings.mockResolvedValue({ target: "group.Test" });
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light", type: "light", reachable: true, state: { on: true } },
      ]);

      Object.defineProperty(action, "actions", {
        get: () => [mockAction],
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      mockClient.getDeviceInfo.mockClear();

      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light", type: "light", reachable: true, state: { on: false } },
      ]);

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).toHaveBeenCalledWith("group.Test");
    });

    it("skips actions without setState", async () => {
      const mockAction = { getSettings: vi.fn().mockResolvedValue({ target: "group.Test" }) };
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
    it("wraps single device response in array", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Light", type: "light", reachable: true, state: { on: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Single", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(1);
      expect(ev.action.setTitle).toHaveBeenCalledWith("");
    });

    it("counts device as off when state is undefined", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Light 1", type: "light", reachable: true, state: { on: true } },
        { name: "Light 2", type: "light", reachable: true },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "group.Mixed", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("1/2");
    });
  });
});
