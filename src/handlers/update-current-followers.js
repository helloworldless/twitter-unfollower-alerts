const {getCurrentDate, tableName, getEnv} = require('../util');

const AWS = require('aws-sdk');
const Twitter = require('twitter-lite');

const region = getEnv('AWS_REGION');
AWS.config.update({region});

const dynamo = new AWS.DynamoDB.DocumentClient();

const cursorSignalEnd = '0';
const TableName = tableName;
const currentDate = getCurrentDate()

const screen_name = getEnv('TWITTER_HANDLE');

const followers = [];
const seen = new Set();

exports.handler = async (event, context) => {
    try {
        console.log('event', JSON.stringify(event, null, 2));
        const client = await initializeTwitterClient();

        const response = await client.get('followers/list', {screen_name});
        populateUniqueFollowers(response.users);
        console.log(`Unique followers after first request=${followers.length}`);

        let cursor = response.next_cursor_str;
        console.log(`First response cursor=${cursor}`);

        while (cursor !== cursorSignalEnd) {
            console.log(`Additional fetch for cursor=${cursor}`);
            const nextCursorResponse = await client.get('followers/list', {screen_name, cursor});
            populateUniqueFollowers(nextCursorResponse.users);
            console.log(`Unique followers after cursor=${cursor} is =${followers.length}`);

            cursor = nextCursorResponse.next_cursor_str;
        }

        console.log(`As of ${currentDate} follower count=${followers.length}`);

        for (const follower of followers) {
            if (follower.screen_name === 'WeekBusy') {
                console.log('Found WeekBusy', JSON.stringify(follower, null, 2));
            }
            // if already exists, overwrite with new asOfDate; if new save with asOfDate
            await saveFollower(follower, currentDate);
        }

        return followers;

    } catch (e) {
        console.error(e);
        console.error(JSON.stringify(e));
        throw e;
    }
}

async function initializeTwitterClient() {
    const user = new Twitter({
        consumer_key: getEnv('TWITTER_KEY'),
        consumer_secret: getEnv('TWITTER_SECRET')
    });

    const {access_token} = await user.getBearerToken();

    return new Twitter({
        bearer_token: access_token
    });
}

function populateUniqueFollowers(users) {
    for (const user of users) {
        if (!seen.has(user.id_str)) {
            followers.push(user);
            seen.add(user.id_st);
        }
    }
}

async function saveFollower(follower, asOfDate) {
    const params = {
        TableName,
        Item: {
            ...follower,
            userId: follower.id_str,
            asOfDate
        },
    };
    await dynamo.put(params).promise();
}
