const AWS = require('aws-sdk');
const { getEnv } = require('./util');

AWS.config.update({ region: getEnv('AWS_REGION') });

module.exports = {
    initializeDynamoClient: () => {
        return new AWS.DynamoDB.DocumentClient();
    },
    initializeSnsClient: () => {
        return new AWS.SNS();
    },
};
