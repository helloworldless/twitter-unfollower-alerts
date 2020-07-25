import AWS from 'aws-sdk';
import { getEnv } from './util';

AWS.config.update({ region: getEnv('AWS_REGION') });

export function initializeDynamoClient() {
    return new AWS.DynamoDB.DocumentClient();
}

export function initializeSnsClient() {
    return new AWS.SNS();
}

export function initializeSqsClient() {
    return new AWS.SQS();
}
