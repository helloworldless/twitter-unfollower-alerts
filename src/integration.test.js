const util = require('./util');
const twitterHelper = require('./twitter-helper');

const TableName = util.dynamoTableName;
const currentDateTime = '2020-07-20T23:00:00.000Z';
const previousDateTime = '2020-07-20T22:00:00.000Z';
jest.mock('./util');

// trying to use original twitterUserToString causes RangeError: Maximum call stack size exceeded at mockConstructor...
util.twitterUserToString.mockImplementation(
    ({ id_str, name, screen_name }) =>
        `User {id=${id_str}; name=${name}; handle=${screen_name}}`
);
util.getEnv.mockImplementation((key) => `fake-${key}`);
util.getCurrentDateTime.mockImplementation(() => currentDateTime);

jest.mock('./twitter-helper');

const mockUsers = [
    {
        id_str: '123',
        name: 'Joe',
        screen_name: 'joe123',
    },
    {
        id_str: '234',
        name: 'Sam',
        screen_name: 'sam234',
    },
];

twitterHelper.initializeTwitterClient.mockImplementation(() => {
    return {
        get: async () => {
            return Promise.resolve({
                next_cursor_str: '0',
                users: mockUsers,
            });
        },
    };
});

const awsSdkHelper = require('./aws-sdk-helper');
jest.mock('./aws-sdk-helper');

const isTest = process.env.JEST_WORKER_ID;
const { DocumentClient } = require('aws-sdk/clients/dynamodb');
const config = {
    convertEmptyValues: true,
    ...(isTest && {
        endpoint: 'localhost:8000',
        sslEnabled: false,
        region: 'local-env',
    }),
};

const dynamo = new DocumentClient(config);

awsSdkHelper.initializeDynamoClient.mockImplementation(() => {
    return dynamo;
});

const snsMock = jest.fn();
awsSdkHelper.initializeSnsClient.mockImplementation(() => {
    return {
        publish: snsMock.mockReturnValue({
            promise: jest.fn().mockResolvedValue({}),
        }),
    };
});

const sqsMock = jest.fn();
awsSdkHelper.initializeSqsClient.mockImplementation(() => {
    return {
        getQueueUrl: sqsMock.mockReturnValue({
            promise: jest.fn().mockResolvedValue({ QueueUrl: 'fake-url' }),
        }),
        sendMessage: sqsMock.mockReturnValue({
            promise: jest.fn().mockResolvedValue({ message: 'mock' }),
        }),
    };
});

const {
    handler: updateHandler,
} = require('./handlers/update-current-followers');
const { handler: reconcileHandler } = require('./handlers/reconcile-and-email');

const unfollower = {
    id_str: '345',
    name: 'Z',
    screen_name: 'zzz',
};

function withAsOfDateTime(obj, asOfDateTime) {
    return { ...obj, asOfDateTime };
}
function withUserId(user) {
    return { ...user, userId: user.id_str };
}

test('happy path', async () => {
    for (const user of [...mockUsers, unfollower]) {
        const params = {
            TableName,
            Item: withAsOfDateTime(withUserId(user), previousDateTime),
        };
        await dynamo.put(params).promise();
    }

    const followers = await updateHandler(null);
    expect(followers).toStrictEqual(mockUsers);

    const result = await dynamo.scan({ TableName }).promise();
    const expectedUnfollower = withAsOfDateTime(
        withUserId(unfollower),
        previousDateTime
    );
    const expectedFollowers = mockUsers.map((user) =>
        withAsOfDateTime(withUserId(user), currentDateTime)
    );
    const expected = [...expectedFollowers, expectedUnfollower];

    expect(result.Items).toIncludeSameMembers(expected);

    const event = {
        Records: [{ body: JSON.stringify({ asOfDateTime: currentDateTime }) }],
    };

    const unfollowers = await reconcileHandler(event);

    expect(unfollowers).toIncludeSameMembers([expectedUnfollower]);

    const finalResult = await dynamo.scan({ TableName }).promise();
    expect(finalResult.Items).toIncludeSameMembers(expectedFollowers);

    expect(snsMock.mock.calls.length).toBe(1);
    expect(snsMock.mock.calls[0][0].Message).toContain(unfollower.screen_name);

    expect(sqsMock.mock.calls.length).toBe(2);
    expect(JSON.stringify(sqsMock.mock.calls[1][0])).toContain(currentDateTime);
});
