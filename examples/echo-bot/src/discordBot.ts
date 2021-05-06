import { TurnContext } from 'botbuilder-core';
import * as d from 'discord.js';
import { BFDiscordActivity, DiscordActivityHandler, DiscordAdapter } from '../../../';

export class DiscordBot extends DiscordActivityHandler {
    constructor(adapter: DiscordAdapter) {
        super(adapter);
    }

    async onMessage(turnContext: TurnContext, message: d.Message): Promise<void> {
        const adapter = turnContext.adapter as DiscordAdapter;
        if (message?.author?.id !== adapter.appId) {
            const reply: BFDiscordActivity = {
                value: {
                    message: `Echo: ${message.content}`,
                    target: message.channel,
                },
            };
            await turnContext.sendActivity(reply);
        }
    }

    async onReady(): Promise<void> {
        console.log('Ready!');
    }
}
