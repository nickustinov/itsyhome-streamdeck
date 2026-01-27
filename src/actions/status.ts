import {
  action,
  DidReceiveSettingsEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import { ItsyhomeClient, type DeviceState } from "../api/itsyhome-client";
import { getDeviceIcon } from "../icons";

type StatusSettings = {
  target: string;
  port: number;
  label: string;
};

const POLL_INTERVAL_MS = 3000;

@action({ UUID: "com.nickustinov.itsyhome.status" })
export class StatusAction extends SingletonAction<StatusSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();

  override async onWillAppear(ev: WillAppearEvent<StatusSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateDisplay(ev.action, target, ev.payload.settings);
    }

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<StatusSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<StatusSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateDisplay(ev.action, target, ev.payload.settings);
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        const settings = await action.getSettings<StatusSettings>();
        if (settings.target) {
          await this.updateDisplay(action, settings.target, settings);
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

  private async updateDisplay(
    action: { setTitle(title: string): Promise<void>; setImage(image: string): Promise<void> },
    target: string,
    settings: StatusSettings,
  ): Promise<void> {
    try {
      const info = await this.client.getDeviceInfo(target);
      const device = Array.isArray(info) ? info[0] : info;
      if (!device) return;

      const state = device.state as DeviceState | undefined;
      let value = "";

      if (device.type === "temperature-sensor" && state?.temperature != null) {
        value = `${state.temperature.toFixed(1)}°`;
      } else if (device.type === "humidity-sensor" && state?.humidity != null) {
        value = `${Math.round(state.humidity)}%`;
      }

      const label = settings.label;
      const title = label && value ? `${label}\n${value}` : label || value;

      await action.setImage(getDeviceIcon(device.type, true, device.icon));
      await action.setTitle(title);
    } catch {
      // Server might not be running
    }
  }
}
