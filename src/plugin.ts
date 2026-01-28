import streamDeck from "@elgato/streamdeck";

import { ToggleDeviceAction } from "./actions/toggle-device";
import { ExecuteSceneAction } from "./actions/execute-scene";
import { LightAction } from "./actions/light";
import { FanAction } from "./actions/fan";
import { HumidifierAction } from "./actions/humidifier";
import { SecuritySystemAction } from "./actions/security-system";
import { LockAction } from "./actions/lock";
import { ThermostatAction } from "./actions/thermostat";
import { StatusAction } from "./actions/status";
import { BlindsAction } from "./actions/blinds";
import { GarageDoorAction } from "./actions/garage-door";
import { GroupAction } from "./actions/group";

streamDeck.actions.registerAction(new ToggleDeviceAction());
streamDeck.actions.registerAction(new ExecuteSceneAction());
streamDeck.actions.registerAction(new LightAction());
streamDeck.actions.registerAction(new FanAction());
streamDeck.actions.registerAction(new HumidifierAction());
streamDeck.actions.registerAction(new SecuritySystemAction());
streamDeck.actions.registerAction(new LockAction());
streamDeck.actions.registerAction(new ThermostatAction());
streamDeck.actions.registerAction(new StatusAction());
streamDeck.actions.registerAction(new BlindsAction());
streamDeck.actions.registerAction(new GarageDoorAction());
streamDeck.actions.registerAction(new GroupAction());

streamDeck.connect();
