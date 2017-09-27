/**
 * Test storage to handle multiple conversations and store conversation-channel configurations. Stores conversation-channel data in a local Map.
 */
class TestConnectorStorage {
    constructor() {
        this.entries;
    }

    /**
     * Required to enforce similar code between using the ConnectorStorage class and this TestConnectorStorage. Creates a new Map and assigns it to this.entries.
     */
    initialize () {
        console.log('TestConnectorStorage successfully initialized.');
        this.entries = new Map();
    }

    /**
     * Used to locate a Direct Line Conversation ID given a Discord Channel ID and vice versa. 
     * @param {*} activity 
     * @param {*} event
     * @param {function} callback
     * @returns {void} 
     */
    getData(activity, event, callback) {
        var conversationId = '';
        var channelId = '';
        
        if (activity && activity.conversation) conversationId = activity.conversation.id;
        if (event && event.channel) channelId = event.channel.id;      
        
        var id = conversationId + '|' + channelId;
        var dataEntry;

        this.entries.forEach((entry, key, entries) => {
            if (key.includes(id)) {
                dataEntry = entry;
            }
        });
        if (dataEntry) callback(dataEntry);
        else callback(null);
    }

    /**
     * To save the conversationId-channelId configuration.
     * @param {*} activity 
     * @param {*} event
     * @param {function} callback
     * @returns {void} 
     */
    saveData(activity, event, callback) {
        var conversationId = '';
        var channelId = '';

        if (activity && activity.conversation) conversationId = activity.conversation.id;
        if (event && event.channel) channelId = event.channel.id;      
        var id = conversationId + '|' + event.channel.id;
        var newDataEntry = {
            id: id,
        };
        var savedEntry;

        if (!this.entries) {
            this.entries([id, newDataEntry]);
            savedEntry = this.entries.get(id);
        } else if (this.entries.has(id)) {
            savedEntry = this.entries.get(id);
        } else {
            this.entries.set(id, newDataEntry);
            savedEntry = this.entries.get(id);
        }
        if (savedEntry) callback(savedEntry);
        else callback(null);
    }

    /**
     * Handles Errors.
     * @param {Error} error 
     */
    getError (error) {
        if (!error)
            return null;
        throw err;
    };
}

/**
 * turn a cb based azure method into a Promisified one
 * for use with "documentdb"
 * @param {any} thisArg
 * @param {function} fn
 */ 
function denodeify(thisArg, fn) {
    return (...args) => {
        return new Promise((resolve, reject) => {
            args.push((error, result) => (error) ? reject(error) : resolve(result));
            fn.apply(thisArg, args);
        });
    };
}

exports.TestConnectorStorage = TestConnectorStorage;