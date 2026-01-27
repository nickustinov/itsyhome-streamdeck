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

const DEFAULT_LOCKED_COLOR = "#30d158"; // Green - secure
const DEFAULT_UNLOCKED_COLOR = "#ff9500"; // Orange - attention

type LockSettings = {
  target: string;
  port: number;
  lockedColor?: string;
  unlockedColor?: string;
};

const POLL_INTERVAL_MS = 3000;

type LockCache = {
  isLocked: boolean;
  icon?: string;
};

@action({ UUID: "com.nickustinov.itsyhome.lock" })
export class LockAction extends SingletonAction<LockSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();
  private lockCache = new Map<string, LockCache>();
  private optimisticUntil = new Map<string, number>();

  override async onWillAppear(ev: WillAppearEvent<LockSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<LockSettings>, target, ev.payload.settings);
    }

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<LockSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<LockSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<LockSettings>, target, ev.payload.settings);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<LockSettings>): Promise<void> {
    const { target } = ev.payload.settings;

    if (!target) {
      await ev.action.showAlert();
      return;
    }

    try {
      const result = await this.client.toggle(target);
      if (result.status === "error") {
        streamDeck.logger.error(`Lock toggle failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      // Optimistic update — hold for 30s before allowing poll to overwrite
      const cached = this.lockCache.get(target);
      const wasLocked = cached?.isLocked ?? true;
      const nowLocked = !wasLocked;
      this.lockCache.set(target, { ...cached, isLocked: nowLocked });
      this.optimisticUntil.set(target, Date.now() + 30000);
      await this.applyVisualState(ev.action as KeyAction<LockSettings>, nowLocked, cached?.icon, ev.payload.settings);
    } catch (err) {
      streamDeck.logger.error(`Lock toggle error: ${err}`);
      await ev.action.showAlert();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        if (!("setState" in action)) continue;
        const settings = await action.getSettings<LockSettings>();
        if (settings.target) {
          await this.updateState(action as KeyAction<LockSettings>, settings.target, settings);
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

  private async updateState(action: KeyAction<LockSettings>, target: string, settings: LockSettings): Promise<void> {
    try {
      const holdUntil = this.optimisticUntil.get(target);
      if (holdUntil && Date.now() < holdUntil) return;
      this.optimisticUntil.delete(target);

      const info = await this.client.getDeviceInfo(target);
      const device = Array.isArray(info) ? info[0] : info;
      if (!device) return;

      const state = device.state as DeviceState | undefined;
      const isLocked = state?.locked ?? true;
      const icon = device.icon;
      this.lockCache.set(target, { isLocked, icon });
      await this.applyVisualState(action, isLocked, icon, settings);
    } catch {
      // Server might not be running
    }
  }

  private async applyVisualState(
    action: KeyAction<LockSettings>,
    isLocked: boolean,
    apiIcon?: string,
    settings?: LockSettings,
  ): Promise<void> {
    const iconName = apiIcon ?? "lock";
    const color = isLocked
      ? (settings?.lockedColor || DEFAULT_LOCKED_COLOR)
      : (settings?.unlockedColor || DEFAULT_UNLOCKED_COLOR);
    const icon = await renderIcon(iconName, color, isLocked);
    await action.setImage(icon);
    await action.setState(isLocked ? 1 : 0);
  }
}
