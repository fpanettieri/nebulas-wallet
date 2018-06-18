(function(){
  'use strict';

  const POPUP_WIDTH = 352;
  const POPUP_HEIGHT = 240;
  const NETWORK_MAINNET = 'mainnet';
  const NETWORK_TESTNET = 'testnet';
  const MAINNET_URL = 'https://mainnet.nebulas.io';
  const TESTNET_URL = 'https://testnet.nebulas.io';
  const GAS_PRICE = 1000000;
  const GAS_LIMIT = 2000000;

  const Nebulas = require('nebulas');
  const Neb = new Nebulas.Neb();

  let network = localStorage['nebulas.wallet.network'] || NETWORK_MAINNET;
  let neb_state = null;
  let account = null;
  let nonce = 0;
  let gas = {price: GAS_PRICE, limit: GAS_LIMIT};

  let simulated = [];
  let unapproved = [];
  let callbacks = {};

  function checkChromeError () {
    if (!chrome.runtime.lastError) { return; }
    console.error('Chrome Runtime Error', chrome.runtime.lastError);
  }

  function updateBadge () {
    chrome.browserAction.setBadgeText({text: unapproved.length ? unapproved.length.toString() : ''});
  }

  function updateNetwork () {
    let url = null;

    switch (network) {
      case NETWORK_MAINNET: url = MAINNET_URL; break;
      case NETWORK_TESTNET: url = TESTNET_URL; break;
      default: console.error('Unknown network:', network);
    }

    Neb.setRequest(new Nebulas.HttpRequest(url));
    Neb.api.getNebState().then((state) => { neb_state = state });
    Neb.api.gasPrice().then(r => { gas.price = r.gas_price });
  }

  function openPopup () {
    chrome.windows.create({
      type : 'popup',
      url: chrome.runtime.getURL('html/wallet.html'),
      left: (screen.width  - POPUP_WIDTH) / 2,
      top: (screen.height  - POPUP_HEIGHT) / 2,
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
      focused: true
    });
  }

  function fetchUnapproved () {
    chrome.storage.local.get({ unapproved: [] }, (result) => {
      checkChromeError();
      unapproved = result.unapproved;
      updateBadge();
    });
  }

  function onMessage (req, sender) {
    if (req.logo !== 'nebulas') { return; }

    if (req.src === 'nebPay') {
      try {
        validateReq(req)
      } catch (err) {
        return sendResponse('Invalid request: ', err);
      }

      let type = req.params.pay.payload.type;
      if (type === 'call') {
        onCallMsg(req, sender);
      } else if (type === 'simulateCall') {
        onSimulateMsg(req, sender);
      } else {
        throw 'unknown msg type: ' + type;
      }
    }

    if (req.src === 'wallet') {
      if (req.type === 'account') {
        onAccount(req);
      } else {
        // TODO: ???
        onWalletMsg(req);
      }
    }
  }

  function validateReq (req) {
    if (!req.params) { throw 'missing params'; }
    if (!req.params.serialNumber) { throw 'missing serialNumber'; }
    if (!req.params.callback) { throw 'missing callback'; }
    if (!req.params.pay) { throw  'missing pay'; }
    if (!req.params.pay.payload) { throw 'missing serialNumber'; }
    if (!req.params.pay.payload.type) { throw 'missing payload.type'; }
    if (!req.params.pay.payload.function) { throw 'missing payload.function'; }
    return true;
  }

  function onCallMsg (req, sender) {
    callbacks[req.params.serialNumber] = {sender: sender, params: req.params};
    unapproved.push(req);
    updateBadge();
    chrome.storage.local.set({unapproved: unapproved}, openPopup);
  }

  function onSimulateMsg (req, sender) {
    callbacks[req.params.serialNumber] = {sender: sender, params: req.params};
    simulated.push(req);
    if (!account) {
      openPopup();
      return;
    }
    simulateCalls();
  }

  function onAccount (req) {
    account = {
      addr: req.addr,
      state: req.state
    }
    simulateCalls();
  }

  function simulateCalls () {
    for (let i = 0; i < simulated.length; i++) {
      let req = simulated[i];
      Neb.api.call({
        from: account.addr,
        to: req.params.pay.to,
        value: req.params.pay.value,
        nonce: ++nonce,
        gasPrice: gas.price,
        gasLimit: gas.limit,
        contract: {
          function: req.params.pay.payload.function,
          args: req.params.pay.payload.args
        }
      }).then(r => {
        simulated.splice(i, 1);
        req.res = r;
        sendMsgToTab(req);
      });
    }
  }

  function onWalletMsg (req) {
    fetchUnapproved();
    if (req.status === 'success' || req.status === 'failed') {
      sendMsgToTab(req);
    }
  }

  function sendMsgToTab (req) {
    let serial = req.params.serialNumber;

    let callback = callbacks[serial];
    if (!callback) { return; }

    chrome.tabs.sendMessage(callback.sender.tab.id, {
      'src' : 'background',
      'logo' : 'nebulas',
      'serialNumber' : serial,
      'resp' : req.res
    });
    delete callbacks[serial];
  }

  { // Initialization
    updateNetwork();
    chrome.runtime.onMessage.addListener(onMessage);
    fetchUnapproved();
  }
})();
