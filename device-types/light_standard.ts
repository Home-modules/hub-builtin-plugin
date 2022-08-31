import { DeviceInstance, HMApi, SettingsFieldDef } from "../../../../src/plugins.js";
import ArduinoSerialController from "../room-controllers/arduino_serial.js";
import { ArduinoCommands, PinMode, PinState } from "../builtin.js";

export class LightStandardDevice extends DeviceInstance {
    static id: `${string}:${string}` = "light:standard";
    static super_name = "Light";
    static sub_name = "Standard";
    static icon: HMApi.T.IconName = "Lightbulb";
    static forRoomController: `${string}:${string}` | `${string}:*` | '*' = "arduino:*";
    static settingsFields: SettingsFieldDef[] = [
        {
            id: 'pin',
            type: 'number',
            label: 'Pin',
            default: 13,
            description: 'The Arduino pin on which the light is connected to',
            min: 0,
            max: 255,
            required: true
        },
        {
            id: 'invert',
            type: 'checkbox',
            label: 'Invert control pin',
            default: false,
            description: 'Currently pin will be LOW when off and HIGH when on',
            description_on_true: 'Currently pin will be HIGH when off and LOW when on',
        }
    ];
    static hasMainToggle = true;


    constructor(properties: HMApi.T.Device, roomId: string) {
        super(properties, roomId);
    }

    get roomController() {
        const c = super.roomController;
        if (c instanceof ArduinoSerialController) {
            return c;
        } else {
            throw new Error("Room controller is not an ArduinoSerialController"); // This error will crash hub. The reason for doing this is that things have gone too wrong for other means of error handling to be used.
        }
    }

    async init() {
        await super.init();
        await this.roomController.sendCommand(ArduinoCommands.pinMode, this.settings.pin as number, PinMode.OUTPUT);
        await this.roomController.sendCommand(ArduinoCommands.digitalWrite, this.settings.pin as number, this.computePinState(this.mainToggleState));
    }

    async toggleMainToggle(): Promise<void> {
        await super.toggleMainToggle();
        await this.roomController.sendCommand(ArduinoCommands.digitalWrite, this.settings.pin as number, this.computePinState(this.mainToggleState));
    }

    computePinState(state: boolean): PinState {
        return this.settings.invert ? (
            state ? PinState.LOW : PinState.HIGH
        ) : (
            state ? PinState.HIGH : PinState.LOW
        );
    }
}
