# Twitter Unfollower Alerts

Get a daily email digest of Twitter unfollowers. Built with AWS Lambda, DynamoDB, and SNS.

## Deploy

1. Run `yarn deploy`

## Issues/Caveats

### New
- Test broken, need to switch tests to run with `ts-jest`
- Env vars need to be added manaually, add .env file which isn't checked in
- Clean up the original issues list below!

### Prerequisites

- AWS account
- AWS SDK installed and configured
- SAM installed

### Scheduling

Uses schedule via cron expressions in `template.yml`. Assumes the `update-current-followers` will
 complete before `reconcile-and-email`'s scheduled run.

Also, as it's written it only supports running once a day, since it tracks the `asOfDate` in the
 format `yyyy-mm-dd`.   
 
Look into publishing an SQS message in `update-current-followers` and having
 `reconcile-and-email` listen to that message.

### Access

- Neither lambda has access to DynamoDB - need to add policy manually for both
- `update-current-followers` doesn't have access to SQS - need to add policy manually for now
- `reconcile-and-email` doesn't have access to SNS - need to add policy manually for now

### Other
 
- `invoke local` throwing method not found error,
 [this answer](https://github.com/aws/aws-toolkit-jetbrains/issues/912) looks promising

### Environment Variables

- Need to manually add environment variables. Is there a better way?
- Seemingly no good way to get AWS account ID (for SNS topic ARN) in reconcile-and-email.js without
 having to add and access an environment variable
- Email address needs to be added in `template.yml`. Should prob env var for consistency
 and to prevent people from accidentally committing their personal email address. 

`aws lambda update-function-configuration --function-name twitter-unfollower-alerts-dev-reconcileAndEmail --environment Variables={AWS_ACCOUNT_ID=}`

`aws lambda update-function-configuration --function-name twitter-unfollower-alerts-dev-updateCurrentFollowers --environment Variables={TWITTER_HANDLE=,TWITTER_KEY=,TWITTER_SECRET=}`

### SNS Subscription

Must confirm SNS subscription by clicking link in email: **AWS Notification - Subscription Confirmation**.
 The first email triggers this subscription email, so the first unfollower alert email
  is not received.
  
 
### Package and Deploy

- Add webpack
- Consider Serverless framework

## Troubleshooting

Manually add an item to the `followers` table:

```json
{
  "asOfDate": "2020-07-18",
  "id_str": "123",
  "name": "Test",
  "screen_name": "Test",
  "userId": "123"
}
```