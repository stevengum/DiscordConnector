import { TurnContext } from 'botbuilder-core';
import { DiscordAdapter } from '../../../';
import { DiscordBot } from './discordBot';

const adapter = new DiscordAdapter({
    discordAppId: process.env.DISCORD_APP_ID,
    discordToken: process.env.DISCORD_TOKEN,
});

adapter.onTurnError = async (_context: TurnContext, error: Error) => {
    console.error('Error encountered in middleware pipeline.');
    console.error(error);
};

const _bot = new DiscordBot(adapter);

// Start listening for events from Discord.
adapter.start();
