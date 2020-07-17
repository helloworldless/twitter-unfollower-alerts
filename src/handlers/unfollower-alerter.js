const AWS = require('aws-sdk');
const Twitter = require('twitter-lite');

AWS.config.update({region: 'us-east-1'});

const dynamo = new AWS.DynamoDB.DocumentClient();

const cursorSignalEnd = '0';

function getEnvStrict(key) {
    const value = process.env[key];
    if (value === undefined) {
        throw new Error(`Missing required environment variable ${key}`);
    }
    return value;
}

const screen_name = getEnvStrict('TWITTER_HANDLE');

exports.handler = async (event, context) => {

    try {
        console.log('event', JSON.stringify(event, null, 2));
        const user = new Twitter({
            consumer_key: getEnvStrict('TWITTER_KEY'),
            consumer_secret: getEnvStrict('TWITTER_SECRET')
        });

        const {access_token} = await user.getBearerToken();

        const client = new Twitter({
            bearer_token: access_token
        });

        const followers = [];
        const seen = new Set();

        function populateUniqueFollowers(users) {
            for (const user of users) {
                if (!seen.has(user.id_str)) {
                    followers.push(user);
                    seen.add(user.id_st);
                }
            }
        }

        const firstResponse = await client.get('followers/list', {screen_name});
        populateUniqueFollowers(firstResponse.users);

        let cursor = firstResponse.next_cursor_str;

        while (cursor !== cursorSignalEnd) {
            const response = await client.get('followers/list', {screen_name, cursor});
            populateUniqueFollowers(response.users);
            cursor = response.next_cursor_str;
        }

        const followerNamesHandles = followers.map(u => `${u.name} (@${u.screen_name})`);

        console.log('Followers', JSON.stringify(followerNamesHandles, null, 2));
        console.log('Follower count: ', followerNamesHandles.length);

        for (const follower of followers) {
            const {id_str, ...rest} = follower;
            const params = {
                TableName: 'followers',
                Item: {
                    userId: id_str,
                    ...rest
                },
            };
            await dynamo.put(params).promise();
        }

    } catch (e) {
        console.error(e);
        throw e;
    }
}
