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
const DEFAULT_ON_COLOR = "#007aff"; // Blue

type FanSettings = {
  target: string;
  port: number;
  label?: string;
  offColor?: string;
  onColor?: string;
};

const POLL_INTERVAL_MS = 3000;

type FanCache = {
  isOn: boolean;
  icon?: string;
  speed?: number;
};

@action({ UUID: "com.nickustinov.itsyhome.fan" })
export class FanAction extends SingletonAction<FanSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();
  private fanCache = new Map<string, FanCache>();

  override async onWillAppear(ev: WillAppearEvent<FanSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<FanSettings>, target, ev.payload.settings);
    }

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<FanSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<FanSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<FanSettings>, target, ev.payload.settings);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<FanSettings>): Promise<void> {
    const { target } = ev.payload.settings;

    if (!target) {
      await ev.action.showAlert();
      return;
    }

    const cached = this.fanCache.get(target);

    try {
      const result = await this.client.toggle(target);

      if (result.status === "error") {
        streamDeck.logger.error(`Fan action failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      // Optimistic update
      if (cached) {
        const newIsOn = !cached.isOn;
        this.fanCache.set(target, { ...cached, isOn: newIsOn });

        // Build title for optimistic update (speed shown as level, not percentage)
        const speedStr = newIsOn && cached.speed != null ? `${Math.round(cached.speed)}` : "";
        const label = ev.payload.settings.label;
        const title = label && speedStr ? `${label}\n${speedStr}` : label || speedStr;

        await this.applyVisualState(ev.action as KeyAction<FanSettings>, cached.icon, newIsOn, ev.payload.settings);
        await ev.action.setTitle(title);
      }
    } catch (err) {
      streamDeck.logger.error(`Fan action error: ${err}`);
      await ev.action.showAlert();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        if (!("setState" in action)) continue;
        const settings = await action.getSettings<FanSettings>();
        if (settings.target) {
          await this.updateState(action as KeyAction<FanSettings>, settings.target, settings);
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

  private async updateState(action: KeyAction<FanSettings>, target: string, settings: FanSettings): Promise<void> {
    try {
      const info = await this.client.getDeviceInfo(target);
      const device = Array.isArray(info) ? info[0] : info;
      if (!device) return;

      const state = device.state as DeviceState | undefined;
      const isOn = state?.on ?? false;
      const icon = device.icon;
      const speed = state?.speed;

      this.fanCache.set(target, { isOn, icon, speed });

      // Build title: label + speed (shown as level, not percentage)
      const speedStr = isOn && speed != null ? `${Math.round(speed)}` : "";
      const label = settings.label;
      const title = label && speedStr ? `${label}\n${speedStr}` : label || speedStr;

      await this.applyVisualState(action, icon, isOn, settings);
      await action.setTitle(title);
    } catch {
      // Server might not be running — silently ignore
    }
  }

  private async applyVisualState(
    action: KeyAction<FanSettings>,
    apiIcon?: string,
    isOn?: boolean,
    settings?: FanSettings,
  ): Promise<void> {
    const iconName = apiIcon ?? "fan";
    const on = isOn ?? false;

    const color = on
      ? (settings?.onColor || DEFAULT_ON_COLOR)
      : (settings?.offColor || DEFAULT_OFF_COLOR);

    const icon = await renderIcon(iconName, color, on);

    await action.setImage(icon);
    await action.setState(on ? 1 : 0);
  }
}
