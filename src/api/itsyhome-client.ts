/**
 * Client for the Itsyhome webhook server HTTP API.
 * Communicates with the local webhook server to control HomeKit devices.
 */

export const DEFAULT_PORT = 8423;
export const DEFAULT_HOST = "127.0.0.1";

export type DeviceInfo = {
  name: string;
  type: string;
  room?: string;
  reachable: boolean;
  state?: DeviceState;
};

export type DeviceState = {
  on?: boolean;
  brightness?: number;
  position?: number;
  temperature?: number;
  targetTemperature?: number;
  humidity?: number;
  hue?: number;
  saturation?: number;
  locked?: boolean;
  doorState?: string;
  mode?: string;
  speed?: number;
};

export type SceneInfo = {
  name: string;
};

export type GroupInfo = {
  name: string;
  icon: string;
  devices: number;
  room?: string;
};

export type ListDevice = {
  name: string;
  type: string;
  room?: string;
  reachable: boolean;
};

export type ActionResponse = {
  status: "success" | "partial" | "error";
  message?: string;
};

export class ItsyhomeClient {
  private readonly baseUrl: string;

  constructor(host = DEFAULT_HOST, port = DEFAULT_PORT) {
    this.baseUrl = `http://${host}:${port}`;
  }

  async listDevices(room?: string): Promise<ListDevice[]> {
    const path = room ? `/list/devices/${encodeURIComponent(room)}` : "/list/devices";
    return this.get<ListDevice[]>(path);
  }

  async listScenes(): Promise<SceneInfo[]> {
    return this.get<SceneInfo[]>("/list/scenes");
  }

  async listGroups(): Promise<GroupInfo[]> {
    return this.get<GroupInfo[]>("/list/groups");
  }

  async getDeviceInfo(target: string): Promise<DeviceInfo | DeviceInfo[]> {
    return this.get<DeviceInfo | DeviceInfo[]>(`/info/${encodeURIComponent(target)}`);
  }

  async toggle(target: string): Promise<ActionResponse> {
    return this.get<ActionResponse>(`/toggle/${encodeURIComponent(target)}`);
  }

  async turnOn(target: string): Promise<ActionResponse> {
    return this.get<ActionResponse>(`/on/${encodeURIComponent(target)}`);
  }

  async turnOff(target: string): Promise<ActionResponse> {
    return this.get<ActionResponse>(`/off/${encodeURIComponent(target)}`);
  }

  async setBrightness(target: string, level: number): Promise<ActionResponse> {
    return this.get<ActionResponse>(`/brightness/${level}/${encodeURIComponent(target)}`);
  }

  async setPosition(target: string, position: number): Promise<ActionResponse> {
    return this.get<ActionResponse>(`/position/${position}/${encodeURIComponent(target)}`);
  }

  async executeScene(name: string): Promise<ActionResponse> {
    return this.get<ActionResponse>(`/scene/${encodeURIComponent(name)}`);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.get("/status");
      return true;
    } catch {
      return false;
    }
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      const body = await response.text();
      throw new ItsyhomeApiError(response.status, body);
    }
    return response.json() as Promise<T>;
  }
}

export class ItsyhomeApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: string,
  ) {
    super(`Itsyhome API error ${statusCode}: ${body}`);
    this.name = "ItsyhomeApiError";
  }
}
