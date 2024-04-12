# Deprecated

It has been years since I wrote this. The mx-puppet-brige framework it is based upon is no longer well supported. I am not able to get the docker container to build anymore. I really don't recommend using this without forking and updating the dependencies at the very least.

# mx-puppet-voipms
This is a puppeting bridge for the SMS functionallity provided by [voip.ms](https://voip.ms).
It is based on [mx-puppet-bridge](https://gitlab.com/mx-puppet/mx-puppet-bridge).

Note that this bridge does not provide SIP or call functionallity and is only for bridging SMS messages and media files (pictures, videos).
Shortcode SMS are unsupported due to a limitation of the voip.ms API.

### what is voip.ms?

[voip.ms](https://voip.ms) is a voice over ip (voip) provider. They provide a REST api to send and receive SMS for users of their platform. Docs for the SMS capability are [here](https://wiki.voip.ms/article/SMS).

## Installation
```bash
git clone https://github.com/wildeyedskies/mx-puppet-voipms
cd mx-puppet-voipms
yarn install
yarn run build
```
Next copy the `sample.config.yaml` to `config.yaml`, edit it and then run `node build/index.js -r` to generate a registration file.
Register that one with synapse and start the bridge with `node build/index.js`.

## Usage
First you create a room with the bridge bot (`@_voipmspuppet_bot:YOURSERVER.COM`). Next you type `link <voip.ms username> <voip ms API password> <your voip ms phone number>`, e.g. `link youremail@example.org passw0rd 5551112222`.
It will say that a puppet with a certain ID was created.

You should then be able to receive SMS messages via matrix. Note that currently the bridge does not sync history and only checks for messages received while it is running. There will be a slight delay in receiving SMS as the bot only checks for new messages every 30 seconds. This is a limitation of the platform as voip.ms does not provide a real time API.

To initiate a conversation with a new number, create a direct message to a username with the format `@_voipmspuppet_$puppetId_$phonenumber:YOURSERVER.COM` 
e.g. `@_voipmspuppet_1_5551112222:YOURSERVER.COM`. Matrix should then show the user joining the room, at which point sending a message to the room will 
send an SMS to the corresponding phone number.

### Credits

A massive thank you to [Sorunome](https://github.com/Sorunome) for creating the [mx-puppet-bridge](https://gitlab.com/mx-puppet/mx-puppet-bridge) library.
