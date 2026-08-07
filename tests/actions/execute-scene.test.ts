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

import { ExecuteSceneAction } from "../../src/actions/execute-scene";
import { ItsyhomeClient } from "../../src/api/itsyhome-client";
import streamDeck from "@elgato/streamdeck";

describe("ExecuteSceneAction", () => {
  let action: ExecuteSceneAction;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    mockClient.listScenes.mockResolvedValue([
      { name: "Good Morning", icon: "sun" },
      { name: "Night", icon: "moon" },
      { name: "Updated Scene", icon: "star" },
    ]);
    vi.mocked(ItsyhomeClient).mockImplementation(() => mockClient as unknown as ItsyhomeClient);
    action = new ExecuteSceneAction();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("onWillAppear", () => {
    it("sets icon from API and title when scene is set", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Good Morning", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:mock/sun/on");
      expect(ev.action.setTitle).toHaveBeenCalledWith("Good Morning");
    });

    it("sets empty title when scene is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("");
    });

    it("uses custom port", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Test", port: 9999 } },
      };

      await action.onWillAppear(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 9999);
    });

    it("falls back to default icon when API is unavailable", async () => {
      mockClient.listScenes.mockRejectedValue(new Error("ECONNREFUSED"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Good Morning", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:mock/sparkle/on");
    });
  });

  describe("onDidReceiveSettings", () => {
    it("updates icon and title", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Updated Scene", port: 0 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:mock/star/on");
      expect(ev.action.setTitle).toHaveBeenCalledWith("Updated Scene");
    });

    it("uses custom port", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Test", port: 5555 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 5555);
    });

    it("sets empty title when scene is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "", port: 0 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setTitle).toHaveBeenCalledWith("");
    });
  });

  describe("onKeyDown", () => {
    it("shows alert when no scene", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
    });

    it("executes scene and shows ok", async () => {
      mockClient.executeScene.mockResolvedValue({ status: "success" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Good Morning", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(mockClient.executeScene).toHaveBeenCalledWith("Good Morning");
      expect(ev.action.showOk).toHaveBeenCalled();
    });

    it("shows alert on error status", async () => {
      mockClient.executeScene.mockResolvedValue({ status: "error", message: "fail" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Bad Scene", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });

    it("shows alert on network error", async () => {
      mockClient.executeScene.mockRejectedValue(new Error("network"));

      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Test", port: 0 } },
      };

      await action.onKeyDown(ev as any);

      expect(ev.action.showAlert).toHaveBeenCalled();
      expect(streamDeck.logger.error).toHaveBeenCalled();
    });
  });

  describe("state display", () => {
    beforeEach(() => {
      mockClient.listScenes.mockResolvedValue([
        { name: "Active Scene", icon: "sun", state: { on: true } },
        { name: "Inactive Scene", icon: "moon", state: { on: false } },
        { name: "Stateless Scene", icon: "star" },
      ]);
    });

    it("renders an active scene as on", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Active Scene", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:mock/sun/on");
      expect(ev.action.setState).toHaveBeenCalledWith(1);
    });

    it("renders an inactive scene as off", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Inactive Scene", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:mock/moon/off");
      expect(ev.action.setState).toHaveBeenCalledWith(0);
    });

    it("keeps scenes without reported state looking active (fire-only)", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Stateless Scene", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setImage).toHaveBeenCalledWith("data:mock/star/on");
      expect(ev.action.setState).toHaveBeenCalledWith(1);
    });

    it("flips to off optimistically after deactivating", async () => {
      mockClient.deactivateScene.mockResolvedValue({ status: "success" });

      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Active Scene", port: 0, toggle: true } },
      };

      await action.onWillAppear(ev as any);
      await action.onKeyDown(ev as any);

      expect(mockClient.deactivateScene).toHaveBeenCalledWith("Active Scene");
      expect(ev.action.setImage).toHaveBeenLastCalledWith("data:mock/sun/off");
      expect(ev.action.setState).toHaveBeenLastCalledWith(0);
    });
  });

  describe("toggle behaviour", () => {
    beforeEach(() => {
      mockClient.listScenes.mockResolvedValue([
        { name: "Active Scene", icon: "sun", state: { on: true } },
        { name: "Inactive Scene", icon: "moon", state: { on: false } },
        { name: "Stateless Scene", icon: "star" },
      ]);
      mockClient.executeScene.mockResolvedValue({ status: "success" });
      mockClient.deactivateScene.mockResolvedValue({ status: "success" });
    });

    it("deactivates an active scene when toggle is enabled", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Active Scene", port: 0, toggle: true } },
      };

      await action.onWillAppear(ev as any);
      await action.onKeyDown(ev as any);

      expect(mockClient.deactivateScene).toHaveBeenCalledWith("Active Scene");
      expect(mockClient.executeScene).not.toHaveBeenCalled();
    });

    it("runs an inactive scene when toggle is enabled", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Inactive Scene", port: 0, toggle: true } },
      };

      await action.onWillAppear(ev as any);
      await action.onKeyDown(ev as any);

      expect(mockClient.executeScene).toHaveBeenCalledWith("Inactive Scene");
      expect(mockClient.deactivateScene).not.toHaveBeenCalled();
    });

    it("always runs the scene when toggle is disabled", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Active Scene", port: 0 } },
      };

      await action.onWillAppear(ev as any);
      await action.onKeyDown(ev as any);

      expect(mockClient.executeScene).toHaveBeenCalledWith("Active Scene");
      expect(mockClient.deactivateScene).not.toHaveBeenCalled();
    });

    it("never deactivates a scene that reports no state", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Stateless Scene", port: 0, toggle: true } },
      };

      await action.onWillAppear(ev as any);
      await action.onKeyDown(ev as any);

      expect(mockClient.executeScene).toHaveBeenCalledWith("Stateless Scene");
      expect(mockClient.deactivateScene).not.toHaveBeenCalled();
    });
  });

  describe("polling", () => {
    it("stops polling once the last key disappears", async () => {
      const clearSpy = vi.spyOn(global, "clearInterval");

      await action.onWillAppear({
        action: createMockAction(),
        payload: { settings: { scene: "Good Morning", port: 0 } },
      } as any);

      action.onWillDisappear({ action: { id: "test-action-id" }, payload: { settings: {} } } as any);

      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });
  });
});
