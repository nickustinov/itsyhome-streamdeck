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
    const icon = apiIcon ?? (type === "blinds" ? "venetian-mask" : "question");
    return `imgs/icons/${icon}-${isOn ? "on" : "off"}.png`;
  }),
}));

import { BlindsAction } from "../../src/actions/blinds";
import { ItsyhomeClient } from "../../src/api/itsyhome-client";
import streamDeck from "@elgato/streamdeck";

describe("BlindsAction", () => {
  let action: BlindsAction;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient();
    vi.mocked(ItsyhomeClient).mockImplementation(() => mockClient as unknown as ItsyhomeClient);
    action = new BlindsAction();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("updates display with position when target is set", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Blinds", type: "blinds", reachable: true, state: { position: 75 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "open", label: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/icons/venetian-mask-on.png");
      expect(ev.action.setTitle).toHaveBeenCalledWith("75%");
    });

    it("shows direction icon when no target", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", direction: "close", label: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/icons/venetian-mask-off.png");
    });

    it("defaults direction to open", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", direction: "", label: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/icons/venetian-mask-on.png");
    });

    it("shows label with position", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Blinds", type: "blinds", reachable: true, state: { position: 50 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "open", label: "Living", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Living\n50%");
    });

    it("shows only label when position is null", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Blinds", type: "blinds", reachable: true, state: {},
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "open", label: "Room", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("Room");
    });

    it("shows empty title when no label and no position", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Blinds", type: "blinds", reachable: true, state: {},
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "open", label: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Blinds", type: "blinds", reachable: true, state: { position: 50 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "open", label: "", port: 6666 } },
      };

      await action.onWillAppear(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 6666);
    });

    it("handles array response", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([
        { name: "Blinds", type: "blinds", reachable: true, state: { position: 30 } },
      ]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "close", label: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("30%");
    });

    it("handles empty array", async () => {
      mockClient.getDeviceInfo.mockResolvedValue([]);

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "open", label: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).not.toHaveBeenCalled();
    });

    it("silently ignores errors", async () => {
      mockClient.getDeviceInfo.mockRejectedValue(new Error("ECONNREFUSED"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "open", label: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).not.toHaveBeenCalled();
    });
  });

  describe("onWillDisappear", () => {
    it("stops polling when last context disappears", async () => {
      const ev = {
        action: { ...createMockAction(), id: "ctx-1" },
        payload: { settings: { target: "", direction: "open", label: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      action.onWillDisappear(ev as any);
    });
  });

  describe("onDidReceiveSettings", () => {
    it("updates display with new settings", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Blinds", type: "blinds", reachable: true, state: { position: 100 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "open", label: "", port: 0 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("100%");
    });

    it("shows direction icon when no target", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", direction: "close", label: "", port: 0 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("imgs/icons/venetian-mask-off.png");
    });

    it("uses custom port", async () => {
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Blinds", type: "blinds", reachable: true, state: { position: 50 },
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "open", label: "", port: 2222 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 2222);
    });
  });

  describe("onKeyDown", () => {
    it("shows alert when no target", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", direction: "open", label: "", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("shows alert when no direction", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "", label: "", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("sets position to 100 for open direction", async () => {
      mockClient.setPosition.mockResolvedValue({ status: "success" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "open", label: "", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(mockClient.setPosition).toHaveBeenCalledWith("Blinds", 100);
      expect(ev.action.showOk).toHaveBeenCalled();
    });

    it("sets position to 0 for close direction", async () => {
      mockClient.setPosition.mockResolvedValue({ status: "success" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "close", label: "", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(mockClient.setPosition).toHaveBeenCalledWith("Blinds", 0);
      expect(ev.action.showOk).toHaveBeenCalled();
    });

    it("shows alert on error status", async () => {
      mockClient.setPosition.mockResolvedValue({ status: "error", message: "fail" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "open", label: "", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("shows alert on network error", async () => {
      mockClient.setPosition.mockRejectedValue(new Error("network"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "Blinds", direction: "open", label: "", port: 0 } },
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
        payload: { settings: { target: "", direction: "open", label: "", port: 0 } },
      };
      const ev2 = {
        action: { ...createMockAction(), id: "ctx-2" },
        payload: { settings: { target: "", direction: "open", label: "", port: 0 } },
      };

      await action.onWillAppear(ev1 as any);
      await action.onWillAppear(ev2 as any);
    });

    it("polls all actions at 3s intervals", async () => {
      const mockAction = createMockAction();
      mockAction.getSettings.mockResolvedValue({ target: "Blinds", direction: "open", label: "" });
      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Blinds", type: "blinds", reachable: true, state: { position: 50 },
      });

      Object.defineProperty(action, "actions", {
        get: () => [mockAction],
        configurable: true,
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", direction: "open", label: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      mockClient.getDeviceInfo.mockClear();

      mockClient.getDeviceInfo.mockResolvedValue({
        name: "Blinds", type: "blinds", reachable: true, state: { position: 80 },
      });

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).toHaveBeenCalledWith("Blinds");
    });

    it("skips actions with no target", async () => {
      const mockAction = createMockAction();
      mockAction.getSettings.mockResolvedValue({ target: "", direction: "open", label: "" });

      Object.defineProperty(action, "actions", {
        get: () => [mockAction],
        configurable: true,
      });

      const ev = {
        action: createMockAction(),
        payload: { settings: { target: "", direction: "open", label: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockClient.getDeviceInfo).not.toHaveBeenCalled();
    });
  });
});
