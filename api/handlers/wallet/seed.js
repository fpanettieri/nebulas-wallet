'use strict';

const aws = require('aws-sdk');
const s3 = new aws.S3();
const doc_client = new aws.DynamoDB.DocumentClient();

const Nebulas = require('nebulas');
const Account = Nebulas.Account;
const Neb = new Nebulas.Neb();

const THROTTLE_IP = 1 * 60 * 1000;
const THROTTLE_EMAIL = 5 * 60 * 1000;
const NONCE_RADIX = 10;
const GAS_PRICE = 1000000;
const GAS_LIMIT = 2000000;

function getIp (ip) {
  return doc_client.get({ TableName: 'nas-ips', Key: { ip: ip } }).promise();
}

function getEmail (email) {
  return doc_client.get({ TableName: 'nas-emails', Key: { email: email } }).promise();
}

function getWallet (address) {
  return doc_client.get({ TableName: 'nas-wallets', Key: { address: address } }).promise();
}

function throttleIp (ip_rec, ip) {
  let now = (new Date()).valueOf();

  if(ip_rec.Item) {
    let last_access = ip_rec.Item.last_access;
    if ((now - last_access) < THROTTLE_IP) {
      throw new Error('This ip has requested funds recently. Wait a few seconds before trying again.');
    }

    return doc_client.update({
      TableName: 'nas-ips',
      Key: { ip: ip },
      ReturnValues: 'NONE',
      UpdateExpression: 'SET #last_access = :last_access',
      ExpressionAttributeValues: { ":last_access": now },
      ExpressionAttributeNames: { "#last_access" : "last_access" }
    }).promise();

  } else {
    return doc_client.put({
      TableName: 'nas-ips',
      Item: { ip: ip, last_access: now }
    }).promise();
  }
}

function throttleEmail (email_rec, email) {
  let now = (new Date()).valueOf();

  if(email_rec.Item) {
    let last_access = email_rec.Item.last_access;
    if ((now - last_access) < THROTTLE_EMAIL) {
      throw new Error('This email has requested funds recently. Wait a few minutes before trying again.');
    }

    return doc_client.update({
      TableName: 'nas-emails',
      Key: { email: email },
      ReturnValues: 'NONE',
      UpdateExpression: 'SET #last_access = :last_access',
      ExpressionAttributeValues: { ":last_access": now },
      ExpressionAttributeNames: { "#last_access" : "last_access" }
    }).promise();

  } else {
    return doc_client.put({
      TableName: 'nas-emails',
      Item: { email: email, last_access: now }
    }).promise();
  }
}

function fetchAccount (s3_bkt, s3_obj) {
  return s3.getObject({ Bucket: s3_bkt, Key: s3_obj }).promise();
}

function callContract (s3_res, nas_pass, nas_contract, nas_network, address) {
  Neb.setRequest(new Nebulas.HttpRequest(nas_network));

  let account = new Account();
  account.fromKey(s3_res.Body.toString(), nas_pass);

  let neb_state = null;
  return Neb.api.getNebState().then((state) => {
    neb_state = state;
    return Neb.api.getAccountState(account.getAddressString());
  }).then((acc_state) => {
    let nonce = parseInt(acc_state.nonce, NONCE_RADIX);

    let tx = new Nebulas.Transaction({
      chainID: neb_state.chain_id,
      from: account,
      to: nas_contract,
      value: 0,
      nonce: (nonce + 1),
      gasPrice: GAS_PRICE,
      gasLimit: GAS_LIMIT,
      contract: {
        function: 'seedWallet',
        args: '["' + address + '"]'
      }
    });
    tx.signTransaction();
    return Neb.api.sendRawTransaction({ data: tx.toProtoString() });
  });
}

function seedWallet (wallet_rec, address, email) {
  let now = (new Date()).valueOf();

  if(wallet_rec.Item) {
    throw new Error('This wallet has already requested seed funds.');

  } else {
    return doc_client.put({
      TableName: 'nas-wallets',
      Item: { address: address, email: email, last_access: now }
    }).promise();
  }
}

function wallet_seed (email, address, ip, s3_bkt, s3_obj, nas_pass, nas_contract, nas_network) {
  if (!email || !address) { throw new Error('Email and address are required to seed.'); }

  return getIp(ip)
    .then(ip_rec => throttleIp(ip_rec, ip))
    .then(() => getEmail(email))
    .then(email_rec => throttleEmail(email_rec, email))
    .then(() => getWallet(address))
    .then(wallet_rec => seedWallet(wallet_rec, address, email))
    .then(() => fetchAccount(s3_bkt, s3_obj))
    .then(s3_res => callContract(s3_res, nas_pass, nas_contract, nas_network, address));
}

module.exports = wallet_seed;
