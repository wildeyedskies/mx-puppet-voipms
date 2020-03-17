import { PuppetBridge, IRemoteRoom, IMessageEvent, IReceiveParams, IRemoteUser } from "mx-puppet-bridge";
import { Client, IVoipMSSms } from "./voipms";

// this interface is to hold all data on a single puppet
interface IVoipMSPuppet {
	// this is usually a client class that connects to the remote protocol
	// as we just echo back, unneeded in our case
	client: Client;
}

// we can hold multiple puppets at once...
interface IVoipMSPuppets {
	[puppetId: number]: IVoipMSPuppet;
}

export class App {
    private puppets: IVoipMSPuppets = {};
    constructor(public puppet: PuppetBridge) {};

    public getSendParams(puppetId: number, did: string): IReceiveParams {
		return {
			room: {
				roomId: did,
				puppetId,
				isDirect: true,
			},
			user: {
				userId: did,
				puppetId,
			},
		} as IReceiveParams;
    }
    
    public newPuppet(puppetId: number, data: any) {
		// this is called when we need to create a new puppet
		// the puppetId is the ID associated with that puppet and the data its data
		if (this.puppets[puppetId]) {
			// the puppet somehow already exists, delete it first
			this.deletePuppet(puppetId);
		}
		// create a voip ms client
        const client = new Client(data);
        // handle each SMS message
        client.on("message", data => {
            this.handleSMSMessage(puppetId, data);
        });

		this.puppets[puppetId] = {
			client,
		};
		client.start();
    }
    
    public deletePuppet(puppetId: number) {
		// this is called when we need to delte a puppet
		const p = this.puppets[puppetId];
		if (!p) {
			// puppet doesn't exist, nothing to do
			return;
		}
		// stop the voip ms client
		p.client.stop();
		delete this.puppets[puppetId]; // and finally delete our local copy
	}

    public async handleMatrixMessage(room: IRemoteRoom, data: IMessageEvent, event: any) {
        		// first we check if the puppet exists
		const p = this.puppets[room.puppetId];
		if (!p) {
			return;
        }
        
        await p.client.sendSMS(room.roomId, data.body);
    }

    public async handleSMSMessage(puppetId: number, data: IVoipMSSms) {
        const params = this.getSendParams(puppetId, data.contact)
        await this.puppet.sendMessage(params, {
            body: data.message
        })
    }

    public async createRoom(room: IRemoteRoom): Promise<IRemoteRoom | null> {
		// this is called when the puppet bridge wants to create a new room
		// we need to validate that the corresponding roomId exists and, if not return null

		// first we check if the puppet exists
		const p = this.puppets[room.puppetId];
		if (!p) {
			return null;
		}
		// what we need to return is the same filled out information as in getSendParams
		// as our userIds are the same as our roomIds, let's just do that
		return this.getSendParams(room.puppetId, room.roomId).room;
	}

	public async getDmRoomId(user: IRemoteUser): Promise<string | null> {
		// this is called whenever someone invites a ghost on the matrix side
		// from the user ID we need to return the room ID of the DM room, or null if none is present

		// first we check if the puppet exists
		const p = this.puppets[user.puppetId];
		if (!p) {
			return null;
		}

		// now we just return the userId of the ghost
		return user.userId;
	}
}