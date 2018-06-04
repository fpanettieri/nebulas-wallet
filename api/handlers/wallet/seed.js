'use strict';

const aws = require('aws-sdk');
const doc_client = new aws.DynamoDB.DocumentClient();

const THROTTLE_IP = 1 * 60 * 1000;
const THROTTLE_EMAIL = 5 * 60 * 1000;

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

function seedWallet (wallet_rec, address, email) {
  let now = (new Date()).valueOf();

  if(wallet_rec.Item) {
    throw new Error('This wallet has already requested seed funds.');

  } else {
    return doc_client.put({
      TableName: 'nas-wallets',
      Item: { address: address, email: email,  status: 'pending', last_access: now }
    }).promise();
  }
}

function wallet_seed (email, address, ip) {
  if (!email || !address) { throw new Error('Email and address are required to seed.'); }

  return getIp(ip)
    .then(ip_rec => throttleIp(ip_rec, ip))
    .then(() => getEmail(email))
    .then(email_rec => throttleEmail(email_rec, email))
    .then(() => getWallet(address))
    .then(wallet_rec => seedWallet(wallet_rec, address, email));
}

module.exports = wallet_seed;
