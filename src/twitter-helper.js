const Twitter = require('twitter-lite');
const { getEnv } = require('./util');

exports.initializeTwitterClient = async () => {
    const user = new Twitter({
        consumer_key: getEnv('TWITTER_KEY'),
        consumer_secret: getEnv('TWITTER_SECRET'),
    });

    const { access_token } = await user.getBearerToken();

    return new Twitter({
        bearer_token: access_token,
    });
};
