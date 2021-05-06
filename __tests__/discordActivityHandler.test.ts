import * as a from 'assert';
import * as s from 'sinon';
import { DiscordActivityHandler, DiscordAdapter, DiscordAdapterOptions } from '../lib';

describe('DiscordActivityHandler', function () {
    this.timeout(1000);
    let sandbox: s.SinonSandbox;
    const opts: DiscordAdapterOptions = { discordToken: 'fakeToken' };

    beforeEach(function () {
        sandbox = s.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('should construct', function () {
        const adapter = new DiscordAdapter(opts);
        const clientOnSpy = sandbox.spy(adapter.client, 'on');
        const _ = new DiscordActivityHandler(adapter);
        a.ok(clientOnSpy.called);
    });
});
