/**
 * Adds listener to Discord Client for bot to join user's voice channel on command.
 * If not provided, `prefix` defaults to "!". `postActivity` defaults to true, sending the command to bot. 
 * @param {*} connector
 * @param {string} prefix 
 * @param {boolean} postActivity
 */
function joinVoiceChannelOnCommand (connector, prefix = '!', postActivity = true) {
    connector.client.on('message', (msg) => {
        console.log('Listener in place.')
        if (!msg.author.bot) {
            console.log('user is not bot')
            if (msg.member.voiceChannel.joinable) {
                msg.member.voiceChannel.join()
                .then(voiceConnection => {
                    connector.voiceConnection = voiceConnection;
                    connector.voiceReceiver = voiceConnection.createReceiver();
                    connector.voiceStream = connnector.voiceReceiver.createPCMStream(msg.author);

                    voiceConnection = connector.voiceConnection;
                    voiceReceiver = connector.voiceReceiver;
                    voiceStream = connector.voiceStream;

                    voiceReceiver.on('pcm', (user, buffer) => {
                        console.log('listening');
                    });
                    connector.BingClient = new stt(process.env.BING_SPEECH_KEY, {
                        format:'simple',
                        language:'en-US'
                    });
                    connector.BingClient.on('connect', () => {
                        console.log('Bing Speech API WebSocket set up.');
                        connector.BingClient.startDetection(connector.voiceStream);
                    })
                    connector.BingClient.on('data', data => {
                        console.log('>>> Data received: ' + data);
                    })
                    connector.BingClient.on('recognized', event => {
                        console.log('==================================');
                        console.log(e);
                        console.log('==================================');
                    })

                    connector.BingClient.open();                    
                })
                .catch(err => {
                    console.error('DiscordHelperModule.joinVoiceChannelOnCommand - ERROR: ' + err);
                    throw err;
                })
            }
            if (!connector.discordChannel || connector.discordChannel != msg.channel) {
                connector.discordChannel = msg.channel;
                connector.discordUser = msg.author;
            }
            if (msg.content.includes(prefix + 'join-v')) {
                msg.reply('I am here!');
            }
        }
    })
}
exports.joinVoiceChannelOnCommand = joinVoiceChannelOnCommand;

function leaveVoiceChannelOnCommand (connector, prefix ='!', postActivity = true) {
    connector.client.on('message', message => {
        if (message.content == prefix + 'leave-voice') {

            if (message.member.voiceChannel.members.get(connector.client.user.id)) {
                message.reply('I am not a member of this channel!');
            }
            if (message.member.voiceChannel && message.member.voiceChannel.joinable) {

            } else if (message.member.voiceChannel) {

            } else {
                message.reply
            }
        }
    });
}
exports.leaveVoiceChannelOnCommand = leaveVoiceChannelOnCommand;

function joinVoiceChannelOnUpdate () {
    this.client.on('voiceStateUpdate', (oldStateUser, newStateUser) => {

    });
}
exports.joinVoiceChannelOnUpdate = joinVoiceChannelOnUpdate;

function getUsers (connector) {
    connector.client.on('message', (message) => {
            if (message.content == '!get-users') {
                var users = connector.client.users.array();
                users.forEach((user) => {
                    message.channel.send('User: ' + user.username + ', ID: ' + user.id);
                })
            }
        })
}
exports.getUsers = getUsers;

/**
 * Handles 'voiceStatusUpdate' events
 */
function voiceConversationUpdate () {

}

/**
 * Adds listener to Direct Line web socket connection to listen for "typing" Activities and send "typing" indicators to Discord.
 * Returns DiscordConnector.
 * @param {*} connector 
 */
function enableTyping (connector) {
    if (!connector.dlConnection) throw new Error('HelperModule.enableTyping() - ERROR: Direct Line connection not found.');
    
    connector.dlConnection.on('message', (msg) => {
        if (msg.type === 'utf8' && msg.utf8Data.length > 0) {
            var data = JSON.parse(msg.utf8Data);
            var activities = data.activities;

            activities.forEach((activity) => {
                if (activity.type == 'typing') {
                    connector.discordChannel.startTyping();
                    setTimeout(() => {
                        connector.discordChannel.stopTyping();
                    }, 2000);
                }
            })
        }
    });
    return connector;
}
exports.enableTyping = enableTyping;