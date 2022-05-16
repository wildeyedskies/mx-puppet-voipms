// first we import needed stuffs
import {
	PuppetBridge,
	IPuppetBridgeRegOpts,
	Log,
	IRetData,
	Util,
	IProtocolInformation,
} from "mx-puppet-bridge";
import * as commandLineArgs from "command-line-args";
import * as commandLineUsage from "command-line-usage";
import { App } from "./app";
import { validatePhoneNumber } from './voipms';

// here we create the log instance using the bridges logging
const log = new Log("VoipMSPuppet:index");

// we want to handle command line options for registration etc.
const commandOptions = [
	{ name: "register", alias: "r", type: Boolean },
	{ name: "registration-file", alias: "f", type: String },
	{ name: "config", alias: "c", type: String },
	{ name: "help", alias: "h", type: Boolean },
];
const options = Object.assign({
	"register": false,
	"registration-file": "voipms-registration.yaml",
	"config": "config.yaml",
	"help": false,
}, commandLineArgs(commandOptions));

// if we asked for help, just display the help and exit
if (options.help) {
	// tslint:disable-next-line:no-console
	console.log(commandLineUsage([
		{
			header: "Matrix Voip MS Puppet Bridge",
			content: "A matrix puppet bridge for Voip MS",
		},
		{
			header: "Options",
			optionList: commandOptions,
		},
	]));
	process.exit(0);
}

// here we define some information about our protocol, what features it supports etc.
const protocol = {
	id: "voipms", // an internal ID for the protocol, all lowercase
	displayname: "VoipMS", // a human-readable name of the protocol
	externalUrl: "https://voip.ms",
} as IProtocolInformation;

// next we create the puppet class.
const puppet = new PuppetBridge(options["registration-file"], options.config, protocol);

// check if the options were to register
if (options.register) {
	// okay, all we have to do is generate a registration file
	puppet.readConfig(false);
	try {
		puppet.generateRegistration({
			prefix: "_voipmspuppet_",
			id: "voipms-puppet",
			url: `http://${puppet.Config.bridge.bindAddress}:${puppet.Config.bridge.port}`,
		});
	} catch (err) {
		// tslint:disable-next-line:no-console
		console.log("Couldn't generate registration file:", err);
	}
	process.exit(0);
}

// this is where we initialize and start the puppet
async function run() {
	await puppet.init(); // always needed, initialize the puppet

	// create our own protocol class
	const app = new App(puppet);

	// required: listen to when a new puppet is created
	puppet.on("puppetNew", app.newPuppet.bind(app));
	// required: listen to when a puppet is deleted
	puppet.on("puppetDelete", app.deletePuppet.bind(app));
	// required: listen to when a message is received from matrix
	puppet.on("message", app.handleMatrixMessage.bind(app));
	// optional: create room hook (needed for initiating DMs on matrix)
	puppet.setCreateRoomHook(app.createRoom.bind(app));
	// optional: get DM room ID hook (needed for initiating DMs on matrix)
	puppet.setGetDmRoomIdHook(app.getDmRoomId.bind(app));
	// required: get description hook
	puppet.setGetDescHook(async (puppetId: number, data: any): Promise<string> => {
		// here we receive the puppet ID and the data associated with that puppet
		// we are expected to return a displayable name for that particular puppet
		return `VoipMS puppet ${data.user} ${data.did}`;
	});
	// required: get data from string hook
	puppet.setGetDataFromStrHook(async (str: string): Promise<IRetData> => {
		// this is called when someone tires to link a new puppet
		// for us the str is our own name and if it is "invalid" it fails
		const retData: IRetData = {
			success: false,
		};

		const [ user, api_password, did ] = str.split(' ');
		if (!user || !api_password || !did) {
			retData.error = 'Usage: link <voip ms user> <voip ms api password> <did>';
			return retData;
		}

		if (!validatePhoneNumber(did)) {
			retData.error = 'Invalid DID. Format is ########## (I.E. 5555555555)';
		}

		retData.success = true;
		// this is the data that will be associated with that new puppet
		// usually this contains e.g. a login token to the remote protocol
		retData.data = {
			user,
			api_password,
			did
		};
		return retData;
	});
	// required: default display name of the bridge bot. TODO: change/remove
	puppet.setBotHeaderMsgHook((): string => {
		return "Voip MS Puppet Bridge";
	});

	// and finally, we start the puppet
	await puppet.start();
}

// tslint:disable-next-line:no-floating-promises
run();
