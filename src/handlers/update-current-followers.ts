import { User } from 'twitter-d';
import {
    dynamoTableName,
    getCurrentDateTime,
    getEnv,
    sqsQueueName,
} from '../util';
import { initializeTwitterClient } from '../twitter-helper';
import { initializeDynamoClient, initializeSqsClient } from '../aws-sdk-helper';
import { Follower } from '../types';

const dynamo = initializeDynamoClient();
const sqs = initializeSqsClient();

const cursorSignalEnd = '0';
const TableName = dynamoTableName;
const QueueName = sqsQueueName;

const screen_name = getEnv('TWITTER_HANDLE');

export async function handler(event) {
    const currentDate = getCurrentDateTime();
    const followers: User[] = [];
    const seen = new Set();

    try {
        console.log('Event', JSON.stringify(event, null, 2));
        console.log('SNS_TOPIC_ARN', getEnv('SNS_TOPIC_ARN'));
        const client = await initializeTwitterClient();

        console.log('Started - Fetching followers (initial)');
        const response = await client.get<{
            users: User[];
            next_cursor_str: string;
        }>('followers/list', {
            screen_name,
        });
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

        return followers.map(({ id_str }) => id_str);

        function populateUniqueFollowers(users: User[]) {
            for (const user of users) {
                if (!seen.has(user.id_str)) {
                    followers.push(user);
                    seen.add(user.id_str);
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
                } as Follower,
            };
            await dynamo.put(params).promise();
        }
    } catch (e) {
        console.error('Error', JSON.stringify(e));
        throw e;
    }
}
