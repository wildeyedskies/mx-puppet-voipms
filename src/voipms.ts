import get from 'axios';
import * as moment from 'moment-timezone';
import { EventEmitter } from "events";
import { Log } from 'mx-puppet-bridge';

const log = new Log("VoipMSPuppet:voipms");

enum SmsType {
  Sent = 0,
  Received = 1
}

const API_URL = 'https://voip.ms/api/v1/rest.php'

export interface IVoipMSDetails {
  user: string
  api_password: string
  did: string
}

export interface IVoipMSSms {
  id: string
  date: string
  type: SmsType
  did: string
  contact: string
  message: string
}

export class Client extends EventEmitter {
  constructor(private data: IVoipMSDetails) {
    super();
  }

  smsCheckInterval?: any;

  public start() {
    // to accont for timing issues we run every 30 seconds, and check the past 35 seconds of messages
    // we then keep a single checks worth of cache so that we do not duplicate sending messages
    let lastRun: string[] = []
    this.smsCheckInterval = setInterval(async () => {
      log.debug('checking messages');

      const from = moment().subtract(1, 'minutes');
      const messages = await this.getMessages(SmsType.Received, from);
      log.debug(`fetched new messages since ${from} received ${JSON.stringify(messages)}`);

      let newMessages = messages.filter((m: IVoipMSSms) => !lastRun.includes(m.id));
      lastRun = newMessages.map((m: IVoipMSSms) => m.id);

      // we reverse the array here to get the messages in order
      newMessages.reverse().forEach((m: IVoipMSSms) => this.emit('message', m))
    }, 30000);
  }

  public stop() {
    if (this.smsCheckInterval !== undefined) {
      clearInterval(this.smsCheckInterval)
    }
  }

  async sendSMS(dst: string, message: string) {
    let _method = getMethod(message);
    log.verbose(`Sending message "${message}" to ${dst} via ${_method}`);

    return await get(API_URL, {
      params: {
        api_username: this.data.user,
        api_password: this.data.api_password,
        method: _method,
        did: this.data.did,
        dst,
        message
      }
    })
  }

  // See this issue for timezone explanation https://github.com/michaelkourlas/voipms-sms-client/issues/35
  async getSMS(type: SmsType, from: moment.Moment): Promise<IVoipMSSms[]> {
    const r = await get(API_URL, {
      params: {
        api_username: this.data.user,
        api_password: this.data.api_password,
        method: 'getSMS',
        type: type,
        did: this.data.did,
        from: from.tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'),
        timezone: -5
      }
    })

    if (r.data.status !== 'success') {
      return []
    }

    return r.data.sms
  }

  async getMessages(type: SmsType, from: moment.Moment): Promise<IVoipMSSms[]> {
    const r = await get(API_URL, {
      params: {
        api_username: this.data.user,
        api_password: this.data.api_password,
        method: 'getMMS',
        type: type,
        did: this.data.did,
        from: from.tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'),
        timezone: -5,
        all_messages: 1
      }
    })

    if (r.data.status !== 'success') {
      return []
    }

    return r.data.sms
  }
}

export function validatePhoneNumber(number: string): boolean {
  const validator = /^[0-9]{10}$/;
  return number.match(validator) !== null;
}

function getMethod(message: string) {
    let method = 'sendSMS'
    const emojiRegex = /\p{Emoji}/u;
    if (message.length >= 160 || emojiRegex.test(message)) {
        method = 'sendMMS'
    }

    return method;
}
