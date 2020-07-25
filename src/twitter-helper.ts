import { getEnv } from './util';

import Twitter from 'twitter-lite';

export async function initializeTwitterClient() {
    const user = new Twitter({
        consumer_key: getEnv('TWITTER_KEY'),
        consumer_secret: getEnv('TWITTER_SECRET'),
    });

    const { access_token } = await user.getBearerToken();

    // @ts-ignore
    return new Twitter({
        bearer_token: access_token,
    });
}
