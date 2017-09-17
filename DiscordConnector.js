const rp = require('request-promise');
const Discord = require('discord.js');
const mime = require('mime-types');

/**
 * Class that holds both the Direct Line websocket clients and the Discord client.
 */
class DiscordConnector {

    constructor(config = {}) {
        this.discordSecret = config.discordSecret;
        this.dlSecret = config.dlSecret;
        this.token;
        this.client = this.createDiscordClient();
        this.dlClients = new Map();
        this.discordConfig = config.discordConfig || {};
        if (!this.discordConfig.disabledEvents) {
            this.discordConfig.disabledEvents = ['typingStart', 'typingStop'];
        }
        this.botId = config.botId;
        this.botName = config.botName;
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
     * Adds an instantiated ConnectorStorage to the Discord Connector instance
     * @param {*} client 
     */
    addStorageClient (client) {
        this.storageClient = client;
        return this;
    }

    /**
     * Enables basic relay. Calls DiscordConnector.postActivity(). Automatically disregards messages that come from other Discord Bot Accounts. (Note this is Bots that have been designated as a "bot account" by Discord.) Does not need to be called if user wishes to implement custom Discord event handling.
     */
    enableBasicRelay () {
        if (!this.client) return new Error('DiscordConnector.enableBasicRelay - ERROR: Discord Client not found.');
        this.client.on('message', (msg) => {
            if (!msg.author.bot) {
                this.getConversationData({}, msg).then(data => {
                    var conversationId = this.getConversationId(data);
                    console.log('DiscordConnector - Message received from user in conversation: ' + conversationId);
                    // var token = this.client.channels.get(conversationId).token;
                    this.postActivity(msg, conversationId)
                        .catch(err => {
                            console.error('DiscordConnector.dlWebSocketHandler - ERROR:');
                            throw err;
                        });
                }).catch(err => {
                    throw err;
                })
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
                Authorization: 'Bearer ' + this.dlSecret
            },
            json: true
        });
    }

    /**
     * 
     * @param {*} activity 
     * @param {*} event 
     */
    setConversationData (activity, event) {
        if (!this.storageClient) throw new Error('You must provide a StorageClient to use the Connector!');
        if (!activity || !event) throw new Error('You need both a Direct Line Conversation ID and a Discord Channel ID to save data!');
        return new Promise((resolve, reject) => {
            var data = this.storageClient.saveData(activity, event, data => {
                resolve(data);
            });
        })
    }

    /**
     * Attempts to retrieve the Direct Line Conversation ID when given with an activity or the Discord Channel ID when given an event. If a matching entry is not found, it creates a new entry.
     * @param {*} activity 
     * @param {*} event 
     */
    getConversationData (activity, event) {
        if (!this.storageClient) throw new Error('DiscordConnector.getConversationData - ERROR: You must provide a StorageClient to use the Connector!');
        return new Promise ((resolve, reject) => {
            this.storageClient.getData(activity, event, data => {
                if (!data || !data.id) {
                    return this.createConversation().then(dlResult => {
                        this.setConversationData({ conversation: { id: dlResult.conversationId } }, event)
                            .then(data => {
                                this.dlWebSocketHandler(dlResult.conversationId, dlResult.streamUrl);
                                resolve({ id: dlResult.conversationId + '|' + event.channel.id });
                            })
                            .catch(err => {
                                console.log('DiscordConnector.getConversationData - ERROR:');
                                throw err;
                            })
                    });
                } else if (data && data.id) {
                    return this.renewConversation(this.getConversationId(data)).then(dlResult => {
                        if (!this.dlClients.get(dlResult.conversationId)) {
                            this.dlWebSocketHandler(dlResult.conversationId, dlResult.streamUrl);
                        }
                        resolve(data);
                    });
                }    
            })
        })
    }

    /**
     * To be used with setConversationData and getConversationData
     * To be used with getConversationData when sending an Activity from Direct Line to Discord
     * @param {*} data 
     * @returns {string}
     */
    getChannelId (data) {
        if (!data) return;
        var parsedIds = data.id.split('|');
        return parsedIds.length > 1 ? parsedIds[1] : new Error();
    }

    /**
     * To be used with setConversationData and getConversationData
     * To be used with getConversationData when sending an event from Discord to Direct Line
     * @param {*} data 
     * @returns {string}
     */
    getConversationId (data) {
        if (!data) return;
        var parsedIds = data.id.split('|');
        return parsedIds.length == 2 ? parsedIds[0] : new Error();
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
            var simpleEmbed = {};
            
            if (data.title) richEmbed.setTitle(data.title);
            if (data.subtitle) richEmbed.setDescription(data.subtitle);
            if (data.text) richEmbed.addField('\u200B', data.text);

            switch (typeOfCard) {
                case 'adaptive':
                    console.warn('DiscordConnector.richEmbedGenerator - WARN: Adaptive Cards not yet supported at this time.\nDown-rendering using to use formatting for HeroCards.');
                case 'hero':
                    if (data.images) richEmbed.setImage(data.images[0].url);
                    //
                    break;
                case 'animation':
                    // Gifs are supported
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
                    console.warn('DiscordConnector.richEmbedGenerator - WARN: Discord richEmbeds do not support video media. Down rendering to a simple embed. Data may be lost.');
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
        var attchs;
        if (!attachment.content) {
            var data = attachment;
            if (data.media) {
                attchs = data.media.map((url) => {
                    return { url: url }
                })
                return attchs;
            }
        } else {
            var data = attachment.content;

        }
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
        if (typeof content != 'string' || !content.trim()) {
            console.log('DiscordConnector.processMention() - ERROR: Valid content not detected.');
            return;
        }

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
     * Used to renew Direct Line Conversations. Returns a websocket URL.
     * @param {string} conversationId
     * @returns {*} 
     */
    renewConversation (conversationId) {
        return rp({
            url: 'https://directline.botframework.com/v3/directline/conversations/' + conversationId,
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + this.dlSecret
            },
            json: true
        }).then(res => {
            if (!this.token) this.token = res.token;
            return res
        }).catch(err => {
            console.log('DiscordConnector.renewConversation - ERROR: Request to Direct Line failed.');
            throw err;
        });
    }

    /**
     * Instantiates a new websocket connection using the streamUrl received from Direct Line.
     */
    dlWebSocketHandler (conversationId, streamUrl) {
            console.log('Starting WebSocket Client for message streaming on conversationId: ' + conversationId);

            return new Promise((resolve, reject) => {
                this.dlClients.set(conversationId, { 
                    ws: new (require('websocket').client)(),
                    connection: null
                });
                var dlSocket = this.dlClients.get(conversationId);

                dlSocket.ws.on('connectFailed', err => {
                    console.log('DiscordConnector.dlWebSocketHandler - ERROR: ' + err.toString());
                    reject(err);
                });

                dlSocket.ws.on('connect', connection => {
                    console.log('DiscordConnector.dlWebSocketHandler - WebSocket Client connected for conversation ' + conversationId);

                    dlSocket.connection = connection;
                    dlSocket.connection.on('error',  err => {
                        console.log("DiscordConnector.dlWebSocketHandler - Connection Error: " + err.toString());
                        reject(err);
                    });
                    dlSocket.connection.on('close',  () => {
                        console.log('DiscordConnector.dlWebSocketHandler - WebSocket Client disconnected');
                    });
                    dlSocket.connection.on('message', msg => {
                        if (msg.type === 'utf8' && msg.utf8Data.length > 0) {
                            var data = JSON.parse(msg.utf8Data);
                            var activities = data.activities;
                            activities.forEach(activity => {
                                if (activity.from.name == this.botName) return
                            })
                            for (var idx in activities) {
                                var activity = activities[idx];
                                
                                this.getConversationData(activity, null).then(state => {
                                    var channelId = this.getChannelId(state);
                                    var channel = this.client.channels.get(channelId);
                                    var embed;

                                    if (activity.type == 'typing') {
                                        channel.startTyping();
                                        return;
                                    };

                                    if (Array.isArray(activity.attachments) && activity.attachments.length > 0) {
                                        console.log('~~~\nLook at the attachments from the first activity received');
                                        console.log(activities[0].attachments);
                                        embed = this.dlAttachmentHandler(activity);
                                        console.log('\nRight below me is the "embed":');
                                        console.log(embed);                                     
                                    }

                                    if (embed instanceof Discord.RichEmbed) {
                                        channel.send({ embed: embed }).catch((err) => {
                                            console.log('ERROR IN DLWEBSOCKET ON SENDING RICH MEDIA FROM BOT');
                                            console.log(err);
                                        }) 
                                    } else if (embed instanceof Array) {
                                        embed.forEach((e) => {
                                            channel.send({ embed: e }).catch((err) => {
                                                console.log('ERROR IN DLWEBSOCKET ON SENDING RICH MEDIA FROM BOT');
                                                console.log(err);
                                            })
                                        })
                                    } else if (typeof embed == 'object') {
                                        channel.send(embed);
                                    } else if (Array.isArray(activity.attachments) && activity.attachments > 0) {
                                        for (attachment in activity.attachments) {
                                            channel.send({ file: attachment.contentUrl });
                                        }
                                    }

                                    if (activity.text && !activity.attachments) {
                                        channel.send(activity.text).catch((err) => {
                                            throw err;
                                        });
                                    }
                                }).catch(err => {
                                    throw err;
                                })
                            }
                        }
                    });
                });
                dlSocket.ws.connect(streamUrl);
            });
    }

    /**
     * This method needs to go inside of the event handlers for Discord Events. This event may need to be overloaded to account for all of the different types of events that go on...
     * How would this look? Perhaps DiscordConnector.Guild = require('./Guild'); OR DiscordConnector.Guild = new (require('./Guild'));
     */
    postActivity (event, conversationId) {
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
            url: 'https://directline.botframework.com/v3/directline/conversations/' + conversationId + '/activities',
            method: 'POST',
            headers: { Authorization: 'Bearer ' + this.dlSecret },
            body: activity,
            json: true
        })
    }

    /**
     * This method takes activities from the DirectLine Connection and converts them to Discord Events 
     */
    postEvent (activity, channelId) {
        // If the activity is not from the bot, we don't want to send an event from Discord (otherwise we're just repeating what we heard)
        if (this.botName != activity.from.name) return;
        
        // How to get the channelID from the Activity Handler
        // this.getConversationData(activity, null).then(data => {
        //     var channelId = this.getChannelId(data);

        //     var channel = this.client.channels.get(channelId);
        //     channel.send(contentOrSomethingIdk).then(message => {
        //         console.log('sent a message');
        //     }).catch(err => {
        //         throw err;
        //     });
        // });
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
}

exports.DiscordConnector = DiscordConnector;