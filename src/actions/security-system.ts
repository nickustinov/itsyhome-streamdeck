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

const DEFAULT_DISARMED_COLOR = "#8e8e93"; // Gray
const DEFAULT_ARMED_COLOR = "#30d158"; // Green
const ALARM_COLOR = "#ff3b30"; // Red

// Security states from HomeKit
const SECURITY_STATE = {
  STAY_ARM: 0,
  AWAY_ARM: 1,
  NIGHT_ARM: 2,
  DISARMED: 3,
  ALARM_TRIGGERED: 4,
} as const;

const STATE_LABELS: Record<number, string> = {
  [SECURITY_STATE.STAY_ARM]: "Stay",
  [SECURITY_STATE.AWAY_ARM]: "Away",
  [SECURITY_STATE.NIGHT_ARM]: "Night",
  [SECURITY_STATE.DISARMED]: "Off",
  [SECURITY_STATE.ALARM_TRIGGERED]: "Alarm!",
};

type SecuritySystemSettings = {
  target: string;
  port: number;
  label?: string;
  armMode?: number; // 0=Stay, 1=Away, 2=Night (default: 1=Away)
  disarmedColor?: string;
  armedColor?: string;
};

const POLL_INTERVAL_MS = 3000;

type SecurityCache = {
  securityState: number;
  icon?: string;
};

@action({ UUID: "com.nickustinov.itsyhome.security-system" })
export class SecuritySystemAction extends SingletonAction<SecuritySystemSettings> {
  private client = new ItsyhomeClient();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeContexts = new Set<string>();
  private securityCache = new Map<string, SecurityCache>();

  override async onWillAppear(ev: WillAppearEvent<SecuritySystemSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;
    this.activeContexts.add(ev.action.id);

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<SecuritySystemSettings>, target, ev.payload.settings);
    }

    this.startPolling();
  }

  override onWillDisappear(ev: WillDisappearEvent<SecuritySystemSettings>): void {
    this.activeContexts.delete(ev.action.id);
    if (this.activeContexts.size === 0) {
      this.stopPolling();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SecuritySystemSettings>): Promise<void> {
    const { target, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (target) {
      await this.updateState(ev.action as KeyAction<SecuritySystemSettings>, target, ev.payload.settings);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<SecuritySystemSettings>): Promise<void> {
    const { target, armMode } = ev.payload.settings;

    if (!target) {
      await ev.action.showAlert();
      return;
    }

    const cached = this.securityCache.get(target);
    const currentState = cached?.securityState ?? SECURITY_STATE.DISARMED;

    try {
      let result;
      let newState: number;

      if (currentState === SECURITY_STATE.DISARMED) {
        // Currently disarmed → arm to selected mode (default: Away)
        const targetMode = armMode ?? SECURITY_STATE.AWAY_ARM;
        result = await this.client.armSecurity(target, targetMode);
        newState = targetMode;
      } else if (currentState === SECURITY_STATE.ALARM_TRIGGERED) {
        // Alarm triggered → try to disarm
        result = await this.client.disarmSecurity(target);
        newState = SECURITY_STATE.DISARMED;
      } else {
        // Currently armed → disarm
        result = await this.client.disarmSecurity(target);
        newState = SECURITY_STATE.DISARMED;
      }

      if (result.status === "error") {
        streamDeck.logger.error(`Security system action failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      // Optimistic update
      if (cached) {
        this.securityCache.set(target, { ...cached, securityState: newState });

        const stateLabel = STATE_LABELS[newState] ?? "Unknown";
        const label = ev.payload.settings.label;
        const title = label ? `${label}\n${stateLabel}` : stateLabel;

        await this.applyVisualState(ev.action as KeyAction<SecuritySystemSettings>, cached.icon, newState, ev.payload.settings);
        await ev.action.setTitle(title);
      }
    } catch (err) {
      streamDeck.logger.error(`Security system action error: ${err}`);
      await ev.action.showAlert();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(async () => {
      for (const action of this.actions) {
        if (!("setState" in action)) continue;
        const settings = await action.getSettings<SecuritySystemSettings>();
        if (settings.target) {
          await this.updateState(action as KeyAction<SecuritySystemSettings>, settings.target, settings);
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

  private async updateState(action: KeyAction<SecuritySystemSettings>, target: string, settings: SecuritySystemSettings): Promise<void> {
    try {
      const info = await this.client.getDeviceInfo(target);
      const device = Array.isArray(info) ? info[0] : info;
      if (!device) return;

      const state = device.state as DeviceState | undefined;
      const securityState = state?.securityState ?? SECURITY_STATE.DISARMED;
      const icon = device.icon;

      this.securityCache.set(target, { securityState, icon });

      // Build title: label + state
      const stateLabel = STATE_LABELS[securityState] ?? "Unknown";
      const label = settings.label;
      const title = label ? `${label}\n${stateLabel}` : stateLabel;

      await this.applyVisualState(action, icon, securityState, settings);
      await action.setTitle(title);
    } catch {
      // Server might not be running — silently ignore
    }
  }

  private async applyVisualState(
    action: KeyAction<SecuritySystemSettings>,
    apiIcon?: string,
    securityState?: number,
    settings?: SecuritySystemSettings,
  ): Promise<void> {
    const iconName = apiIcon ?? "shield-check";
    const state = securityState ?? SECURITY_STATE.DISARMED;

    // Determine color based on state
    let color: string;
    let isOn: boolean;

    if (state === SECURITY_STATE.ALARM_TRIGGERED) {
      color = ALARM_COLOR;
      isOn = true;
    } else if (state === SECURITY_STATE.DISARMED) {
      color = settings?.disarmedColor || DEFAULT_DISARMED_COLOR;
      isOn = false;
    } else {
      // Armed (Stay, Away, or Night)
      color = settings?.armedColor || DEFAULT_ARMED_COLOR;
      isOn = true;
    }

    const icon = await renderIcon(iconName, color, isOn);

    await action.setImage(icon);
    await action.setState(isOn ? 1 : 0);
  }
}
