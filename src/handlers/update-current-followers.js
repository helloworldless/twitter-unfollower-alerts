const { initializeTwitterClient } = require('../twitter-helper');

const {
    getCurrentDateTime,
    dynamoTableName,
    getEnv,
    sqsQueueName,
} = require('../util');

const {
    initializeDynamoClient,
    initializeSqsClient,
} = require('../aws-sdk-helper');

const dynamo = initializeDynamoClient();
const sqs = initializeSqsClient();

const cursorSignalEnd = '0';
const TableName = dynamoTableName;
const QueueName = sqsQueueName;
const currentDate = getCurrentDateTime();

const screen_name = getEnv('TWITTER_HANDLE');

const followers = [];
const seen = new Set();

exports.handler = async (event) => {
    try {
        console.log('Event', JSON.stringify(event, null, 2));
        const client = await initializeTwitterClient();

        console.log('Started - Fetching followers (initial)');
        const response = await client.get('followers/list', { screen_name });
        console.log('Completed - Fetching followers (initial)');

        populateUniqueFollowers(response.users);
        console.log(`Unique followers after first request=${followers.length}`);

        let cursor = response.next_cursor_str;

        while (cursor !== cursorSignalEnd) {
            console.log(`Additional fetch for cursor=${cursor}`);
            const nextCursorResponse = await client.get('followers/list', {
                screen_name,
                cursor,
            });
            populateUniqueFollowers(nextCursorResponse.users);
            console.log(
                `After cursor=${cursor} unique follower count=${followers.length}`
            );

            cursor = nextCursorResponse.next_cursor_str;
        }

        console.log(
            `For asOfDateTime=${currentDate} follower count=${followers.length}`
        );

        for (const follower of followers) {
            // If follower already exists, we overwrite with new asOfDateTime; If new, save with asOfDateTime
            await saveFollower(follower, currentDate);
        }

        console.log(`Started - Getting QueueUrl for QueueName=${QueueName}`);
        const queueUrlResponse = await sqs.getQueueUrl({ QueueName }).promise();
        console.log(
            `Completed - Getting queue URL for QueueName=${QueueName}; QueueUrl=${queueUrlResponse.QueueUrl}`
        );

        const msg = { asOfDateTime: currentDate };

        const messageParams = {
            MessageBody: JSON.stringify(msg),
            QueueUrl: queueUrlResponse.QueueUrl,
        };

        console.log(`Started - Sending message on QueueName=${QueueName}`);
        const sendMessageResponse = await sqs
            .sendMessage(messageParams)
            .promise();
        console.log(
            'SQS sendMessage response',
            JSON.stringify(sendMessageResponse, null, 2)
        );
        console.log(`Completed - Sending message on QueueName=${QueueName}`);

        return followers;
    } catch (e) {
        console.error(e);
        console.error(JSON.stringify(e));
        throw e;
    }
};

function populateUniqueFollowers(users) {
    for (const user of users) {
        if (!seen.has(user.id_str)) {
            followers.push(user);
            seen.add(user.id_st);
        }
    }
}

async function saveFollower(follower, asOfDateTime) {
    const { id_str, name, screen_name } = follower;
    const params = {
        TableName,
        Item: {
            id_str,
            name,
            screen_name,
            userId: id_str,
            asOfDateTime,
        },
    };
    await dynamo.put(params).promise();
}
