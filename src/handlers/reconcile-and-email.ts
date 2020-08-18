import { dynamoTableName, getEnv, twitterUserToString } from '../util';
import { initializeDynamoClient, initializeSnsClient } from '../aws-sdk-helper';
import { Follower } from '../types';

const dynamo = initializeDynamoClient();
const sns = initializeSnsClient();

const TableName = dynamoTableName;

const TopicArn = getEnv('SNS_TOPIC_ARN');

exports.handler = async (event) => {
    try {
        console.log('Event', JSON.stringify(event, null, 2));
        const { asOfDateTime } = JSON.parse(event.Records[0].body);

        console.log(`asOfDateTime=${asOfDateTime}`);
        const unfollowers: Follower[] = await findUnfollowers(asOfDateTime);
        console.log(`Found count=${unfollowers.length} unfollowers`);

        if (unfollowers.length) {
            const unfollowersMessage = unfollowers
                .map(twitterUserToString)
                .join('\n');
            console.log('unfollowersMessage', unfollowersMessage);

            const params = {
                TopicArn: TopicArn,
                Message: unfollowersMessage,
            };

            console.log(`Publish SNS message to topic=${TopicArn}`);
            const result = await sns.publish(params).promise();
            console.log(
                'SNS publish result: ',
                JSON.stringify(result, null, 2)
            );

            await deleteUnfollowers(unfollowers);
        } else {
            console.log(
                'No unfollowers since yesterday! Skipping publishing of SNS message'
            );
        }

        return unfollowers;
    } catch (e) {
        console.error(e);
        console.error(JSON.stringify(e));
        throw e;
    }
};

async function findUnfollowers(asOfDateTime): Promise<Follower[]> {
    const findUnfollowersParams = {
        TableName,
        FilterExpression: 'asOfDateTime < :asOfDateTime',
        ExpressionAttributeValues: { ':asOfDateTime': asOfDateTime },
    };

    const unfollowers = await dynamo.scan(findUnfollowersParams).promise();

    if (unfollowers.LastEvaluatedKey) {
        throw new Error(
            `Unfollower results were large enough to paginated but code doesn't handle that`
        );
    }

    return unfollowers.Items as Follower[];
}

async function deleteUnfollowers(unfollowers) {
    console.log('Started - Deleting unfollowers');
    for (const unfollower of unfollowers) {
        await deleteUnfollower(unfollower);
    }
    console.log('Completed - Deleting unfollowers');
}

async function deleteUnfollower(unfollower) {
    const deleteParams = {
        TableName,
        Key: { userId: unfollower.userId },
    };
    await dynamo.delete(deleteParams).promise();
    console.log(`Delete succeeded for userId=${unfollower.userId}`);
}
