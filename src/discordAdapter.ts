import {
    Activity,
    ActivityTypes,
    BotAdapter,
    ConversationReference,
    ResourceResponse,
    TurnContext,
} from 'botbuilder-core';
import * as d from 'discord.js';
import { DiscordConnectorChannelKey } from './turnStateKeys';

export type DiscordAdapterOptions = {
    discordToken: string;
    discordAppId: string;
};

export type BFDiscordActivity<T = d.APIMessage | d.APIMessageContentResolvable> = Omit<Partial<Activity>, 'value'> & {
    value: {
        target: d.MessageTarget;
        message: T;
    };
};

const bfDiscordActivityGuard = (val: unknown): val is BFDiscordActivity => {
    const activity = val as BFDiscordActivity;
    return activity.value?.target && !!activity.value?.message;
};

type SendingChannel = d.TextChannel | d.DMChannel | d.NewsChannel;

/**
 * BotAdapter used to communicate with Discord.
 */
export class DiscordAdapter extends BotAdapter {
    public readonly client: d.Client;
    // Construct inner discord.js client
    constructor(private readonly options: DiscordAdapterOptions) {
        super();

        // Use runtypes on options.
        this.client = new d.Client();
    }

    /**
     * Logs into Discord using token provided in constructor's options parameter.
     */
    start(): void {
        this.client.login(this.options.discordToken);
    }

    /**
     * The Discord Application Id.
     *
     * @remarks
     * The bot should use this appId to filter out messages the bot sends to Discord. Otherwise the bot may respond to
     * itself.
     * @returns The Discord Application Id.
     */
    get appId(): string {
        return this.options.discordAppId;
    }

    /* eslint-disable @typescript-eslint/no-unused-vars */
    async continueConversation(
        reference: Partial<ConversationReference>,
        logic: (revocableContext: TurnContext) => Promise<void>
    ): Promise<void> {}
    /* eslint-enable @typescript-eslint/no-unused-vars */

    async deleteActivity(): Promise<void> {}

    async sendActivities(context: TurnContext, activities: Partial<Activity>[]): Promise<ResourceResponse[]> {
        const responses: ResourceResponse[] = [];

        // Well this seems awful.
        const channel = context.turnState.get<SendingChannel>(DiscordConnectorChannelKey);
        // APIMessage is constructed with (target: MessageTarget, options: MessageOptions | WebhookMessageOptions)

        for (let i = 0; i < activities.length; i++) {
            // send to TextChannel, DMChannel or NewsChannel (this is available via message.channel)
            const activity = activities[i];
            if (activity.type !== ActivityTypes.Message) {
                console.trace(
                    `Unsupported Activity Type: '${activity.type} '` +
                        `Only Activities of type '${ActivityTypes.Message}' are supported.`
                );
            } else {
                if (bfDiscordActivityGuard(activity)) {
                    // TODO: Address sending of messages.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const target = activity.value.target as any;
                    await target?.send(activity.value.message);
                } else {
                    await channel.send(activities[i]);
                }
            }
        }
        return responses;
    }

    async updateActivity(): Promise<ResourceResponse | void> {}
}
