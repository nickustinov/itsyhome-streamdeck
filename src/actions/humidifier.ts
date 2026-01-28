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
import { renderIcon } from "../icon-renderer";

const DEFAULT_OFF_COLOR = "#8e8e93"; // Gray
const DEFAULT_ON_COLOR = "#30b0c7"; // Teal

type HumidifierSettings = {
  target: string;
  port: number;
  label?: string;
  offColor?: string;
  onColor?: string;
};

const POLL_INTERVAL_MS = 3000;

type HumidifierCache = {
  isOn: boolean;
  icon?: string;
  humidity?: number;
};

@action({ UUID: "com.nickustinov.itsyhome.humidifier" })
export class HumidifierAction extends SingletonAction<HumidifierSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();
  private humidifierCache = new Map<string, HumidifierCache>();

  override async onWillAppear(ev: WillAppearEvent<HumidifierSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<HumidifierSettings>, target, ev.payload.settings);
    }

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<HumidifierSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<HumidifierSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<HumidifierSettings>, target, ev.payload.settings);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<HumidifierSettings>): Promise<void> {
    const { target } = ev.payload.settings;

    if (!target) {
      await ev.action.showAlert();
      return;
    }

    const cached = this.humidifierCache.get(target);

    try {
      const result = await this.client.toggle(target);

      if (result.status === "error") {
        streamDeck.logger.error(`Humidifier action failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      // Optimistic update
      if (cached) {
        const newIsOn = !cached.isOn;
        this.humidifierCache.set(target, { ...cached, isOn: newIsOn });

        // Build title for optimistic update (humidity shown as percentage)
        const humidityStr = cached.humidity != null ? `${Math.round(cached.humidity)}%` : "";
        const label = ev.payload.settings.label;
        const title = label && humidityStr ? `${label}\n${humidityStr}` : label || humidityStr;

        await this.applyVisualState(ev.action as KeyAction<HumidifierSettings>, cached.icon, newIsOn, ev.payload.settings);
        await ev.action.setTitle(title);
      }
    } catch (err) {
      streamDeck.logger.error(`Humidifier action error: ${err}`);
      await ev.action.showAlert();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        if (!("setState" in action)) continue;
        const settings = await action.getSettings<HumidifierSettings>();
        if (settings.target) {
          await this.updateState(action as KeyAction<HumidifierSettings>, settings.target, settings);
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

  private async updateState(action: KeyAction<HumidifierSettings>, target: string, settings: HumidifierSettings): Promise<void> {
    try {
      const info = await this.client.getDeviceInfo(target);
      const device = Array.isArray(info) ? info[0] : info;
      if (!device) return;

      const state = device.state as DeviceState | undefined;
      const isOn = state?.on ?? false;
      const icon = device.icon;
      const humidity = state?.humidity;

      this.humidifierCache.set(target, { isOn, icon, humidity });

      // Build title: label + humidity (always show humidity as it's a sensor reading)
      const humidityStr = humidity != null ? `${Math.round(humidity)}%` : "";
      const label = settings.label;
      const title = label && humidityStr ? `${label}\n${humidityStr}` : label || humidityStr;

      await this.applyVisualState(action, icon, isOn, settings);
      await action.setTitle(title);
    } catch {
      // Server might not be running — silently ignore
    }
  }

  private async applyVisualState(
    action: KeyAction<HumidifierSettings>,
    apiIcon?: string,
    isOn?: boolean,
    settings?: HumidifierSettings,
  ): Promise<void> {
    const iconName = apiIcon ?? "drop";
    const on = isOn ?? false;

    const color = on
      ? (settings?.onColor || DEFAULT_ON_COLOR)
      : (settings?.offColor || DEFAULT_OFF_COLOR);

    const icon = await renderIcon(iconName, color, on);

    await action.setImage(icon);
    await action.setState(on ? 1 : 0);
  }
}
