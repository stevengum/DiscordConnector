const DC = require('./DiscordConnector');
const CS = require('./ConnectorStorage');

require('dotenv').config();

var storage = new CS.ConnectorStorage({
    host: process.env.DOCUMENTDB_HOST,
    masterKey: process.env.DOCUMENTDB_MASTER_KEY,
    database: process.env.DOCUMENTDB_DB_NAME,
    collection: process.env.DOCUMENTDB_COLLECTION
});
storage.initialize();

var DiscordConnectorConfig = { 
    discordSecret: process.env.DISCORD_SECRET, 
    dlSecret: process.env.DIRECTLINE_SECRET,
    botName: process.env.BOT_NAME,
    botId: process.env.BOT_ID
}

var connector = new DC.DiscordConnector(DiscordConnectorConfig);

connector.addStorageClient(storage);
connector.enableBasicRelay();
connector.conversationUpdate();
