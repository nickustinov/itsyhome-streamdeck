import streamDeck, {
  action,
  DidReceiveSettingsEvent,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  type KeyAction,
} from "@elgato/streamdeck";
import { ItsyhomeClient, type DeviceInfo, type DeviceState } from "../api/itsyhome-client";
import { renderIcon } from "../icon-renderer";

const DEFAULT_OFF_COLOR = "#8e8e93"; // Gray
const DEFAULT_ON_COLOR = "#ff9500"; // Orange

type GroupSettings = {
  target: string;
  port: number;
  label?: string;
  offColor?: string;
  onColor?: string;
};

const POLL_INTERVAL_MS = 3000;

type GroupCache = {
  isOn: boolean;
  icon?: string;
  onCount: number;
  totalCount: number;
};

@action({ UUID: "com.nickustinov.itsyhome.group" })
export class GroupAction extends SingletonAction<GroupSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();
  private groupCache = new Map<string, GroupCache>();

  override async onWillAppear(ev: WillAppearEvent<GroupSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<GroupSettings>, target, ev.payload.settings);
    }

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<GroupSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<GroupSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<GroupSettings>, target, ev.payload.settings);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<GroupSettings>): Promise<void> {
    const { target } = ev.payload.settings;

    if (!target) {
      await ev.action.showAlert();
      return;
    }

    const cached = this.groupCache.get(target);

    try {
      // If any devices are on (including partial), turn off. Otherwise turn on.
      const shouldTurnOn = !cached?.isOn;
      const result = shouldTurnOn
        ? await this.client.turnOn(target)
        : await this.client.turnOff(target);

      if (result.status === "error") {
        streamDeck.logger.error(`Group action failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      // Optimistic update
      if (cached) {
        const newIsOn = shouldTurnOn;
        const newOnCount = newIsOn ? cached.totalCount : 0;
        this.groupCache.set(target, { ...cached, isOn: newIsOn, onCount: newOnCount });

        // Build title - show count only when partial
        const countStr = this.buildCountString(newOnCount, cached.totalCount);
        const label = ev.payload.settings.label;
        const title = label && countStr ? `${label}\n${countStr}` : label || countStr;

        await this.applyVisualState(ev.action as KeyAction<GroupSettings>, cached.icon, newIsOn, ev.payload.settings);
        await ev.action.setTitle(title);
      }
    } catch (err) {
      streamDeck.logger.error(`Group action error: ${err}`);
      await ev.action.showAlert();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        if (!("setState" in action)) continue;
        const settings = await action.getSettings<GroupSettings>();
        if (settings.target) {
          await this.updateState(action as KeyAction<GroupSettings>, settings.target, settings);
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

  private async updateState(action: KeyAction<GroupSettings>, target: string, settings: GroupSettings): Promise<void> {
    try {
      const info = await this.client.getDeviceInfo(target);

      // Groups return an array of devices
      const devices = Array.isArray(info) ? info : [info];
      if (devices.length === 0) return;

      // Count how many devices are on
      let onCount = 0;
      let icon: string | undefined;
      for (const device of devices) {
        if (!icon && device.icon) icon = device.icon;
        const state = device.state as DeviceState | undefined;
        const deviceOn = state?.on ?? (state?.brightness != null && state.brightness > 0);
        if (deviceOn) onCount++;
      }

      const totalCount = devices.length;
      const isOn = onCount > 0;

      this.groupCache.set(target, { isOn, icon, onCount, totalCount });

      // Build title - show count only when partial (not all on, not all off)
      const countStr = this.buildCountString(onCount, totalCount);
      const label = settings.label;
      const title = label && countStr ? `${label}\n${countStr}` : label || countStr;

      await this.applyVisualState(action, icon, isOn, settings);
      await action.setTitle(title);
    } catch {
      // Server might not be running — silently ignore
    }
  }

  /**
   * Build count string like "3/5" for partial states.
   * Returns empty string if all on or all off.
   */
  private buildCountString(onCount: number, totalCount: number): string {
    if (totalCount === 0) return "";
    if (onCount === 0) return ""; // All off - no count needed
    if (onCount === totalCount) return ""; // All on - no count needed
    return `${onCount}/${totalCount}`;
  }

  private async applyVisualState(
    action: KeyAction<GroupSettings>,
    apiIcon?: string,
    isOn?: boolean,
    settings?: GroupSettings,
  ): Promise<void> {
    // Groups use squares-four icon by default
    const iconName = apiIcon ?? "squares-four";
    const on = isOn ?? false;

    const color = on
      ? (settings?.onColor || DEFAULT_ON_COLOR)
      : (settings?.offColor || DEFAULT_OFF_COLOR);

    const icon = await renderIcon(iconName, color, on);

    await action.setImage(icon);
    await action.setState(on ? 1 : 0);
  }
}
