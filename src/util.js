module.exports = {
    dynamoTableName: 'followers',
    sqsQueueName: 'HandoffQueue',
    getCurrentDateTime() {
        return new Date().toISOString();
    },
    twitterUserToString({ id_str, name, screen_name }) {
        return `User {id=${id_str}; name=${name}; handle=${screen_name}}`;
    },
    getEnv(key) {
        const value = process.env[key];
        if (value === undefined) {
            throw new Error(`Missing required environment variable ${key}`);
        }
        return value;
    },
};
