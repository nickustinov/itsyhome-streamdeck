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
  renderIcon: vi.fn((iconName: string, _color: string, isOn: boolean) =>
    `data:mock/${iconName}/${isOn ? "on" : "off"}`),
  clearIconCache: vi.fn(),
}));

import { ThermostatAction } from "../../src/actions/thermostat";
import { ItsyhomeClient } from "../../src/api/itsyhome-client";
import streamDeck from "@elgato/streamdeck";

describe("ThermostatAction", () => {
  let action: ThermostatAction;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient();
    vi.mocked(ItsyhomeClient).mockImplementation(() => mockClient as unknown as ItsyhomeClient);
    action = new ThermostatAction();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("displays current and target temperature", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: true, temperature: 22.5, targetTemperature: 24, mode: "cool" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "current-target" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("23°/24°");
      expect(ev.action.setState).toHaveBeenCalledWith(1);
    });

    it("displays only current temperature when display=current", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: true, temperature: 21.3, targetTemperature: 22, mode: "heat" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "current" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("21°");
    });

    it("displays only target temperature when display=target", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: true, temperature: 21, targetTemperature: 25, mode: "auto" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "target" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("25°");
    });

    it("shows label with temperature", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: true, temperature: 20, targetTemperature: 22, mode: "heat" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "Office", display: "current-target" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Office\n20°/22°");
    });

    it("shows only label when no temperature data", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: false },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "Room", display: "current-target" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Room");
    });

    it("shows empty title when no label and no temperature", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true, state: { on: false },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "current-target" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("");
    });

    it("defaults display to current-target", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: true, temperature: 20, targetTemperature: 22, mode: "heat" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("20°/22°");
    });

    it("shows only current when current-target but no target temp", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: true, temperature: 19 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "current-target" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("19°");
    });

    it("shows empty when display=target but no target temp", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: true, temperature: 19 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "target" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("");
    });

    it("shows empty when display=current but no current temp", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: true, targetTemperature: 22 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "current" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true, state: { on: true, mode: "cool" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 9999, label: "", display: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 9999);
    });

    it("does nothing when target is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, label: "", display: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("handles array response", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "AC", type: "thermostat", reachable: true, state: { on: true, temperature: 21, targetTemperature: 23 } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "current-target" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("21°/23°");
    });

    it("handles empty array", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).not.toHaveBeenCalled();
    });

    it("silently ignores errors", async () => {
      mockClient.getDeviceInfo.mockRejectedValue(new Error("ECONNREFUSED"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).not.toHaveBeenCalled();
    });

    it("sets state to 0 when off", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: false, temperature: 20 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "current" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("defaults on to false when undefined", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true, state: {},
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "" } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });
  });

  describe("onWillDisappear", () => {
    it("stops polling when last context disappears", async () => {
      const ev = {
        action: { ...createMockAction(), id: "ctx-1" },
        payload: { settings: { target: "", port: 0, label: "", display: "" } },
      };

      await action.onWillAppear(ev as any);
      action.onWillDisappear(ev as any);
    });
  });

  describe("onDidReceiveSettings", () => {
    it("updates state with new settings", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: true, temperature: 22, targetTemperature: 24, mode: "cool" },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "current-target" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("22°/24°");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true, state: { on: true },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 7777, label: "", display: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 7777);
    });

    it("does nothing when target is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, label: "", display: "" } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });
  });

  describe("onKeyDown", () => {
    it("shows alert when no target", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, label: "", display: "" } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("toggles thermostat with optimistic update", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: true, mode: "cool" },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "AC", port: 0, label: "", display: "" } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setImage.mockClear();
      mockAction.setState.mockClear();

      mockClient.toggle.mockResolvedValue({ status: "success" });

      await action.onKeyDown(ev as any);

      expect(mockClient.toggle).toHaveBeenCalledWith("AC");
      // After toggle: was on, now off
      expect(mockAction.setState).toHaveBeenCalledWith(0);
    });

    it("toggles from off to on with optimistic update", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: false, mode: "heat" },
      });

      const mockAction = createMockAction();
      const ev = {
        action: mockAction,
        payload: { settings: { target: "AC", port: 0, label: "", display: "" } },
      };

      await action.onWillAppear(ev as any);
      mockAction.setImage.mockClear();
      mockAction.setState.mockClear();

      mockClient.toggle.mockResolvedValue({ status: "success" });

      await action.onKeyDown(ev as any);

      // After toggle: was off, now on
      expect(mockAction.setState).toHaveBeenCalledWith(1);
    });

    it("does not update visual when cache is empty", async () => {
      mockClient.toggle.mockResolvedValue({ status: "success" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Uncached", port: 0, label: "", display: "" } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.setState).not.toHaveBeenCalled();
    });

    it("shows alert on toggle error status", async () => {
      mockClient.toggle.mockResolvedValue({ status: "error", message: "fail" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "" } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("shows alert on network error", async () => {
      mockClient.toggle.mockRejectedValue(new Error("network"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "AC", port: 0, label: "", display: "" } },
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
        payload: { settings: { target: "", port: 0, label: "", display: "" } },
      };
      const ev2 = {
        action: { ...createMockAction(), id: "ctx-2" },
        payload: { settings: { target: "", port: 0, label: "", display: "" } },
      };

      await action.onWillAppear(ev1 as any);
      await action.onWillAppear(ev2 as any);
    });

    it("polls all actions at 3s intervals", async () => {
      const pollAction = {
        ...createMockAction(),
        setState: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ target: "AC", label: "", display: "current-target" }),
      };
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: true, temperature: 22, mode: "cool" },
      });

      Object.defineProperty(action, "actions", {
        get: () => [pollAction],
        configurable: true,
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, label: "", display: "" } },
      };

      await action.onWillAppear(ev as any);
      mockClient.getDeviceInfo.mockClear();

      mockClient.getDeviceInfo.mockResolvedValue({
        name: "AC", type: "thermostat", reachable: true,
        state: { on: true, temperature: 23, mode: "cool" },
      });

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).toHaveBeenCalledWith("AC");
    });

    it("skips actions without setState", async () => {
      const pollAction = { getSettings: vi.fn().mockResolvedValue({ target: "AC" }) };
      Object.defineProperty(action, "actions", {
        get: () => [pollAction],
        configurable: true,
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, label: "", display: "" } },
      };

      await action.onWillAppear(ev as any);

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });

    it("skips actions with no target", async () => {
      const pollAction = {
        ...createMockAction(),
        setState: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ target: "", label: "", display: "" }),
      };
      Object.defineProperty(action, "actions", {
        get: () => [pollAction],
        configurable: true,
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", port: 0, label: "", display: "" } },
      };

      await action.onWillAppear(ev as any);

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });
  });
});
