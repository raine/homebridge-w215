import request from 'then-request';
import {DOMParser} from 'xmldom';
import {HNAPMethod, HNAPResponse} from '../enum';
import {HMACMD5} from './hmac-md5';
import {InternetSettings} from '../type/internet-settings.type';

const HNAP1_XMLNS = 'http://purenetworks.com/HNAP1/';
const HNAP_METHOD = 'POST';
const HNAP_BODY_ENCODING = 'UTF8';

export class SoapClient {
  private readonly username: string;
  private readonly password?: string;
  private readonly url?: string;
  private auth = {result: '', challenge: '', publicKey: '', cookie: '', privateKey: ''};
  private authTries = 0;

  public logError?: (message) => void;
  public logInfo?: (message) => void;
  public logDebug?: (message) => void;

  constructor(url: string, password: string, username: string = 'admin', autoLogin: boolean = false) {
    this.username = username;
    this.password = password;
    this.url = url;

    if (autoLogin) {
      this.login().then();
    }
  }

  public login(): Promise<boolean> {
    if (!this.url) {
      throw new Error('No URL passed in constructor');
    }

    return request(HNAP_METHOD, this.url!,
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '"' + HNAP1_XMLNS + HNAPMethod.Login + '"',
        },
        body: SoapClient.buildRequestBody(HNAPMethod.Login, this.loginRequest),
      }).then((response) => {

      this.saveLoginResult(response.getBody(HNAP_BODY_ENCODING));
      const body = SoapClient.buildRequestBody(HNAPMethod.Login, this.loginParameters);

      return this.soapAction(HNAPMethod.Login, body, HNAPResponse.Login).then(response => {
        return (response === 'success');
      }).catch(err => {
        this._logError(err);
        return this.login();
      })
    });
  }

  public setState(isOn: boolean) {
    const body = SoapClient.buildRequestBody(HNAPMethod.SetState, SoapClient.buildControlParameters(1, isOn))
    return this.soapAction(HNAPMethod.SetState, body, HNAPResponse.SetResult);
  }

  public getState(): Promise<boolean> {
    const body = SoapClient.buildRequestBody(HNAPMethod.GetState, SoapClient.buildModuleParameters(1))
    return this.soapAction(HNAPMethod.GetState, body, HNAPResponse.GetState).then(result => {
      if (result === 'ERROR') {
        if (this.authTries >= 5) {
          throw new Error('Maximum login attempts exceeded');
        } else {
          this.authTries += 1;
          return this.getState();
        }
      }
      this.authTries = 0;
      return result === 'true';
    });
  }

  public getTemperature(): Promise<number> {
    const body = SoapClient.buildRequestBody(HNAPMethod.GetTemperature, SoapClient.buildModuleParameters(3));
    return this.soapAction(HNAPMethod.GetTemperature, body, HNAPResponse.Temperature).then(response => {
      if (!!response) {
        const parsed: number = parseFloat(response);

        if (!isNaN(parsed)) {
          return parsed;
        }
      }

      return -99;
    })
  }

  public getAPClientSettings() {
    const body = SoapClient.buildRequestBody(HNAPMethod.GetAPSettings, SoapClient.buildRadioParameters('RADIO_2.4GHz'));
    return this.soapAction(HNAPMethod.GetAPSettings, body);
  };

  public getInternetSettings(): Promise<InternetSettings | null> {
    const body = SoapClient.buildRequestBody(HNAPMethod.GetInternetSettings);
    return this.soapAction(HNAPMethod.GetInternetSettings, body).then((rawResponse) => {
      const doc = new DOMParser().parseFromString(rawResponse as string);

      const root = doc.getElementsByTagName('GetInternetSettingsResponse').item(0);

      if (!root) {
        return null;
      }

      const settings: InternetSettings = {
        type: 'Unknown',
        ipAddress: 'Unknown',
        hostname: 'Unknown',
        gateway: 'Unknown',
        subnetMask: 'Unknown',
        macAddress: 'Unknown',
        mtu: -1,
      };

      const type = root.getElementsByTagName('Type').item(0);
      const ipAddress = root.getElementsByTagName('IPAddress').item(0);
      const hostname = root.getElementsByTagName('HostName').item(0);
      const gateway = root.getElementsByTagName('Gateway').item(0);
      const subnetMask = root.getElementsByTagName('SubnetMask').item(0);
      const macAddress = root.getElementsByTagName('MacAddress').item(0);
      const mtu = root.getElementsByTagName('MTU').item(0);

      if (!!type && type.firstChild && !!type.firstChild.nodeValue) {
        settings.type = type.firstChild.nodeValue;
      }

      if (!!ipAddress && ipAddress.firstChild && !!ipAddress.firstChild.nodeValue) {
        settings.ipAddress = ipAddress.firstChild.nodeValue;
      }

      if (!!hostname && hostname.firstChild && !!hostname.firstChild.nodeValue) {
        settings.hostname = hostname.firstChild.nodeValue;
      }

      if (!!gateway && gateway.firstChild && !!gateway.firstChild.nodeValue) {
        settings.gateway = gateway.firstChild.nodeValue;
      }

      if (!!subnetMask && subnetMask.firstChild && !!subnetMask.firstChild.nodeValue) {
        settings.subnetMask = subnetMask.firstChild.nodeValue;
      }

      if (!!macAddress && macAddress.firstChild && !!macAddress.firstChild.nodeValue) {
        settings.macAddress = macAddress.firstChild.nodeValue;
      }

      if (!!mtu && mtu.firstChild && !!mtu.firstChild.nodeValue) {
        settings.mtu = parseInt(mtu.firstChild.nodeValue);
      }

      return settings;
    })
  }

  public isReady(): Promise<boolean> {
    const body = SoapClient.buildRequestBody(HNAPMethod.DeviceReadiness);
    return this.soapAction(HNAPMethod.DeviceReadiness, body, HNAPResponse.DeviceReady).then(state => {
      return (state === 'OK');
    })
  }

  private soapAction(method: HNAPMethod, body: any, responseElement: HNAPResponse | null = null) {
    return request(HNAP_METHOD, this.url || '',
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '"' + HNAP1_XMLNS + method + '"',
          'HNAP_AUTH': SoapClient.getAuthenticationParams('"' + HNAP1_XMLNS + method + '"', this.auth.privateKey),
          'Cookie': 'uid=' + this.auth.cookie,
        },
        body: body,
      })
      .then((response) => {
          this._logDebug(response.getBody(HNAP_BODY_ENCODING))

          if (!!responseElement && responseElement.length > 0) {
            return SoapClient.readResponseValue(response.getBody(HNAP_BODY_ENCODING), responseElement);
          }

          this.isReady().then(ready => {
            this._logInfo(`This device ${ready ? 'is' : 'is NOT'} ready`);
          });

          return response.getBody(HNAP_BODY_ENCODING);
        },
      ).catch((err) => {
        this._logError(err);
      });
  }

  private saveLoginResult(body) {
    const doc = new DOMParser().parseFromString(body);

    const authResult = doc.getElementsByTagName('LoginResult').item(0);
    const challenge = doc.getElementsByTagName('Challenge').item(0);
    const publicKey = doc.getElementsByTagName('PublicKey').item(0);
    const cookie = doc.getElementsByTagName('Cookie').item(0);
    const privateKey = doc.getElementsByTagName('Cookie').item(0);

    if (!!authResult && !!authResult.firstChild && !!authResult.firstChild.nodeValue) {
      this.auth.result = authResult.firstChild.nodeValue;
    }

    if (!!challenge && !!challenge.firstChild && !!challenge.firstChild.nodeValue) {
      this.auth.challenge = challenge.firstChild.nodeValue;
    }

    if (!!publicKey && !!publicKey.firstChild && !!publicKey.firstChild.nodeValue) {
      this.auth.publicKey = publicKey.firstChild.nodeValue;
    }

    if (!!cookie && !!cookie.firstChild && !!cookie.firstChild.nodeValue) {
      this.auth.cookie = cookie.firstChild.nodeValue;
    }

    if (!!privateKey && !!privateKey.firstChild && !!privateKey.firstChild.nodeValue) {
      this.auth.privateKey = HMACMD5.hex_hmac_md5(this.auth.publicKey + this.password, this.auth.challenge).toUpperCase();
    }
  }

  private _logError(message: any) {
    if (!!this.logError) {
      this.logError(message);
    } else {
      console.error(message);
    }
  }

  private _logInfo(message: any) {
    if (!!this.logInfo) {
      this.logInfo(message);
    } else {
      console.log(message);
    }
  }

  private _logDebug(message: any) {
    if (!!this.logDebug) {
      this.logDebug(message);
    } else {
      console.debug(message);
    }
  }

  private get loginRequest() {
    return '<Action>request</Action>'
      + '<Username>' + this.username + '</Username>'
      + '<LoginPassword></LoginPassword>'
      + '<Captcha></Captcha>';
  }

  private get loginParameters() {
    const login_pwd = HMACMD5.hex_hmac_md5(this.auth.privateKey, this.auth.challenge);
    return '<Action>login</Action>'
      + '<Username>' + this.username + '</Username>'
      + '<LoginPassword>' + login_pwd.toUpperCase() + '</LoginPassword>'
      + '<Captcha></Captcha>';
  }

  private static readResponseValue(body: any, elementName: string) {
    if (body && elementName) {
      const doc = new DOMParser().parseFromString(body);
      const node = doc.getElementsByTagName(elementName).item(0);
      return (node && node.firstChild) ? node.firstChild.nodeValue : 'ERROR';
    }
  }

  private static getAuthenticationParams(soapAction: string, privateKey: string) {
    const currentTime = new Date();
    const timestamp = Math.round(currentTime.getTime() / 1000);
    const auth = HMACMD5.hex_hmac_md5(privateKey, timestamp + soapAction);
    return auth.toUpperCase() + ' ' + timestamp;
  }

  private static buildRequestBody(method: HNAPMethod, parameters: any = '') {
    return '<?xml version="1.0" encoding="utf-8"?>' +
      '<soap:Envelope ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xmlns:xsd="http://www.w3.org/2001/XMLSchema" ' +
      'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
      '<soap:Body>' +
      '<' + method + ' xmlns="' + HNAP1_XMLNS + '">' +
      parameters +
      '</' + method + '>' +
      '</soap:Body></soap:Envelope>';
  }

  private static buildRadioParameters(radio: string) {
    return '<RadioID>' + radio + '</RadioID>';
  }

  private static buildModuleParameters(module: number) {
    return '<ModuleID>' + module + '</ModuleID>';
  }

  private static buildControlParameters(module: number, status: boolean) {
    return this.buildModuleParameters(module) +
      '<NickName>Socket 1</NickName><Description>Socket 1</Description>' +
      '<OPStatus>' + status + '</OPStatus><Controller>1</Controller>';
  }
}
