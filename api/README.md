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

aws iam put-role-policy --role-name nebulas-wallet-api-executor --policy-name NebulasWalletApiS3 --policy-document file://./roles/s3.json --output json

### Environment
export NAS_S3_BUCKET=nas_wallets
export NAS_S3_OBJECT=testnet/n1XirqBT6FpNDuBPDnKZpZKBY8qfpjzAp75.json
export NAS_CONTRACT=n1vmXSPPAh31y3H18Uh3KYGKswyKfSYCzPH
export NAS_PASSPHRASE=$S0me/Passw0rd_
export NAS_NETWORK=https://testnet.nebulas.io

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
