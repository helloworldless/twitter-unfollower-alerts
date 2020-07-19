const {getCurrentDate, tableName, twitterUserToString, getEnv} = require('../util');

const AWS = require('aws-sdk');

const region = getEnv('AWS_REGION');
AWS.config.update({region});

const dynamo = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

const TableName = tableName;
const currentDate = getCurrentDate();
const accountId = getEnv('AWS_ACCOUNT_ID');

const topicArn = `arn:aws:sns:${region}:${accountId}:UnfollowerAlertTopic`;

exports.handler = async (event, context) => {
    try {
        console.log('event', JSON.stringify(event, null, 2));
        const unfollowers = await findUnfollowers();
        const unfollowersMessage = JSON.stringify(unfollowers.map(twitterUserToString), null, 2);
        console.log('unfollowers', unfollowersMessage);

        const params = {
            TopicArn: topicArn,
            Message: unfollowers.length ? unfollowersMessage : "No unfollowers since yesterday!",
        };

        const result = await sns.publish(params).promise();
        console.log('SNS Publish result: ', JSON.stringify(result, null, 2));

        for (const unfollower of unfollowers) {
            await deleteUnfollower(unfollower);
        }

        return unfollowers;

    } catch (e) {
        console.error(e);
        console.error(JSON.stringify(e));
        throw e;
    }
}

async function findUnfollowers() {
    const findUnfollowersParams = {
        TableName,
        FilterExpression: 'asOfDate < :asOfDate',
        ExpressionAttributeValues: {':asOfDate': currentDate}
    };

    const unfollowers = await dynamo.scan(findUnfollowersParams).promise();

    if (unfollowers.LastEvaluatedKey) {
        throw new Error(`Unfollower results were large enough to paginated but code doesn't handle that`);
    }

    return unfollowers.Items;
}

async function deleteUnfollower(unfollower) {
    const deleteParams = {
        TableName,
        Key: {userId: unfollower.userId}
    };
    await dynamo.delete(deleteParams).promise();
    console.log(`Delete succeeded for userId=${unfollower.userId}`)
}