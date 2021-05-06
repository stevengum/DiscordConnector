import { Activity, TurnContext } from 'botbuilder-core';
import * as d from 'discord.js';
import { DiscordAdapter } from './discordAdapter';

/**
 * Defines the core behavior for processing Discord-generated events.
 */
export class DiscordActivityHandler {
    private readonly client: d.Client;
    /**
     * Initializes a new instance of the DiscordActivityHandler class.
     *
     * @param adapter A DiscordAdapter instance.
     */
    constructor(private readonly adapter: DiscordAdapter) {
        if (!adapter) {
            // TODO: Make stricter check.
            throw new TypeError(`Invalid 'client' parameter.`);
        }
        this.client = adapter.client;
        this.client.on(
            'channelCreate',
            async (channel: d.Channel): Promise<void> => {
                const context = this.createTurnContext();
                await this.onChannelCreate(context, channel);
            }
        );
        this.client.on(
            'channelDelete',
            async (channel: d.Channel | d.PartialDMChannel): Promise<void> => {
                const context = this.createTurnContext();
                await this.onChannelDelete(context, channel);
            }
        );
        // Is the TurnContext necessary?
        this.client.on(
            'ready',
            async (): Promise<void> => {
                const context = this.createTurnContext();
                await this.onReady(context);
            }
        );
        this.client.on('error', async (error: Error) => {
            const context = this.createTurnContext();
            await this.onError(context, error);
        });
        this.client.on('message', async (message: d.Message) => {
            const context = this.createTurnContext();
            await this.onMessage(context, message);
        });
        // Is the TurnContext necessary?
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.client.on('disconnect', async (arg: any, num: number) => {
            const context = this.createTurnContext();
            await this.onDisconnect(context, arg, num);
        });

        this.client.on('roleCreate', async (role: d.Role) => {
            const context = this.createTurnContext();
            await this.onRoleCreate(context, role);
        });

        this.client.on('roleDelete', async (role: d.Role) => {
            const context = this.createTurnContext();
            await this.onRoleDelete(context, role);
        });

        this.client.on('roleUpdate', async (oldRole: d.Role, newRole: d.Role) => {
            const context = this.createTurnContext();
            await this.onRoleUpdate(context, oldRole, newRole);
        });
    }

    protected createTurnContext(_arg?: unknown): TurnContext {
        const activity: Partial<Activity> = {};
        return new TurnContext(this.adapter, activity);
    }

    // Is this necessary?
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onReady(turnContext: TurnContext): Promise<void> {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onChannelCreate(turnContext: TurnContext, channel: d.Channel): Promise<void> {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onChannelDelete(turnContext: TurnContext, channel: d.Channel | d.PartialDMChannel): Promise<void> {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onError(turnContext: TurnContext, error: Error): Promise<void> {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onMessage(turnContext: TurnContext, message: d.Message): Promise<void> {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
    async onDisconnect(turnContext: TurnContext, arg: any, num: number): Promise<void> {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onRoleCreate(turnContext: TurnContext, role: d.Role): Promise<void> {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onRoleDelete(turnContext: TurnContext, role: d.Role): Promise<void> {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onRoleUpdate(turnContext: TurnContext, oldRole: d.Role, newRole: d.Role): Promise<void> {}
}
