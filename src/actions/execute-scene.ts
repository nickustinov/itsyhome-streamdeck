import streamDeck, {
  action,
  DidReceiveSettingsEvent,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { ItsyhomeClient } from "../api/itsyhome-client";
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

    await ev.action.setImage(getSceneIcon());
    if (scene) {
      await ev.action.setTitle(scene);
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SceneSettings>): Promise<void> {
    const { scene, port } = ev.payload.settings;

    if (port) {
      this.client = new ItsyhomeClient(undefined, port);
    }

    await ev.action.setImage(getSceneIcon());
    if (scene) {
      await ev.action.setTitle(scene);
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
