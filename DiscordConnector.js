const rp = require('request-promise');
const Discord = require('discord.js');
const mime = require('mime-types');
const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');

const fs = require('fs');
const bingSpeech = require('bingspeech-api-client');
const lame = require('lame');


// @TODO: https://github.com/Microsoft/BotFramework-DirectLineJS/blob/master/src/directLine.ts#L384
// StartConversations
// @TODO: https://github.com/Microsoft/BotFramework-DirectLineJS/blob/master/src/directLine.ts#L463
// PostActivity
// There are other methods that need to be examined and then possible ported over.

// Embeds
// RichEmbeds <------ ------> RichCards
// But RichEmbeds don't have buttons
// When a bot adds a button to a card and sends it to the connector, 
// emit/reply with notice that RichEmbeds do not support Buttons/SuggestedActions

/**
 * Class that holds both the Direct Line websocket client and the Discord client.
 */
class DiscordConnector {

    constructor(config = {}) {
        this.discordSecret = config.discordSecret;
        this.dlSecret = config.dlSecret;
        this.token;
        this.conversationId;
        this.streamUrl;
        this.client = this.createDiscordClient();
        this.dlClient;
        this.dlConnection;
        this.discordConfig = config.discordConfig || {};
        if (!this.discordConfig.disabledEvents) {
            this.discordConfig.disabledEvents = ['typingStart', 'typingStop'];
        }
        this.botId = config.botId;
        this.botName = config.botName;

        /** TODO: Come up with a data store to use to handle conversations.
         *  - Because Direct Line doesn't provide a recepient field when sending an Activity to the DiscordConnector.
         */

        // We're storing the discordChannel and discordUser so that we can take activities received from the bot and send them to Discord
        this.discordChannel;
        this.discordUser; 

        this.voiceReceiver;
    } 

    /**
     * Creates Discord Client, then initiates connection with Discord servers using DiscordConnector.discordSecret
     * Throws an error if DiscordConnector.discordSecret is not found.
     */
    createDiscordClient () {
        if (!this.discordSecret) throw new Error('DiscordConnector.createDiscordClient - ERROR: Discord bot secret not found. Unable to complete connection to Discord servers.');
        var client = new Discord.Client(this.discordConfig).on('ready', () => { console.log('Connected to Discord Servers.')});
        client.login(this.discordSecret);
        return client;
    }

    /**
     * Enables basic relay. Calls DiscordConnector.postActivity(). Automatically disregards messages that come from other Discord Bot Accounts. (Note this is Bots that have been designated as a "bot account" by Discord.) Does not need to be called if user wishes to implement custom Discord event handling.
     */
    enableBasicRelay () {
        if (!this.client) return new Error('DiscordConnector.enableBasicRelay - ERROR: Discord Client not found.');
        if (!this.dlConnection) return new Error('DiscordConnector.enableBasicRelay - ERROR: Direct Line connection not found.');
        this.client.on('message', (msg) => {
            if (!msg.author.bot) {
                if (!this.discordChannel || this.discordChannel != msg.channel) {
                    this.discordChannel = msg.channel;
                    this.discordUser = msg.author;
                }
                
                this.postActivity(msg);          
            }
        });
    }

    /**
     * Generates a Direct Line Token and a conversationId. Returns a promise.
     * Future assumptions/checks will be based on the existence of a streamUrl from Direct Line, which this method does not set. To automatically initialize all required Direct Line parts, use DiscordConnector.createConversation().
     */
    createToken () {
        return rp({
            url: 'https://directline.botframework.com/v3/directline/tokens/generate',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + this.dlSecret
            },
            json: true
        }).then(res => {
            this.conversationId = res.conversationId;
            this.token = res.token;
        });
    }

    /**
     * Generates a Direct Line Token, conversationId and streamUrl. Returns a promise.
     * Future assumptions/checks will be based on the existence of a streamUrl from Direct Line, which this method will set in DiscordConnector.
     */
    createConversation () {
        return rp({
            url: 'https://directline.botframework.com/v3/directline/conversations',
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + (this.token || this.dlSecret)
            },
            json: true
        }).then(res => {
            if (!this.token) this.token = res.token;
            if (!this.conversationId) this.conversationId = res.conversationId;
            this.streamUrl = res.streamUrl;
        }).catch(err => {
            console.log('DiscordConnector.createConversation - ERROR: Request to Direct Line failed.');
            throw err;
        })
    }

    /**
     * Helper function that adds attachments received from Discord to Activity object to be sent to Direct Line. Manipulates the passed in Activity.
     * @param {Discord.MessageAttachment} message 
     * @param {Activity} activity 
     */
    discordAttachmentHandler (message, activity) {
        var atts = message.attachments;
        var keys = atts.keyArray();
        if (keys) {
            if (!activity.attachments) activity.attachments = []; // This should be removed and inside of the forEach-loop an array is created if an array of attachments doesn't exist on the activity.
            keys.forEach((key) => {
                var att = atts.get(key);
                activity.attachments.push({
                    contentType: this.getContentType(this.discordUrlParser(att.proxyURL)),
                    contentUrl: att.proxyURL,
                    name: att.filename
                });
            });
        }
    }
    
    /**
     * Converts Activity.Attachments to Discord-ready attachments. Calls DiscordConnector.richEmbedGenerator().
     * RIGHT NOW DISCORD ALLOWS A SINGLE PHOTO(ATTACHMENT?) PER MESSAGE
     * https://feedback.discordapp.com/forums/326712-discord-dream-land/suggestions/17614645-attach-multiple-photos-to-messages-and-choose-if-t
     * @param {*} activity 
     */
    dlAttachmentHandler (activity) {
        if (activity.attachmentLayout == 'carousel') console.log('WARN: carousel attachment layout not supported in Discord'); 
        var attachments = [];

        activity.attachments.forEach((att) => {
            // Examines received attachments to see if they are a RichCard
            var richEmbed = this.richEmbedGenerator(att);

            if (richEmbed) attachments.push(richEmbed);
            else if (Array.isArray(richEmbed)) attachments.concat(richEmbed);
            else {
                var file = {
                    file: att.contentUrl
                }
                attachments = file;
                return file;
            }

            if (att.contentType == 'image/png') {
                var image = new Discord.RichEmbed({
                    image: {
                        url: att.contentUrl,
                        proxyURL: att.contentUrl
                    }
                })
                console.log(image);
                attachments = image;
                
                return image;
            }
        });
        return attachments;
    }

    /**
     * Take a single rich card attachment of an activity and returns a new Discord.RichEmbed object.
     * Should we allow users to be able to modify this via passing in additional modules/replacement functions?
     * @param {*} attachment
     */
    richEmbedGenerator (attachment) {
        var att = attachment;
        if (!attachment) return;

        if (/application\/vnd.microsoft.card/.test(att.contentType)) {
            var richEmbed = new Discord.RichEmbed();
            var typeOfCard = att.contentType.split('application/vnd.microsoft.card.')[1];
            var data = att.content;
            
            if (data.title) richEmbed.setTitle(data.title);
            if (data.subtitle) richEmbed.setDescription(data.subtitle);
            if (data.description) richEmbed.addField('\u200B', data.description);

            switch (typeOfCard) {
                case 'adaptive':
                    console.warn('DiscordConnector.richEmbedGenerator - WARN: Adaptive Cards not yet supported at this time.\nDown-rendering using to use formatting for HeroCards.');
                case 'hero':
                    if (data.images) richEmbed.setImage(data.images[0].url);
                    //
                    break;
                case 'animation':
                    //
                    break;
                case 'audio':
                    console.error(new Error('DiscordConnector.richEmbedGenerator - ERROR: Discord does not support the playing of audio files.'));
                    break;
                case 'thumbnail':
                    if (data.images) richEmbed.setImage(data.images[0].url);
                    if (data.images.length > 1) console.error(new Error('DiscordConnector.richEmbedGenerator - ERROR: Discord RichEmbeds only support one image.'));
                    //
                    break;
                case 'receipt':
                    //
                    break;
                case 'signin':
                    //
                    break;
                case 'video':
                console.warn('DiscordConnector.richEmbedGenerator - WARN: Discord richEmbeds do not support video media. Down rendering to a simple embed.');
                    if (data.image && data.image.url) richEmbed.setImage(data.image.url); // Not sure if this is only video card that accepts one image.
                    if (data.media[0] && data.media[0].url) richEmbed.something;
                    var VideoEmbed = { }
                    VideoEmbed.url = data.media[0].url;
                    break;  
                default:
                    richEmbed = null;
                    console.error(new Error('DiscordConnector.discordEmbedGenerator() - ERROR: Card type not recognized.'));
            }

            // attachments.push(richEmbed);
            return richEmbed;
        }
    }

    /**
     * 
     * @param {*} attachment
     */
    embedGenerator (attachment) {

    }

    /**
     * Handles "guildMemberAdd" and "guildMemberRemove" events when a user is added/removed to a Guild/Server
     */
    conversationUpdate () {
        this.client.on('guildMemberAdd', (member) => {
            if (member.user.bot) return;
            var activity = {
                type: 'conversationUpdate',
                membersAdded: [
                    {
                        id: member.id,
                        name: member.displayName
                    }
                ],
                from: {
                    id: member.id,
                    name: member.displayName
                }
            }
            // This next line adds the user to the cached users in the bot.
            if (!this.client.usersg.get(member.id)) this.client.users.set(member.id, member.user);
            this.postActivity(activity);
        });

        this.client.on('guildMemberRemove', (member) => {
            if (member.user.bot) return;
            var activity = {
                type: 'conversationUpdate',
                membersRemoved: [
                    {
                        id: member.id,
                        name: member.displayName
                    }
                ],
                channelId: 'discord',
                from: {
                    id: member.id,
                    name: member.displayName
                }
            }
            // This next line removes the user from the cached users in the bot.
            if (this.client.users.get(member.id)) this.client.users.delete(member.id);
            this.postActivity(activity);
        });
    }

    /**
     * Replaces Discord-style @mentions with the user's name if they have been cached in DiscordConnector.client.
     * If not, processMention returns the Discord-style @mention.
     * Used in DiscordConnector.postActivity().
     * @param {string} content 
     */
    processMention (content) {
        if (typeof content != 'string' || content.trim() != true) return;

        var newContent = content.replace(/<@\d{18}>/gm, (match, offset, string) => {
            var userId = /\d{18}/.exec(match)[0];
            var userName = '';
            if (this.client.users.get(userId)) {
                userName = this.client.users.get(userId).username;
            }
            return userName ? userName : match;
        });
        return newContent;
    }

    /** 
     * Returns DiscordConnector.client.users() as an Array if it exists.
     */
    getUsers () {
        if (!this.client.users.first()) return new Error('DiscordConnector.getUsers - ERROR: No users cached in connector.');
        else return this.client.users.array();   
    }

    /**
     * Instantiates a new websocket connection using the streamUrl received from Direct Line.
     */
    dlWebSocketHandler () {
        console.log('Starting WebSocket Client for message streaming on conversationId: ' + this.conversationId);

        return new Promise((resolve, reject) => {
            this.dlClient = new (require('websocket').client)();
            this.dlClient.on('connectFailed', (error) => {
                console.log('DiscordConnector.dlWebSocketHandler - ERROR: ' + error.toString());
                reject(error);
            });

            this.dlClient.on('connect', (connection) => {
                console.log('WebSocket Client Connected');
                this.dlConnection = connection;
                this.dlConnection.on('error',  (error) => {
                    console.log("Connection Error: " + error.toString());
                    reject(error);
                });
                this.dlConnection.on('close',  () => {
                    console.log('WebSocket Client Disconnected');
                });
                this.dlConnection.on('message', (msg) => {
                    if (msg.type === 'utf8' && msg.utf8Data.length > 0) {
                        var data = JSON.parse(msg.utf8Data);
                        var activities = data.activities;

                        activities = this.deleteUserData(activities);

                        // This prevents any action from being undertaken on a message sent from a user to a bot.
                        if (activities[0].from.name !== 'squawk-box-bot') return; 
                        
                        console.log('~~~\nMessage received from DirectLine. See below:');
                        console.log('Activity.from:');
                        console.log(activities[0].from);
                        if (activities[0].type == 'typing') {
                            this.discordChannel.startTyping();
                            return;
                        }
                        console.log('~~~');
                        if (data.activities[0].recipient) {
                            console.log('This is the activity\'s recipient');
                            console.log(data.activities[0].recipient);
                        }

                        // activities is an array of activities, and activities[i].attachments is an array of attachments

                        if (activities[0].attachments) {
                            var bot = this.client.user;
                            var embed = this.dlAttachmentHandler(activities[0]);
                            console.log('Right below me is the "embed":')
                            console.log(embed);

                            if (embed instanceof Discord.RichEmbed) {
                                this.discordChannel.send({ embed: embed }).catch((err) => {
                                    console.log('ERROR IN DLWEBSOCKET ON SENDING RICH MEDIA FROM BOT');
                                    console.log(err);
                                })
                            }
                            else if (embed instanceof Array) {
                                embed.forEach((e) => {
                                    this.discordChannel.send({ embed: e }).catch((err) => {
                                        console.log('ERROR IN DLWEBSOCKET ON SENDING RICH MEDIA FROM BOT');
                                        console.log(err);
                                    })
                                })
                            }

                            else if (typeof embed == 'object' && !(embed instanceof Discord.RichEmbed)) {
                                this.discordChannel.send(embed);
                            } else {
                                this.discordChannel.send({ file: activities[0].attachments[0].contentUrl });
                            }

                            console.log('~~~\nLook at the attachments from the first activity received');
                            console.log(activities[0].attachments);
                        }

                        if (activities[0].from.name == 'squawk-box-bot' && this.discordChannel /* If attachments from activity, skip this step. */ && !activities[0].attachments) {
                            console.log('\nI send something to you.');
                            if (activities[0].text) {
                                this.discordChannel.send(activities[0].text).catch((err) => {
                                    console.log('ERROR IN DL WEBSOCKET');
                                    console.error(err);
                                })
                            }
                        }
                    }
                });
                resolve(); // This needs adjusting
            });
            this.dlClient.connect(this.streamUrl);
        })
    }

    activityAttachmentsHandler (activity, message) {
        if (Array.isArray(activity.attachments) && activity.attachments.length > 0) {
            activity.attachments.forEach((att) => {

            })
        }
    }

    /**
     * WIP: Need to figure out which user to delete if more than one user exists in the conversation. Not implemented due to the lack of multiple user data store.
     * Need to store data for the user inside of a Redis Cache, because Direct Line does not return a recepient field in its activitites.
     * @param {*} activities 
     */
    deleteUserData (activities) {
        activities.map((a, idx, atts) => {
            if (a.type == 'deleteUserData') {

                if (a.text) {
                    this.postActivity
                }
                atts[idx] 
                // Comparison on the conversation ID, 
                // do a call to the state store (probably Redis for now?)
                // Retrieve the user's Discord User ID from Redis,
                // then this.client.users.delete(userId)
                
            } 
        });
    }

    /**
     * This method needs to go inside of the event handlers for Discord Events. This event may need to be overloaded to account for all of the different types of events that go on...
     * How would this look? Perhaps DiscordConnector.Guild = require('./Guild'); OR DiscordConnector.Guild = new (require('./Guild'));
     */
    postActivity (event) {
        
        var activity = {};
        if (event.type == 'conversationUpdate') {
            activity = event;
        } else {
            activity = {
                from: {
                    id: event.author.id,
                    name: event.author.username
                },
                type: 'message',
                text: this.processMention(event.content)
            }
            this.discordAttachmentHandler(event, activity);
        }

        return rp({
            url: 'https://directline.botframework.com/v3/directline/conversations/' + this.conversationId + '/activities',
            method: 'POST',
            headers: { Authorization: 'Bearer ' + this.dlSecret },
            body: activity,
            json: true
        }).then((res) => {
            console.log('response from directline' + res);
        });
    }

    /**
     * This method takes activities from the DirectLine Connection and converts them to Discord Events 
     * This event may need to be overloaded to account for all of the different types of events that go on...
     * Or perhaps another class needs to be created to handle guild events, user events, and so on and so forth...
     * How would this look? Perhaps DiscordConnector.Guild = require('./Guild'); OR DiscordConnector.Guild = new (require('./Guild'));
     * & DiscordConnector.Message = require('./Message'); OR DiscordConnector.Message = new (require('./Message'));
     * & DiscordConnector.Channel = require('./Channel'); OR DiscordConnector.Channel = new (require('./Channel'));
     */
    postEvent (activity) {
        // If the activity is not from the bot, we don't want to send an event from Discord (otherwise we're just repeating what we heard)
        if (this.botName != activity.from.name) return;
    }

    /**
     * WIP: Need to figure out which user to delete if more than one user exists in the conversation. Not implemented due to the lack of multiple user data store.
     * @param {string} activityType 
     */
    deleteUserData (activityType) {
        if (activityType == 'deleteUserData') {
            if (this.client.users.get) {

            }
        }
    }

    /**
     * Helper function that returns attachment's MIME-type via file extension provided by Discord
     * @param {string} filename 
     */
    getContentType (filename) {
        return mime.lookup(filename) ? mime.lookup(filename) : 'unknown/unknown';
    }

    /**
     * URL parser for Discord-sent attachments. To be used in conjunction with DiscordConnector.getContentType()
     * @param {string} url 
     */
    discordUrlParser (url) {
        var parsedProxy = url.split(/https:\/\/media.discordapp.net\/attachments\/\d{18}\/\d{18}\//);
        var parsedUrl = url.split(/https:\/\/cdn.discordapp.com\/attachments\/\d{18}\/\d{18}\//);
        var filename = parsedProxy.length > parsedUrl.length ? parsedProxy[1] : parsedUrl[1];
        if (!filename) {
            console.warn('DiscordConnector.discordUrlParser - WARN: filename for attachment from Discord not found.');
            return;
        }
        return filename;
    }

    /**
     * Adds listener to Discord Client for bot to join user's voice channel on command.
     * If not provided, `prefix` defaults to "!". `postActivity` defaults to true, sending the command to bot. 
     * @param {string} prefix 
     * @param {boolean} postActivity
     */
    joinVoiceChannelOnCommand (prefix = '!', postActivity = true) {
        this.client.on('message', (msg) => {
            console.log('Listener in place.');
            if (!msg.author.bot) {
                console.log('user is not bot');
                if (msg.member.voiceChannel && msg.member.voiceChannel.joinable) {
                    msg.member.voiceChannel.join()
                    .then(voiceConnection => {
                        this.voiceConnection = voiceConnection;
                        this.voiceReceiver = voiceConnection.createReceiver();
                        this.voiceStream = this.voiceReceiver.createPCMStream(msg.author);
                        var data;

                        var bingSpeech = require('bingspeech-api-client');
                        var client = new bingSpeech.BingSpeechClient('8d925ceb8676441ab73c21494f3d96fc');
                        var encoder = new lame.Encoder({
                            channels: 2,
                            bitDepth: 16,

                            bitRate: 128,
                            mode: lame.STEREO
                        })
                        this.voiceStream.pipe(encoder);

                        encoder.on('data', chunk => {
                            encoder.push(chunk);
                            console.log('encoder.on("data"): ' + chunk);
                        })

                        // var duplexStream = new stream.Duplex()
                        // duplexStream._read = function (data, enc, callback) {
                        //     duplexStream.push(data);
                        // }

                        // duplexStream._write = function (data, enc, next) {
                        //     duplexStream.push(data);
                        //     next();
                        // }
                        // this.voiceStream.pipe(duplexStream); 

                        ffmpeg(this.voiceStream)
                            .inputFormat('s32le')
                            .audioFrequency(16000)
                            .audioChannels(1)
                            .audioCodec('pcm_s16le')
                            .format('s16le')
                            .on('error', err => { throw err; })
                            .pipe(encoder)
                        
                        this.voiceReceiver.on('pcm', (user, buffer) => {
                            data += buffer.toString('utf8');
                        });
                        this.voiceConnection.on('speaking', (userSpeaking) => {
                            if (userSpeaking) {
                                console.log('Someone is speaking!');
                            }
                            if (!userSpeaking) {
                                console.log('Someone isn\'t speaking...');
                            }
                        });
                        
                    })
                    .catch(err => {
                        console.error('L608 DiscordConnector.joinVoiceChannelOnCommand - ERROR: ' + err);
                        throw err;
                    })
                }
                if (!this.discordChannel || this.discordChannel != msg.channel) {
                    this.discordChannel = msg.channel;
                    this.discordUser = msg.author;
                }

                if (msg.content.includes(prefix + 'join-v')) {
                    msg.reply('I am here!');
                }
            }
        })
    }
}

exports.DiscordConnector = DiscordConnector;