import {
  Service,
  CharacteristicValue,
  AccessoryPlugin,
  Logging,
  HAP,
  AccessoryConfig, API, CharacteristicEventTypes, CharacteristicGetCallback, CharacteristicSetCallback,
} from 'homebridge';
import {SoapClient} from './lib/soap';

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory('DSP-W215', PlugAccessory);
};

class PlugAccessory implements AccessoryPlugin {
  private readonly outletService: Service;
  private readonly temperatureService: Service;
  private readonly informationService: Service;

  private readonly username?: string;
  private readonly password?: string;
  private readonly plugURL?: string;

  private currentPowerState?: boolean;
  private currentTemperature?: number;
  private soapClient: SoapClient;

  constructor(
    private log: Logging,
    private config: AccessoryConfig,
    private api: API,
  ) {
    this.username = this.config.username || 'admin';
    this.password = this.config.password;
    this.plugURL = 'http://' + this.config.host + '/HNAP1';

    this.soapClient = new SoapClient(this.plugURL, this.password!, this.username);
    this.soapClient.logError = (message) => {
      this.log.error(message);
    };

    this.soapClient.logDebug = (message) => {
      this.log.debug(message);
    };

    this.soapClient.logInfo = (message) => {
      this.log.info(message);
    };

    this.outletService = new hap.Service.Outlet(this.config.name);
    this.temperatureService = new hap.Service.TemperatureSensor(this.config.name + ' Temperature');
    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, 'D-Link')
      .setCharacteristic(hap.Characteristic.Model, 'DSP-W215')
      .setCharacteristic(hap.Characteristic.SerialNumber, this.password || 'Default-Serial');

    this.authenticate().then(state => {
      this.soapClient.getInternetSettings().then(settings => {
        if (settings) {
          this.log.debug(`Settings retrieved: ${JSON.stringify(settings)}`);
          this.informationService.updateCharacteristic(hap.Characteristic.Model, settings.hostname);
          this.informationService.updateCharacteristic(hap.Characteristic.SerialNumber, settings.macAddress);
        }
      });

      this.log.debug(`Initial login state: ${state}`);
      this.soapClient.isReady().then(readyState => {
        this.log.debug(`Ready State: ${readyState ? 'Ready' : 'Not Ready'}`);

        this.outletService.getCharacteristic(hap.Characteristic.On)
          .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
            this.soapClient.getState().then(isOn => {
              this.currentPowerState = isOn;
              this.log.debug('Current state of the switch was returned: ' + (isOn ? 'ON' : 'OFF'));
              callback(undefined, this.currentPowerState);
            });
          })
          .on(CharacteristicEventTypes.SET, (newValue: CharacteristicValue, callback: CharacteristicSetCallback) => {
            this.log.debug(`Setting new state: ${newValue}`);
            this.soapClient.setState(newValue as boolean).then(() => {
              this.currentPowerState = newValue as boolean;
              this.log.debug('Current state of the switch was set: ' + (this.currentPowerState ? 'ON' : 'OFF'));
              callback();
            });
          });

        this.temperatureService.getCharacteristic(hap.Characteristic.CurrentTemperature)
          .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
            this.soapClient.getTemperature().then(temperature => {
              this.currentTemperature = temperature;
              this.log.debug('Current temperature of the switch was returned: ' + temperature);
              callback(undefined, this.currentTemperature);
            });
          });
      });
    });
  }

  identify(): void {
    this.log.info('DSP-W215 Identified!');
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.outletService,
      this.temperatureService,
    ];
  }

  authenticate() {
    this.log.debug('Logging in to DSP-W215...');
    return this.soapClient.login();
  }
}
