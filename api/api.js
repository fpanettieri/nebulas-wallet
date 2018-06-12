'use strict';

const Api = require('claudia-api-builder');
const api = new Api();

const wallet_seed = require('./handlers/wallet/seed');

api.get('/beep', () => 'boop');

api.get('/seed', (req) => {
  return wallet_seed(
    req.queryString.e,
    req.queryString.a,
    req.context.sourceIp,
    req.env.NAS_S3_BUCKET,
    req.env.NAS_S3_OBJECT,
    req.env.NAS_PASSPHRASE,
    req.env.NAS_CONTRACT,
    req.env.NAS_NETWORK
  );
});

module.exports = api;
