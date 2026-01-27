import streamDeck, {
  action,
  DidReceiveSettingsEvent,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { ItsyhomeClient, type SceneInfo } from "../api/itsyhome-client";
import { getSceneIcon } from "../icons";

type SceneSettings = {
  scene: string;
  port: number;
};

@action({ UUID: "com.nickustinov.itsyhome.scene" })
export class ExecuteSceneAction extends SingletonAction<SceneSettings> {
  private client = new ItsyhomeClient();

  override async onWillAppear(ev: WillAppearEvent<SceneSettings>): Promise<void> {
    const { scene, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (scene) {
      await this.updateSceneIcon(ev.action, scene);
      await ev.action.setTitle(scene);
    } else {
      await ev.action.setImage(getSceneIcon());
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SceneSettings>): Promise<void> {
    const { scene, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    if (scene) {
      await this.updateSceneIcon(ev.action, scene);
      await ev.action.setTitle(scene);
    } else {
      await ev.action.setImage(getSceneIcon());
    }
  }

  private async updateSceneIcon(action: { setImage(image: string): Promise<void> }, sceneName: string): Promise<void> {
    try {
      const scenes = await this.client.listScenes();
      const scene = scenes.find((s: SceneInfo) => s.name === sceneName);
      await action.setImage(getSceneIcon(scene?.icon));
    } catch {
      // Fallback to default icon if API unavailable
      await action.setImage(getSceneIcon());
    }
  }

  override async onKeyDown(ev: KeyDownEvent<SceneSettings>): Promise<void> {
    const { scene } = ev.payload.settings;

    if (!scene) {
      await ev.action.showAlert();
      return;
    }

    try {
      const result = await this.client.executeScene(scene);
      if (result.status === "error") {
        streamDeck.logger.error(`Scene execution failed: ${result.message}`);
        await ev.action.showAlert();
        return;
      }

      await ev.action.showOk();
    } catch (err) {
      streamDeck.logger.error(`Scene execution error: ${err}`);
      await ev.action.showAlert();
    }
  }
}
