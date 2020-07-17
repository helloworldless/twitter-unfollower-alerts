# Twitter Unfollower Alerts

_WORK IN PROGRESS_

Get email digest of unfollowers. Fully #serverless!

## Issues/TODO

- Externalize schedule into config
- Lambda doesn't have access to DynamoDB (added policy manually for now)
- `invoke local` throwing method not found error
- Dynamo: Scan and delete all from table? Have a date key and keep a few days' data?
- Need to manually add environment variables. Is there a better way? 
- Comparison algorithm will need to scale
- How should previous data be stored to facilitate comparison
