import { ReadlineParser, SerialPort } from "serialport";
import { HMApi, Log, RoomControllerInstance, SettingsFieldDef } from "../../../../src/plugins.js";
import arduinoBoards from "../arduino-boards.js";
import { ArduinoCommands } from "../builtin.js";

const log = new Log("controllers/arduino:serial");

export default class ArduinoSerialController extends RoomControllerInstance {
    static id: `${string}:${string}` = "arduino:serial";
    static super_name = "Arduino";
    static sub_name = "Serial";
    static settingsFields: SettingsFieldDef[] = [
        {
            id: "port",
            type: 'select',
            label: "Serial port",
            required: true,
            allowCustomValue: true,
            checkCustomValue: true,
            options: {
                isLazy: true,
                loadOn: "render",
                refreshOnOpen: true,
                fallbackTexts: {
                    whenLoading: "Scanning...",
                    whenEmpty: "No serial ports found",
                    whenError: "Could not scan for serial ports",
                },
                showRefreshButton: [true, {
                    whenEmpty: "Refresh ports",
                    whenNormal: "Refresh ports",
                    whenLoading: "Scanning"
                }],
                callback: async () => {
                    const ports = await SerialPort.list();
                    return ports.map(port => ({
                        value: port.path,
                        label: port.path,
                        subtext: arduinoBoards[port.vendorId + '-' + port.productId]
                    }));
                },
            }
        },
        {
            id: "baudrate",
            type: 'number',
            label: "Baud rate",
            required: true,
            default: 9600,
            min: 300,
            max: 115200,
            min_error: "Baud rate too low, performance will be affected",
            max_error: "Baud rate too high, reliability will be affected",
            postfix: "bps",
            placeholder: "9600",
            scrollable: false
        }
    ];


    serialPort: InstanceType<typeof SerialPort>;
    dataListeners: Record<number, (data: Buffer) => void> = {};

    constructor(properties: HMApi.T.Room) {
        super(properties);

        this.serialPort = new SerialPort({
            path: properties.controllerType.settings.port as string,
            baudRate: properties.controllerType.settings.baudrate as number,
            autoOpen: false,
        });
    }

    async init() {
        this.serialPort.on('close', () => {
            log.w('Serial port closed', this.initialized);
            if (this.initialized) {
                this.disable("Serial port closed");
            }
        });
        await new Promise<void>((resolve) => {
            this.serialPort.open((error) => {
                log.i('Opened serial port', this.serialPort.path);
                if (error) {
                    this.disable(error.message);
                    resolve();
                } else {
                    this.serialPort.on('data', (data: Buffer) => {
                        log.i('Received data', Array(data.values()));
                        if (data[0] === 0) {
                            resolve();
                        }
                    });
                }
            });
        });
        const parser = this.serialPort.pipe(new ReadlineParser({
            encoding: 'hex',
            delimiter: '0d0a' // \r\n
        }));
        parser.on('data', (data: string) => {
            const buffer = Buffer.from(data, 'hex');
            const command = buffer[0];
            const rest = buffer.slice(1);
            this.dataListeners[command](rest);
        });
        return super.init();
    }

    async dispose(): Promise<void> {
        await super.dispose();
        if (this.serialPort.isOpen) {
            await new Promise<void>((resolve) => {
                this.serialPort.close(() => resolve());
            });
        }
        this.serialPort.destroy();
    }

    static async validateSettings(settings: Record<string, string | number | boolean>): Promise<string | void> {
        const port = settings["port"] as string;
        const ports = (await SerialPort.list()).map(p => p.path);
        if (!ports.includes(port)) {
            return "Port does not exist / is disconnected";
        }
    }

    /**
     * Sends a command to the Arduino board.
     * @param command The command to send
     * @param pin The pin to use
     * @param value The parameter for the command
     */
    async sendCommand(command: ArduinoCommands, pin: number, value?: number) {
        const port = this.settings.port as string;
        const serial = this.serialPort;
        log.i('Sending command to', serial.path, command, pin, value);
        if (serial.isOpen) {
            await new Promise<void>((resolve) => {
                serial.write((
                    value === undefined ?
                        [command, pin] :
                        [command, pin, value]
                ), error => {
                    if (error) {
                        this.disable(error.message);
                    }
                    resolve();
                });
            });
        } else {
            this.disable(`Port ${port} is closed. Please restart the room controller.`);
        }
    }

    lastCommandId = 1;

    /**
     * Sends a command and wait for the response from the Arduino board.
     * @param command The command to send
     * @param pin The pin to use
     */
    async sendCommandWithResponse(command: ArduinoCommands, pin: number) {
        const commandId = ((this.lastCommandId++) % 246) + 10; // 10-255
        this.sendCommand(command, pin, commandId);
        return new Promise<Buffer>((resolve) => {
            this.dataListeners[commandId] = (data: Buffer) => {
                resolve(data);
                delete this.dataListeners[commandId];
            };
        });
    }
}