import streamDeck, {
  action,
  DidReceiveSettingsEvent,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  type KeyAction,
} from "@elgato/streamdeck";
import { ItsyhomeClient, type DeviceState } from "../api/itsyhome-client";
import { getDeviceIcon, getGroupIcon } from "../icons";

type ToggleSettings = {
  target: string;
  port: number;
};

const POLL_INTERVAL_MS = 3000;

type DeviceCache = {
  type: string;
  isOn: boolean;
};

@action({ UUID: "com.nickustinov.itsyhome.toggle" })
export class ToggleDeviceAction extends SingletonAction<ToggleSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();
  private deviceCache = new Map<string, DeviceCache>();

  override async onWillAppear(ev: WillAppearEvent<ToggleSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<ToggleSettings>, target);
    }

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<ToggleSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ToggleSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<ToggleSettings>, target);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
    const { target } = ev.payload.settings;

    if (!target) {
      await ev.action.showAlert();
      return;
    }

    try {
      const result = await this.client.toggle(target);
      if (result.status === "error") {
        streamDeck.logger.error(`Toggle failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      // Optimistic update: flip the cached state immediately
      const cached = this.deviceCache.get(target);
      if (cached) {
        const newIsOn = !cached.isOn;
        this.deviceCache.set(target, { ...cached, isOn: newIsOn });
        await this.applyVisualState(ev.action as KeyAction<ToggleSettings>, target, cached.type, newIsOn);
      }
    } catch (err) {
      streamDeck.logger.error(`Toggle error: ${err}`);
      await ev.action.showAlert();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        if (!("setState" in action)) continue;
        const settings = await action.getSettings<ToggleSettings>();
        if (settings.target) {
          await this.updateState(action as KeyAction<ToggleSettings>, settings.target);
        }
      }
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async updateState(action: KeyAction<ToggleSettings>, target: string): Promise<void> {
    try {
      const info = await this.client.getDeviceInfo(target);
      const device = Array.isArray(info) ? info[0] : info;
      if (!device) return;

      const state = device.state as DeviceState | undefined;
      const isOn = state?.on ?? false;

      this.deviceCache.set(target, { type: device.type, isOn });
      await this.applyVisualState(action, target, device.type, isOn);
    } catch {
      // Server might not be running — silently ignore
    }
  }

  private async applyVisualState(
    action: KeyAction<ToggleSettings>,
    target: string,
    deviceType: string,
    isOn: boolean,
  ): Promise<void> {
    const isGroup = target.startsWith("group.");
    const icon = isGroup ? getGroupIcon(isOn) : getDeviceIcon(deviceType, isOn);

    await action.setImage(icon);
    await action.setState(isOn ? 1 : 0);
  }
}
