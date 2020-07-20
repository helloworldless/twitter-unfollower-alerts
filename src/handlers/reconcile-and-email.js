const {
    initializeDynamoClient,
    initializeSnsClient,
} = require('../aws-sdk-helper');

const {
    getCurrentDate,
    dynamoTableName,
    twitterUserToString,
    getEnv,
} = require('../util');

const dynamo = initializeDynamoClient();
const sns = initializeSnsClient();

const TableName = dynamoTableName;
const currentDate = getCurrentDate();

const region = getEnv('AWS_REGION');
const accountId = getEnv('AWS_ACCOUNT_ID');
const topic = 'UnfollowerAlertTopic';

const topicArn = `arn:aws:sns:${region}:${accountId}:${topic}`;

exports.handler = async (event) => {
    try {
        console.log('Event', JSON.stringify(event, null, 2));
        const unfollowers = await findUnfollowers();
        console.log(`Found unfollowers count=${unfollowers.length}`);

        const unfollowersMessage = unfollowers
            .map(twitterUserToString)
            .join('\n');
        console.log('unfollowersMessage', unfollowersMessage);

        const params = {
            TopicArn: topicArn,
            Message: unfollowers.length
                ? unfollowersMessage
                : 'No unfollowers since yesterday!',
        };

        console.log(`Publish SNS message to topic=${topic}`);
        const result = await sns.publish(params).promise();
        console.log('SNS publish result: ', JSON.stringify(result, null, 2));

        console.log('Started - Deleting unfollowers');
        for (const unfollower of unfollowers) {
            await deleteUnfollower(unfollower);
        }
        console.log('Completed - Deleting unfollowers');

        return unfollowers;
    } catch (e) {
        console.error(e);
        console.error(JSON.stringify(e));
        throw e;
    }
};

async function findUnfollowers() {
    const findUnfollowersParams = {
        TableName,
        FilterExpression: 'asOfDate < :asOfDate',
        ExpressionAttributeValues: { ':asOfDate': currentDate },
    };

    const unfollowers = await dynamo.scan(findUnfollowersParams).promise();

    if (unfollowers.LastEvaluatedKey) {
        throw new Error(
            `Unfollower results were large enough to paginated but code doesn't handle that`
        );
    }

    return unfollowers.Items;
}

async function deleteUnfollower(unfollower) {
    const deleteParams = {
        TableName,
        Key: { userId: unfollower.userId },
    };
    await dynamo.delete(deleteParams).promise();
    console.log(`Delete succeeded for userId=${unfollower.userId}`);
}
