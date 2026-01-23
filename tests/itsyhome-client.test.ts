import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ItsyhomeClient, ItsyhomeApiError } from "../src/api/itsyhome-client";

describe("ItsyhomeClient", () => {
  let client: ItsyhomeClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new ItsyhomeClient();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockResponse(body: unknown, status = 200) {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }

  describe("constructor", () => {
    it("uses default host and port", () => {
      const c = new ItsyhomeClient();
      expect(c).toBeDefined();
    });

    it("accepts custom host and port", () => {
      const c = new ItsyhomeClient("192.168.1.100", 9999);
      expect(c).toBeDefined();
    });
  });

  describe("listDevices", () => {
    it("fetches device list", async () => {
      const devices = [
        { name: "Lamp", type: "light", room: "Office", reachable: true },
      ];
      mockResponse(devices);

      const result = await client.listDevices();
      expect(result).toEqual(devices);
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:8423/list/devices");
    });

    it("fetches devices filtered by room", async () => {
      mockResponse([]);

      await client.listDevices("Office");
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:8423/list/devices/Office");
    });

    it("encodes room names with special characters", async () => {
      mockResponse([]);

      await client.listDevices("Living Room");
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:8423/list/devices/Living%20Room");
    });
  });

  describe("listScenes", () => {
    it("fetches scene list", async () => {
      const scenes = [{ name: "Good Morning" }, { name: "Good Night" }];
      mockResponse(scenes);

      const result = await client.listScenes();
      expect(result).toEqual(scenes);
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:8423/list/scenes");
    });
  });

  describe("listGroups", () => {
    it("fetches group list", async () => {
      const groups = [{ name: "Office Lights", icon: "💡", devices: 3 }];
      mockResponse(groups);

      const result = await client.listGroups();
      expect(result).toEqual(groups);
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:8423/list/groups");
    });
  });

  describe("getDeviceInfo", () => {
    it("fetches info for a single device", async () => {
      const info = {
        name: "Lamp",
        type: "light",
        room: "Office",
        reachable: true,
        state: { on: true, brightness: 75 },
      };
      mockResponse(info);

      const result = await client.getDeviceInfo("Office/Lamp");
      expect(result).toEqual(info);
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:8423/info/Office%2FLamp");
    });
  });

  describe("toggle", () => {
    it("sends toggle command", async () => {
      mockResponse({ status: "success" });

      const result = await client.toggle("Office/Lamp");
      expect(result).toEqual({ status: "success" });
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:8423/toggle/Office%2FLamp");
    });
  });

  describe("turnOn", () => {
    it("sends turn on command", async () => {
      mockResponse({ status: "success" });

      const result = await client.turnOn("Office/Lamp");
      expect(result).toEqual({ status: "success" });
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:8423/on/Office%2FLamp");
    });
  });

  describe("turnOff", () => {
    it("sends turn off command", async () => {
      mockResponse({ status: "success" });

      const result = await client.turnOff("Office/Lamp");
      expect(result).toEqual({ status: "success" });
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:8423/off/Office%2FLamp");
    });
  });

  describe("setBrightness", () => {
    it("sends brightness command", async () => {
      mockResponse({ status: "success" });

      const result = await client.setBrightness("Office/Lamp", 50);
      expect(result).toEqual({ status: "success" });
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:8423/brightness/50/Office%2FLamp");
    });
  });

  describe("setPosition", () => {
    it("sends position command", async () => {
      mockResponse({ status: "success" });

      const result = await client.setPosition("Living Room/Blinds", 75);
      expect(result).toEqual({ status: "success" });
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:8423/position/75/Living%20Room%2FBlinds");
    });
  });

  describe("executeScene", () => {
    it("sends scene execution command", async () => {
      mockResponse({ status: "success" });

      const result = await client.executeScene("Good Morning");
      expect(result).toEqual({ status: "success" });
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:8423/scene/Good%20Morning");
    });
  });

  describe("isAvailable", () => {
    it("returns true when server responds", async () => {
      mockResponse({ rooms: 3, devices: 10 });

      const result = await client.isAvailable();
      expect(result).toBe(true);
    });

    it("returns false when server is unreachable", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const result = await client.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe("error handling", () => {
    it("throws ItsyhomeApiError on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('{"status":"error","message":"Not found"}'),
      });

      await expect(client.toggle("Nonexistent")).rejects.toThrow(ItsyhomeApiError);
    });

    it("includes status code in error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('{"status":"error","message":"Pro required"}'),
      });

      try {
        await client.toggle("Office/Lamp");
      } catch (err) {
        expect(err).toBeInstanceOf(ItsyhomeApiError);
        expect((err as ItsyhomeApiError).statusCode).toBe(403);
      }
    });
  });

  describe("custom port", () => {
    it("uses custom port in requests", async () => {
      const customClient = new ItsyhomeClient("127.0.0.1", 9999);
      mockResponse({ status: "success" });

      await customClient.toggle("Office/Lamp");
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:9999/toggle/Office%2FLamp");
    });
  });
});
