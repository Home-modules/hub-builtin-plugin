import { DeviceInstance, HMApi, SettingsFieldDef } from "../../../../src/plugins.js";
import ArduinoSerialController from "../room-controllers/arduino_serial.js";
import { ArduinoCommands } from "../builtin.js";

export class ThermometerDHTDevice extends DeviceInstance {
    static id: `${string}:${string}` = "thermometer:dht";
    static super_name = "Thermometer";
    static sub_name = "DHT";
    static icon: HMApi.T.IconName = "TemperatureHalf";
    static forRoomController: `${string}:${string}` | `${string}:*` = "arduino:*";
    static settingsFields: SettingsFieldDef[] = [
        {
            id: 'pin',
            type: 'number',
            label: 'Pin',
            description: 'The Arduino pin on which the DHT device is connected to',
            min: 0,
            max: 255,
            required: true
        },
        {
            id: 'type',
            type: 'radio',
            label: 'DHT type',
            direction: 'h',
            required: true,
            options: {
                "11": { label: "DHT11" },
                "21": { label: "DHT21" },
                "22": { label: "DHT22" },
            }
        },
        {
            id: 'unit',
            type: 'radio',
            label: 'Temperature unit',
            direction: 'h',
            required: true,
            options: {
                "c": { label: "Celsius" },
                "f": { label: "Fahrenheit" },
                "k": { label: "Kelvin" },
            }
        },
        {
            type: 'horizontal_wrapper',
            columns: [
                {
                    width: 1,
                    fields: [
                        {
                            id: 'cold_threshold',
                            type: 'number',
                            label: 'Cold threshold',
                            description: 'The temperature below which the reading will turn blue',
                            min: -273.15,
                            max: 1000,
                            default: 20,
                            postfix: "°C"
                        }
                    ]
                },
                {
                    width: 1,
                    fields: [
                        {
                            id: 'warm_threshold',
                            type: 'number',
                            label: 'Warm threshold',
                            description: 'The temperature above which the reading will turn orange',
                            min: -273.15,
                            max: 1000,
                            default: 30,
                            postfix: "°C"
                        },
                    ]
                },
                {
                    width: 1,
                    fields: [
                        {
                            id: 'hot_threshold',
                            type: 'number',
                            label: 'Hot threshold',
                            description: 'The temperature above which the reading will turn red',
                            min: -273.15,
                            max: 1000,
                            default: 40,
                            postfix: "°C"
                        }
                    ]
                },
            ]
        },
        {
            type: 'horizontal_wrapper',
            columns: [
                {
                    width: 1,
                    fields: [
                        {
                            id: 'dry_threshold',
                            type: 'number',
                            label: 'Dry threshold',
                            description: 'The humidity below which the reading will turn orange',
                            min: 0,
                            max: 100,
                            default: 30,
                            postfix: "%",
                        }
                    ]
                },
                {
                    width: 1,
                    fields: [
                        {
                            id: 'wet_threshold',
                            type: 'number',
                            label: 'Wet threshold',
                            description: 'The humidity above which the reading will turn blue',
                            min: 0,
                            max: 100,
                            default: 60,
                            postfix: "%",
                        },
                    ]
                },
            ]
        },
    ];
    static hasMainToggle = false;
    static clickable = false;
    static interactions: Record<string, HMApi.T.DeviceInteraction.Type> = {
        "temperature": {
            type: "label",
            defaultValue: "Temperature: Unknown",
            size: "large"
        },
        "humidity": {
            type: "label",
            defaultValue: "Humidity: Unknown"
        }
    };
    static defaultInteraction = "humidity";

    static validateSettings(settings: Record<string, string | number | boolean>) {
        if (settings.cold_threshold > settings.warm_threshold) {
            return "Cold threshold must be below warm threshold";
        }
        if (settings.warm_threshold > settings.hot_threshold) {
            return "Warm threshold must be below hot threshold";
        }
    }

    get roomController() {
        const c = super.roomController;
        if (c instanceof ArduinoSerialController) {
            return c;
        } else {
            throw new Error("Room controller is not an ArduinoSerialController"); // This error will crash hub. The reason for doing this is that things have gone too wrong for other means of error handling to be used.
        }
    }

    async getCurrentState() {
        const commandCode = {
            "11": ArduinoCommands.DHT11,
            "21": ArduinoCommands.DHT21,
            "22": ArduinoCommands.DHT22,
        }[this.settings.type as '11' | '21' | '22'];
        const data = await this.roomController.sendCommandWithResponse(commandCode, this.settings.pin as number);
        let temperature = data.readFloatLE(0);
        const humidity = data.readFloatLE(4);
        if (temperature === -999 && humidity === -999) {
            this.disable("DHT sensor is not connected or wrong type is specified in settings");
        } else {
            this.disabled = false;
        }
        this.iconColor =
            temperature < this.settings.cold_threshold ? 'blue' :
                temperature < this.settings.warm_threshold ? undefined :
                    temperature < this.settings.hot_threshold ? 'orange' :
                        'red';
        const temperatureUnit = this.settings.unit as 'c' | 'f' | 'k';
        if (temperatureUnit === 'f') {
            temperature = (temperature * 9 / 5) + 32;
        }
        if (temperatureUnit === 'k') {
            temperature += 273.15;
        }

        this.iconText = `${temperature.toFixed(1)}${temperatureUnit === 'k' ? '' : '°'}${temperatureUnit.toUpperCase()}`;
        this.interactionStates["temperature"] = {
            text: `Temperature: ${this.iconText}`,
            color: this.iconColor
        };
        this.interactionStates["humidity"] = {
            text: `Humidity: ${humidity.toFixed(1)}%`,
            color: humidity < this.settings.dry_threshold ? 'orange' :
                humidity < this.settings.wet_threshold ? undefined :
                    'blue'
        };

        return super.getCurrentState();
    }
}
