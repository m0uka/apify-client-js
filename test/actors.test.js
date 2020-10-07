const ApifyClient = require('../src');
const { stringifyWebhooksToBase64 } = require('../src/utils');
const mockServer = require('./mock_server/server');
const { Browser, validateRequest, DEFAULT_QUERY } = require('./_helper');

describe('Actor methods', () => {
    let baseUrl;
    const browser = new Browser();

    beforeAll(async () => {
        const server = await mockServer.start();
        await browser.start();
        baseUrl = `http://localhost:${server.address().port}/v2`;
    });

    afterAll(async () => {
        await Promise.all([
            mockServer.close(),
            browser.cleanUpBrowser(),
        ]);
    });

    let client;
    let page;
    beforeEach(async () => {
        page = await browser.getInjectedPage(baseUrl, DEFAULT_QUERY);
        client = new ApifyClient({
            baseUrl,
            maxRetries: 0,
            ...DEFAULT_QUERY,
        });
    });
    afterEach(async () => {
        client = null;
        page.close().catch(() => {});
    });

    describe('actors()', () => {
        test('list() works', async () => {
            const opts = {
                limit: 5,
                offset: 3,
                desc: true,
                my: true,
            };

            const res = await client.actors().list(opts);
            expect(res.id).toEqual('list-actors');
            validateRequest(opts);

            const browserRes = await page.evaluate((options) => client.actors().list(options), opts);
            expect(browserRes).toEqual(res);
            validateRequest(opts);
        });

        test('create() works', async () => {
            const actor = { foo: 'bar' };

            const res = await client.actors().create(actor);
            expect(res.id).toEqual('create-actor');
            validateRequest({}, {}, actor);
            const browserRes = await page.evaluate((opts) => client.actors().create(opts), actor);
            expect(browserRes).toEqual(res);
            validateRequest({}, {}, actor);
        });
    });

    describe('actor(id)', () => {
        test('update() works', async () => {
            const actorId = 'some-user/some-id';
            const newFields = { foo: 'bar' };

            const res = await client.actor(actorId).update(newFields);
            expect(res.id).toEqual('update-actor');
            validateRequest({}, { actorId: 'some-user~some-id' }, newFields);

            const browserRes = await page.evaluate((id, opts) => client.actor(id).update(opts), actorId, newFields);
            expect(browserRes).toEqual(res);
            validateRequest({}, { actorId: 'some-user~some-id' }, newFields);
        });

        test('get() works', async () => {
            const actorId = 'some-id';

            const res = await client.actor(actorId).get();
            expect(res.id).toEqual('get-actor');
            validateRequest({}, { actorId });

            const browserRes = await page.evaluate((id) => client.actor(id).get(), actorId);
            expect(browserRes).toEqual(res);
            validateRequest({}, { actorId });
        });

        test('get() returns undefined on 404 status code (RECORD_NOT_FOUND)', async () => {
            const actorId = '404';

            const res = await client.actor(actorId).get();
            expect(res).toBeUndefined();
            validateRequest({}, { actorId });

            const browserRes = await page.evaluate((id) => client.actor(id).get(), actorId);
            expect(browserRes).toEqual(res);
            validateRequest({}, { actorId });
        });

        test('delete() works', async () => {
            const actorId = '204';
            const res = await client.actor(actorId).delete();
            expect(res).toBeUndefined();
            validateRequest({}, { actorId });

            await page.evaluate((id) => client.actor(id).delete(), actorId);
            validateRequest({}, { actorId });
        });

        test('start() works', async () => {
            const actorId = 'some-id';
            const contentType = 'application/x-www-form-urlencoded';
            const input = 'some=body';

            const query = {
                timeout: 120,
                memory: 256,
                build: '1.2.0',
            };

            const res = await client.actor(actorId).start({ contentType, input, ...query });
            expect(res.id).toEqual('run-actor');
            validateRequest(query, { actorId }, { some: 'body' }, { 'content-type': contentType });

            const browserRes = await page.evaluate((id, opts) => client.actor(id).start(opts), actorId, { contentType, input, ...query });
            expect(browserRes).toEqual(res);
            validateRequest(query, { actorId }, { some: 'body' }, { 'content-type': contentType });
        });

        test('start() with webhook works', async () => {
            const actorId = 'some-id';
            const webhooks = [
                {
                    eventTypes: ['ACTOR.RUN.CREATED'],
                    requestUrl: 'https://example.com/run-created',
                },
                {
                    eventTypes: ['ACTOR.RUN.SUCCEEDED'],
                    requestUrl: 'https://example.com/run-succeeded',
                },
            ];

            const res = await client.actor(actorId).start({ webhooks });
            expect(res.id).toEqual('run-actor');
            validateRequest({ webhooks: stringifyWebhooksToBase64(webhooks) }, { actorId });

            const browserRes = await page.evaluate((id, opts) => client.actor(id).start(opts), actorId, { webhooks });
            expect(browserRes).toEqual(res);
            validateRequest({ webhooks: stringifyWebhooksToBase64(webhooks) }, { actorId });
        });

        test('call() works', async () => {
            const actorId = 'some-id';
            const contentType = 'application/x-www-form-urlencoded';
            const input = 'some=body';
            const timeout = 120;
            const memory = 256;
            const build = '1.2.0';
            const data = { status: 'SUCCEEDED' };
            const body = { data };
            const waitSecs = 1;

            mockServer.setResponse({ body }); // this is not used for the actor.start()
            const res = await client.actor(actorId).call({
                contentType,
                memory,
                timeout,
                build,
                input,
                waitSecs,
            });

            expect(res).toEqual(data);
            validateRequest({ waitForFinish: waitSecs }, { actorId, runId: 'run-actor' });
            validateRequest({
                timeout,
                memory,
                build,
            }, { actorId }, { some: 'body' }, { 'content-type': contentType });

            const callBrowserRes = await page.evaluate(
                (id, opts) => client.actor(id).call(opts), actorId, {
                    contentType,
                    memory,
                    timeout,
                    build,
                    input,
                    waitSecs,
                },
            );
            expect(callBrowserRes).toEqual(res);
            validateRequest({ waitForFinish: waitSecs }, { actorId, runId: 'run-actor' });
            validateRequest({
                timeout,
                memory,
                build,
            }, { actorId }, { some: 'body' }, { 'content-type': contentType });
        });

        test('build() works', async () => {
            const actorId = 'some-id';

            const query = {
                betaPackages: true,
                waitForFinish: 120,
                version: '0.0',
                tag: 'latest',
                useCache: true,

            };

            const res = await client.actor(actorId).build(query);
            expect(res.id).toEqual('build-actor');
            validateRequest(query, { actorId });

            const browserRes = await page.evaluate((aId, opts) => client.actor(aId).build(opts), actorId, query);
            expect(browserRes).toEqual(res);
            validateRequest(query, { actorId });
        });

        describe('lastRun()', () => {
            test.each([
                'get',
                'dataset',
                'keyValueStore',
                'requestQueue',
                'log',
            ])('%s() works', async (method) => {
                const actorId = 'some-actor-id';

                const lastRunClient = client.actor(actorId).lastRun();
                const res = method === 'get'
                    ? await lastRunClient.get()
                    : await lastRunClient[method]().get();

                if (method === 'log') {
                    expect(res).toEqual('last-run-log');
                } else {
                    expect(res.id).toEqual(`last-run-${method}`);
                }
                validateRequest({}, { actorId });

                const browserRes = await page.evaluate((aId, mthd) => {
                    const lrc = client.actor(aId).lastRun();
                    if (mthd === 'get') return lrc.get();
                    return lrc[mthd]().get();
                }, actorId, method);
                expect(browserRes).toEqual(res);
                validateRequest({}, { actorId });
            });
        });

        test('builds().list() works', async () => {
            const actorId = 'some-id';

            const query = {
                limit: 5,
                offset: 3,
                desc: true,
            };

            const res = await client.actor(actorId).builds().list(query);
            expect(res.id).toEqual('list-builds');
            validateRequest(query, { actorId });

            const browserRes = await page.evaluate((aId, opts) => client.actor(aId).builds().list(opts), actorId, query);
            expect(browserRes).toEqual(res);
            validateRequest(query, { actorId });
        });

        test('runs().list() works', async () => {
            const actorId = 'some-id';

            const query = {
                limit: 5,
                offset: 3,
                desc: true,
            };

            const res = await client.actor(actorId).runs().list(query);
            expect(res.id).toEqual('list-runs');
            validateRequest(query, { actorId });

            const browserRes = await page.evaluate((aId, opts) => client.actor(aId).runs().list(opts), actorId, query);
            expect(browserRes).toEqual(res);
            validateRequest(query, { actorId });
        });

        describe('versions()', () => {
            test('list() works', async () => {
                const actorId = 'some-id';

                const res = await client.actor(actorId).versions().list();
                expect(res.id).toEqual('list-actor-versions');
                validateRequest({}, { actorId });

                const browserRes = await page.evaluate((id) => client.actor(id).versions().list(), actorId);
                expect(browserRes).toEqual(res);
                validateRequest({}, { actorId });
            });

            test('create() works', async () => {
                const actorId = 'some-id';
                const actorVersion = {
                    versionNumber: '0.0',
                    foo: 'bar',
                };

                const res = await client.actor(actorId).versions().create(actorVersion);
                expect(res.id).toEqual('create-actor-version');
                validateRequest({}, { actorId }, actorVersion);

                const browserRes = await page.evaluate((id, opts) => client.actor(id).versions().create(opts), actorId, actorVersion);
                expect(browserRes).toEqual(res);
                validateRequest({}, { actorId }, actorVersion);
            });
        });

        describe('version()', () => {
            test('get() works', async () => {
                const actorId = 'some-id';
                const versionNumber = '0.0';

                const res = await client.actor(actorId).version(versionNumber).get();
                expect(res.id).toEqual('get-actor-version');
                validateRequest({}, { actorId, versionNumber });

                const browserRes = await page.evaluate((id, vn) => client.actor(id).version(vn).get(), actorId, versionNumber);
                expect(browserRes).toEqual(res);
                validateRequest({}, { actorId, versionNumber });
            });

            test('get() works if version did not exist', async () => {
                const actorId = '404';
                const versionNumber = '0.0';

                const res = await client.actor(actorId).version(versionNumber).get();
                expect(res).toBeUndefined();
                validateRequest({}, { actorId, versionNumber });

                const browserRes = await page.evaluate((id, vn) => client.actor(id).version(vn).get(), actorId, versionNumber);
                expect(browserRes).toEqual(res);
                validateRequest({}, { actorId, versionNumber });
            });

            test('update() works', async () => {
                const actorId = 'some-user/some-id';
                const versionNumber = '0.0';
                const newFields = {
                    foo: 'bar',
                };

                const res = await client.actor(actorId).version(versionNumber).update(newFields);
                expect(res.id).toEqual('update-actor-version');
                validateRequest({}, { actorId: 'some-user~some-id', versionNumber }, newFields);

                const browserRes = await page.evaluate((id, vn, nf) => client.actor(id).version(vn).update(nf), actorId, versionNumber, newFields);
                expect(browserRes).toEqual(res);
                validateRequest({}, { actorId: 'some-user~some-id', versionNumber }, newFields);
            });

            test('delete() works', async () => {
                const actorId = '204';
                const versionNumber = '0.0';

                const res = await client.actor(actorId).version(versionNumber).delete();
                expect(res).toBeUndefined();
                validateRequest({}, { actorId, versionNumber });

                const browserRes = await page.evaluate((id, vn) => client.actor(id).version(vn).delete(), actorId, versionNumber);
                expect(browserRes).toEqual(res);
                validateRequest({}, { actorId, versionNumber });
            });
        });

        test('webhooks().list() works', async () => {
            const actorId = 'some-act-id';
            const query = {
                limit: 5,
                offset: 3,
                desc: true,
            };

            const res = await client.actor(actorId).webhooks().list(query);
            expect(res.id).toEqual('list-webhooks');
            validateRequest(query, { actorId });

            const browserRes = await page.evaluate((id, opts) => client.actor(id).webhooks().list(opts), actorId, query);
            expect(browserRes).toEqual(res);
            validateRequest(query, { actorId });
        });
    });
});
