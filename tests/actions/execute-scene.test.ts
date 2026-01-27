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

    it("does not set title when scene is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "", port: 0 } },
      };

      await action.onWillAppear(ev as any);

      expect(ev.action.setTitle).not.toHaveBeenCalled();
    });

    it("uses custom port", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "Test", port: 9999 } },
      };

      await action.onWillAppear(ev as any);

      expect(ItsyhomeClient).toHaveBeenCalledWith(undefined, 9999);
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

    it("does not set title when scene is empty", async () => {
      const ev = {
        action: createMockAction(),
        payload: { settings: { scene: "", port: 0 } },
      };

      await action.onDidReceiveSettings(ev as any);

      expect(ev.action.setTitle).not.toHaveBeenCalled();
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
});
