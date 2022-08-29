import { registerDeviceType } from "../../../src/devices.js";
import { registerRoomController } from "../../../src/plugins.js";
import { LightStandardDevice } from "./device-types/light_standard.js";
import ArduinoSerialController from "./room-controllers/arduino_serial.js";
import { ThermometerDHTDevice } from "./device-types/thermometer_dht.js";

export enum ArduinoCommands {
    pinMode = 0,
    digitalWrite = 1,
    digitalRead = 2,
    analogWrite = 3,
    analogRead = 4,
    DHT11 = 50,
    DHT21 = 51,
    DHT22 = 52,
}

export enum PinMode {
    INPUT = 0,
    OUTPUT = 1,
    INPUT_PULLUP = 2
}

export enum PinState {
    LOW = 0,
    HIGH = 1
}

registerRoomController(ArduinoSerialController);
registerDeviceType(LightStandardDevice);
registerDeviceType(ThermometerDHTDevice);