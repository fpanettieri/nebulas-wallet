# Nebulas Wallet API

Helper API for Nebulas Wallet

## Command Line Interface

### Init
npm init
npm install claudia -g
npm install claudia-api-builder -S

### Create
claudia create --region us-west-2 --api-module api

### Setup Policies
aws iam put-role-policy --role-name nebulas-wallet-api-executor --policy-name NebulasWalletApiDynamoDB --policy-document file://./roles/dynamodb.json --output json

### Test
curl https://XXXXXXXXXX.execute-api.us-west-2.amazonaws.com/latest/ping

### Update
claudia update
claudia update --cache-api-config configcache
SECONDS=0 && claudia update --cache-api-config configcache && echo $SECONDS

### Destroy
claudia destroy

### Logs
bin/debug
bin/clear

## Cleanup
aws iam delete-role-policy --role-name nebulas-wallet-api-executor --policy-name NebulasWalletApiDynamoDB
aws iam delete-role-policy --role-name nebulas-wallet-api-executor --policy-name log-writer
aws iam delete-role --role-name nebulas-wallet-api-executor
aws lambda delete-function --function-name nebulas-wallet-api
