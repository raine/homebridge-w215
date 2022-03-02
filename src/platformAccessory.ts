import {
    Service,
    PlatformAccessory,
    CharacteristicValue,
    AccessoryPlugin,
    Logging,
    HAP,
    AccessoryConfig, API
} from 'homebridge';

let hap: HAP;
const importFresh = require('import-fresh');
const maxTries = 5;

export class PlugAccessory implements AccessoryPlugin {
    private readonly outletService: Service;
    private readonly temperatureService: Service;
    private readonly informationService: Service;

    private dsp = importFresh('hnap/js/soapclient')();

    private username: string = 'admin';
    private password?: string;
    private plugURL?: string;
    private retries: number = 0;

    private currentPowerState?: boolean;
    private currentTemperature?: number;

    constructor(
        private log: Logging,
        private readonly accessory: PlatformAccessory,
        private config: AccessoryConfig,
        private api: API
    ) {

        this.informationService = this.accessory.getService(hap.Service.AccessoryInformation)!
            .setCharacteristic(hap.Characteristic.Manufacturer, 'D-Link')
            .setCharacteristic(hap.Characteristic.Model, 'DSP W215 Smart Plug')
            .setCharacteristic(hap.Characteristic.SerialNumber, 'Default-Serial');

        this.username = this.config.username || 'admin';
        this.password = this.config.password;
        this.plugURL = "http://" + this.config.host + "/HNAP1";

        this.outletService = new hap.Service.Outlet(this.config.name);
        this.outletService.getCharacteristic(hap.Characteristic.On)
            .onSet(this.setOn.bind(this))
            .onGet(this.getOn.bind(this));

        this.temperatureService = new hap.Service.TemperatureSensor(this.config.name + ' Temperature');
        this.temperatureService.getCharacteristic(hap.Characteristic.CurrentTemperature)
            .onSet(this.getTemperature.bind(this));
    }

    getServices(): Service[] {
        return [
            this.informationService,
            this.outletService,
            this.temperatureService
        ];
    }

    async setOn(value: CharacteristicValue) {
        this.log.debug('Set Characteristic On ->', value);
        await this.setPowerState(value === 'true');
    }

    async getOn(): Promise<CharacteristicValue> {
        const powerState = await this.getPowerState().catch(() => {
            throw new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        })

        const isOn = powerState === 'true';

        this.log.debug('Get Characteristic On ->', isOn);

        return isOn;
    }

    async getTemperature(): Promise<CharacteristicValue> {
        const temperature: number = await new Promise((resolve) => {
            this.dsp.temperature().done(temperature => resolve(parseFloat(temperature)))
        });

        this.log.debug('Get Characteristic Temperature ->', temperature);

        this.currentTemperature = temperature;

        return this.currentTemperature;
    }

    getPowerState(): Promise<string> {
        this.retries = 0;

        return new Promise((resolve, reject) => {
            this.dsp.state().done((state) => {
                if (state === 'ERROR' && this.retries >= maxTries) {
                    reject('MAX-TRIES-EXCEEDED');
                    return;
                } else if (state === 'ERROR') {
                    this.retries += 1;
                    resolve(this.authenticate().then(() => this.getPowerState()));
                    return;
                }

                this.currentPowerState = (state === 'true');
                resolve(state);
            })
        })
    }

    setPowerState(isOn: boolean) {
        return new Promise(resolve => {
            if (isOn) {
                this.dsp.on().done((res) => {
                    this.currentPowerState = res;
                    resolve(res);
                });
            } else {
                this.dsp.off().done((res) => {
                    this.currentPowerState = res;
                    resolve(res);
                });
            }
        })
    }

    authenticate() {
        return new Promise((resolve, reject) => {
            this.dsp.login(this.username, this.password, this.plugURL).done((loggedIn) => {
                if (loggedIn) {
                    resolve(true);
                } else {
                    reject(loggedIn);
                }
            })
        })
    }
}
