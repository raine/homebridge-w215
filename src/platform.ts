import {
    API,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service,
    Characteristic
} from 'homebridge';
import {State} from "./state";

const importFresh = require('import-fresh');
const maxTries = 5;

export class DSPW215HomebridgePlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    public readonly accessories: PlatformAccessory[] = [];

    private dsp = importFresh('hnap/js/soapclient')();

    private username: string = 'admin';
    private password?: string;
    private plugURL?: string;
    private retries: number = 0;

    private currentPowerState?: boolean;
    private currentTemperature?: number;

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API,
    ) {
        this.log.debug('Finished initializing platform:', this.config.name);
    }

    configureAccessory(accessory: PlatformAccessory) {
        this.log.info("Configuring accessory %s", accessory.displayName);

        this.plugURL = "http://" + this.config.host + "/HNAP1";
        this.username = this.config.username || 'admin';
        this.password = this.config.password;


        this.getState().then(state => {
            this.currentPowerState = state.power;
            this.currentTemperature = state.temperature;

            this.accessories.push(accessory);
        });
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

    async getState(): Promise<State> {
        const state = await this.getPowerState();
        this.currentPowerState = (state == 'true')
        this.currentTemperature = await this.getTemperature();

        return {
            power: this.currentPowerState,
            temperature: this.currentTemperature,
        }
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

    getTemperature(): Promise<number> {
        return new Promise((resolve) => {
            this.dsp.temperature().done(temperature => resolve(parseFloat(temperature)))
        });
    }
}
