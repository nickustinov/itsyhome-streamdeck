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
const DEFAULT_ON_COLOR = "#ff9500"; // Orange

type LightSettings = {
  target: string;
  port: number;
  offColor?: string;
  onColor?: string;
};

const POLL_INTERVAL_MS = 3000;

type LightCache = {
  isOn: boolean;
  icon?: string;
  brightness?: number;
};

@action({ UUID: "com.nickustinov.itsyhome.brightness" })
export class LightAction extends SingletonAction<LightSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();
  private lightCache = new Map<string, LightCache>();

  override async onWillAppear(ev: WillAppearEvent<LightSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<LightSettings>, target, ev.payload.settings);
    }

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<LightSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<LightSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<LightSettings>, target, ev.payload.settings);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<LightSettings>): Promise<void> {
    const { target } = ev.payload.settings;

    if (!target) {
      await ev.action.showAlert();
      return;
    }

    const cached = this.lightCache.get(target);

    try {
      const result = await this.client.toggle(target);
      if (result.status === "error") {
        streamDeck.logger.error(`Light toggle failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      // Optimistic update: flip the cached state immediately
      if (cached) {
        const newIsOn = !cached.isOn;
        this.lightCache.set(target, { ...cached, isOn: newIsOn });
        await this.applyVisualState(ev.action as KeyAction<LightSettings>, cached.icon, newIsOn, ev.payload.settings, cached.brightness);
      }
    } catch (err) {
      streamDeck.logger.error(`Light toggle error: ${err}`);
      await ev.action.showAlert();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        if (!("setState" in action)) continue;
        const settings = await action.getSettings<LightSettings>();
        if (settings.target) {
          await this.updateState(action as KeyAction<LightSettings>, settings.target, settings);
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

  private async updateState(action: KeyAction<LightSettings>, target: string, settings: LightSettings): Promise<void> {
    try {
      const info = await this.client.getDeviceInfo(target);
      const device = Array.isArray(info) ? info[0] : info;
      if (!device) return;

      const state = device.state as DeviceState | undefined;
      const isOn = state?.on ?? (state?.brightness != null && state.brightness > 0);
      const icon = device.icon;
      const brightness = state?.brightness;

      this.lightCache.set(target, { isOn, icon, brightness });
      await this.applyVisualState(action, icon, isOn, settings, brightness);
    } catch {
      // Server might not be running — silently ignore
    }
  }

  private async applyVisualState(
    action: KeyAction<LightSettings>,
    apiIcon?: string,
    isOn?: boolean,
    settings?: LightSettings,
    brightness?: number,
  ): Promise<void> {
    const iconName = apiIcon ?? "lightbulb";
    const on = isOn ?? false;

    const color = on
      ? (settings?.onColor || DEFAULT_ON_COLOR)
      : (settings?.offColor || DEFAULT_OFF_COLOR);

    // Show brightness percentage when light is on and brightness is available
    const text = on && brightness != null ? `${Math.round(brightness)}%` : undefined;

    const icon = await renderIcon(iconName, color, on, text);

    await action.setImage(icon);
    await action.setState(on ? 1 : 0);
  }
}
