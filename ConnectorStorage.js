const documentdb = require('documentdb');
const Consts = require('./Consts');

/**
 * Necessary storage to handle multiple conversations and store conversation-channel configurations. Currently only allows for Cosmos DB storage. Creates a documentdb.DocumentClient when the class is instatiated.
 */
class ConnectorStorage {
    constructor(options) {
        this.options = options;
        this.documentdbClient = new documentdb.DocumentClient(this.options.host, { masterKey: this.options.masterKey });
        this.collection = this.options.collection;
        this.database = this.options.database;
    }

    /**
     * Required to initialize connection between ConnectorStorage and Cosmos DB. Also checks for the specified database and collection. Will create database and/or collection if not found.
     */
    initialize () {
        var _this = this;
        this.getOrCreateDatabase(function (error, database) {
            if (error) {
                this.getError(error);
            }
            else {
                _this.database = database;
                _this.getOrCreateCollection(function (error, collection) {
                    if (error) {
                        this.getError(error);
                    }
                    else {
                        _this.collection = collection;
                        return true;
                    }
                });
            }
        });
    }

    /**
     * Used to locate a Direct Line Conversation ID given a Discord Channel ID and vice versa. It pains me immensely that this method still requires a callback.
     * @param {*} activity 
     * @param {*} event
     * @param {function} callback
     * @returns {*} 
     */
    getData(activity, event, callback) {

        var conversationId = '';
        var channelId = '';

        if (activity && activity.conversation) conversationId = activity.conversation.id;
        if (event && event.channel) channelId = event.channel.id;                

        var id = conversationId + '|' + channelId;
        var querySpec = {
            query: Consts.DocDbRetrieveQuery,
            parameters: [{
                name: Consts.DocDbIdParam,
                value: id
            }]
        };
        var iterator = this.documentdbClient.queryDocuments(this.collection._self, querySpec, {});
        iterator.toArray((err, result, responseHeaders) => {
            if (err) {
                this.getError(err);
            } else if (result.length == 0) {
                callback(null);
            } else {
                callback(result[0]);
            }
        });
    }

    /**
     * To save the conversationId-channelId configuration. It pains me immensely that this method still requires a callback.
     * @param {*} activity 
     * @param {*} event
     * @returns {any} Actually a document db entry atm. 
     */
    saveData(activity, event, callback) {
        var conversationId = '';
        var channelId = '';

        if (activity && activity.conversation) conversationId = activity.conversation.id;
        if (event && event.channel) channelId = event.channel.id;      
        
        var newDataEntry = {
            id: conversationId + '|' + event.channel.id,
            isCompressed: true
        };

        this.documentdbClient.upsertDocument(this.collection._self, newDataEntry, {}, (err, collection, responseHeaders) => {
            if (err) this.getError(err);
            if (collection) {
                callback(collection);
            }
        })
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
    
    /**
     * Gets or creates the specified database. Not called externally.
     * @param {function} callback 
     */
    getOrCreateDatabase (callback) {
        var _this = this;
        var querySpec = {
            query: Consts.DocDbRootQuery,
            parameters: [{
                    name: Consts.DocDbIdParam,
                    value: this.options.database
                }]
        };
        this.documentdbClient.queryDatabases(querySpec).toArray(function (error, result, responseHeaders) {
            if (error) {
                callback(error, null);
            }
            else if (result.length == 0) {
                _this.documentdbClient.createDatabase({ id: _this.options.database }, {}, function (error, database) {
                    if (error) {
                        callback(error, null);
                    }
                    else {
                        callback(null, database);
                    }
                });
            }
            else {
                callback(null, result[0]);
            }
        });
    };
    
    /**
     * Gets or creates the specified collection. Not called externally.
     * @param {function} callback 
     */
    getOrCreateCollection (callback) {
        var _this = this;
        var querySpec = {
            query: Consts.DocDbRootQuery,
            parameters: [{
                    name: Consts.DocDbIdParam,
                    value: this.options.collection
                }]
        };
        this.documentdbClient.queryCollections(this.database._self, querySpec).toArray(function (error, result, responseHeaders) {
            if (error) {
                callback(error, null);
            }
            else if (result.length == 0) {
                _this.documentdbClient.createCollection(_this.database._self, { id: _this.options.collection }, {}, function (error, collection) {
                    if (error) {
                        callback(error, null);
                    }
                    else {
                        callback(null, collection);
                    }
                });
            }
            else {
                callback(null, result[0]);
            }
        });
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

exports.ConnectorStorage = ConnectorStorage;