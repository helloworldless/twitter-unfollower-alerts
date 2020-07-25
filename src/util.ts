export const getCurrentDateTime = () => {
    return new Date().toISOString();
};

export const twitterUserToString = ({ id_str, name, screen_name }) => {
    return `User {id=${id_str}; name=${name}; handle=${screen_name}}`;
};

export const getEnv = (key) => {
    const value = process.env[key];
    if (value === undefined) {
        throw new Error(`Missing required environment variable ${key}`);
    }
    return value;
};

export const dynamoTableName = getEnv('DYNAMODB_TABLE');

export const sqsQueueName = getEnv('SQS_QUEUE');
