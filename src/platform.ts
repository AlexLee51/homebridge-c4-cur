import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { EventEmitter } from 'events';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

import { WindowCoveringAccessory } from './Accessory/WindowCoveringAccessory';

import { C4Socket } from './C4Socket';
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  private cresKit!: C4Socket;
  private activeIds: string[] = [];
  eventEmitter!: EventEmitter;
  public openGetStatus = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);
    this.eventEmitter = new EventEmitter();
    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
     * 等待指定的时间
     * @param ms
     */
  async sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve('');
      }, ms);
    });
  }


  handleData(data: string) {
    const msgArr = data.toString().split('*');
    for (const msg of msgArr) {
      const msgDataArr = msg.toString().split(':');
      if (msgDataArr[0].trim() !== '') {
        this.log.debug(`received data from crestron: ${msgDataArr}`);
        const emitMsg = `${msgDataArr[0]}:${msgDataArr[1]}:${msgDataArr[2]}`;
        //this.log.info(`emit message: ${emitMsg}`);
        this.eventEmitter.emit(emitMsg, parseInt(msgDataArr[3]));
      }
    }
  }

  sendData(data: string) {
    //this.log.debug(`send data to crestron: ${data}`);
    this.cresKit.writeData(data);
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);

  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {

    const configWindowCoverings = this.config['WindowCovering'];



    this.registerDevices(configWindowCoverings, 'WindowCovering');
  

    // 删除未使用的配件
    this.accessories
      .filter((value) => !this.activeIds.find((id: string) => id === value.UUID))
      .map(accessory => {
        this.log.info('Deleting accessory ' + accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      });

    this.log.info('                                                              ');
    this.log.info('**************************************************************');
    this.log.info('           testtest');
    this.log.info('  testtest  ');
    this.log.info('                                         testtest  ');
    this.log.info('**************************************************************');
    this.log.info('                                                              ');

    this.cresKit = new C4Socket(this.config['port'], this.config['host'], this);
  }

  registerDevices(configDevices, deviceType: string) {
    if (configDevices !== undefined) {
      for (const device of configDevices) {

        // generate a unique id for the accessory this should be generated from
        // something globally unique, but constant, for example, the device serial
        //如果更改了config中的id，会重新生成一个uuid，设备的缓存也会被删除，分配的房间也会被重新分配到桥接的房间
        //如果没有在手机端改名的话，可以在config改名并且自动进行更新
        const uuid = this.api.hap.uuid.generate(deviceType + device.id.toString());

        // see if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          // the accessory already exists
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

          // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
          existingAccessory.context.device = device;
          existingAccessory.displayName = device.name;
          // create the accessory handler for the restored accessory
          // this is imported from `platformAccessory.ts`
          switch (deviceType) {
            case 'WindowCovering':
            {
              new WindowCoveringAccessory(this, existingAccessory, this.eventEmitter);
              break;
            }
          }
          this.api.updatePlatformAccessories([existingAccessory]);
          this.activeIds.push(uuid);

        } else {
          // the accessory does not yet exist, so we need to create it
          this.log.info(`adding new accessory: ${device.name}`);

          // create a new accessory
          const accessory = new this.api.platformAccessory(device.name, uuid);

          // store a copy of the device object in the `accessory.context`
          // the `context` property can be used to store any data about the accessory you may need
          accessory.context.device = device;

          // create the accessory handler for the newly create accessory
          // this is imported from `platformAccessory.ts`
          switch (deviceType) {
            
            case 'WindowCovering':
            {
              new WindowCoveringAccessory(this, accessory, this.eventEmitter);
              break;
            }
          }
          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.activeIds.push(uuid);
        }
      }
    }
  }
}

