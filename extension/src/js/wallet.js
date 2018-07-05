(function(){
  'use strict';

  const MAINNET_URL = 'https://mainnet.nebulas.io';
  const TESTNET_URL = 'https://testnet.nebulas.io';
  const EXPLORER_URL = 'https://explorer.nebulas.io/#/';
  const MARKET_URL = 'https://api.coinmarketcap.com/v2/ticker/1908/';
  const SEED_URL = 'https://api.nebulaswallet.app/seed';

  const NETWORK_MAINNET = 'mainnet';
  const NETWORK_TESTNET = 'testnet';

  const HTTP_STATUS_OK = 200;
  const HTTP_STATUS_ERROR = 400;
  const KEYCODE_ENTER = 13;
  const QR_MARGIN = 1;
  const QR_SIZE = 128;
  const GAS_PRICE = 1000000;
  const GAS_LIMIT = 2000000;
  const PASS_MIN_LENGTH = 8;
  const PASS_MAX_LENGTH = 128;
  const NONCE_RADIX = 10;
  const TX_STATUS_FAILED = 0;
  const TX_STATUS_SUCCESS = 1;
  const TX_STATUS_PENDING = 2;
  const UPDATE_INTERVAL = 5000;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const FIXED_SIZE = 10;

  const Nebulas = require('nebulas');
  const Account = Nebulas.Account;
  const Utils = Nebulas.Utils;
  const Neb = new Nebulas.Neb();

  // $refs
  let $body = $('body');
  let $view = $('.splash.view');

  // Persistence
  let theme = 'light';
  let account = null;
  let nonce = 0;
  let unapproved = [];
  let pending = [];
  let txs = {};

  // Model
  let acc_state = null;
  let neb_state = null;
  let gas = {price: GAS_PRICE, limit: GAS_LIMIT};
  let market = localStorage['nebulas.wallet.market'];
  let network = localStorage['nebulas.wallet.network'] || NETWORK_MAINNET;

  // Global
  function noop () {}

  function switchTheme () {
    if (theme == 'light') {
      theme = 'dark';
      $body.addClass('dark');
    } else {
      theme = 'light';
      $body.removeClass('dark');
    }
    chrome.storage.local.set({theme: theme});
  }

  function switchView (v) {
    if ($view) { $view.addClass('hidden'); }
    $view = $('.view.' + v);
    $view.removeClass('hidden');
    geb_trigger('view:' + v);
  }

  function checkChromeError () {
    if (!chrome.runtime.lastError) { return; }
    notify('Chrome Runtime Error', chrome.runtime.lastError);
  }

  function notify (title, msg) {
    geb_trigger('notify', {title: title, msg: msg});
  }

  function xhr (url, success, error) {
    let req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.onload = function() {
      if (req.status >= HTTP_STATUS_OK && req.status < HTTP_STATUS_ERROR) {
        success(req.responseText, req.status, req);
      } else {
        error(req.status, req);
      }
    }
    req.onerror = error;
    req.send();
  }

  function onEnter (fn) {
    return function (ev) { if (ev.keyCode == KEYCODE_ENTER) { fn.call(); } }
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

  function getBgCache (cb) {
    chrome.runtime.sendMessage({
      logo: 'nebulas',
      src: 'wallet',
      type: 'cache'
    }, cb);
  }

  // Events
  let _geb = {};

  function geb_on (type, fn) {
    if (Array.isArray(_geb[type])) {
      _geb[type].push(fn);
    } else {
      _geb[type] = [fn];
    }
  }

  function geb_off (type, fn) {
    if (typeof _geb == 'undefined' || typeof _geb[type] == 'undefined' || !Array.isArray( _geb[type]) ) { return; }
    let idx = _geb[type].indexOf(fn);
    if (idx < 0) { return; }
    _geb[type].splice(idx, 1);
  }

  function geb_trigger (type) {
    if (typeof _geb == 'undefined' || typeof _geb[type] == 'undefined' || !Array.isArray( _geb[type]) ) { return; }
    for (let i = 0; i < _geb[type].length; i++) {
      _geb[type][i].apply(null, arguments);
    }
  }

  { // Onboard
    let $onboard = $('.onboard.view');

    $onboard.find('.create-btn').on('click', () => switchView('create'));
    $onboard.find('.theme-btn').on('click', () => switchTheme());
  }

  { // Create
    let $create = $('.create.view');
    let $pass = $create.find('input.password');
    let $check = $create.find('input.pass-check');

    function onConfirm () {
      let pass = $pass.val().trim();
      let check = $check.val().trim();

      if (pass.length < PASS_MIN_LENGTH) { return notify('Short Password', 'You password must be at least ' + PASS_MIN_LENGTH + ' characters long'); }
      if (pass.length > PASS_MAX_LENGTH) { return notify('Long Password', 'You password must be at most ' + PASS_MAX_LENGTH + ' characters long'); }
      if (pass !== check) { return notify('Wrong Confirmation', 'You password confirmation doesn\'t match your password'); }

      account = Account.NewAccount();
      chrome.storage.local.set({account: account.toKey(pass), account_str: account.toKeyString(pass)});
      geb_trigger('account:ready');

      switchView(unapproved.length > 0 ? 'nebpay' : 'account');
    }

    $create.find('.cancel-btn').on('click', () => switchView('onboard'));
    $create.find('.confirm-btn').on('click', onConfirm);
    $pass.on('keypress', onEnter(onConfirm));
    $check.on('keypress', onEnter(onConfirm));
  }

  { // Unlock
    let $unlock = $('.unlock.view');
    let $pass = $unlock.find('input.password');

    function onUnlock () {
      let pass = $pass.val().trim();

      chrome.storage.local.get(['account'], function (result) {
        checkChromeError();
        try {
          account = new Account();
          account.fromKey(result.account, pass);
          geb_trigger('account:ready');

          switchView(unapproved.length > 0 ? 'nebpay' : 'account');
        } catch (err) {
          notify('Unlock Failed', err);
        }
      });
    }

    $unlock.find('.unlock-btn').on('click', onUnlock);
    $pass.on('keypress', onEnter(onUnlock));
  }

  { // Account
    let $account = $('.account.view');
    let $nas = $account.find('.account-balance-nas');
    let $usd = $account.find('.account-balance-usd');

    function onReady () {
      Neb.api.getAccountState(account.getAddressString()).then((state) => {
        acc_state = state;
        nonce = parseInt(acc_state.nonce, NONCE_RADIX);
        chrome.storage.local.set({nonce: nonce});
        geb_trigger('account:balance');

        chrome.runtime.sendMessage({
          logo: 'nebulas',
          src: 'wallet',
          type: 'account',
          state: state,
          pk: account.getPrivateKeyString()
        });
      });
    }

    function onBalance() {
      if (!acc_state) { return; }
      let nas = Nebulas.Unit.fromBasic(acc_state.balance);
      $nas.text(nas.toFixed(FIXED_SIZE) + ' NAS');
      $usd.text('');

      if (!market) { return; }
      let price = market['data']['quotes']['USD']['price'];
      let usd = nas.times(price);
      $usd.text(usd.toFixed(FIXED_SIZE) + ' USD');
    }

    $account.find('.settings-btn').on('click', () => switchView('settings'));
    $account.find('.account-balance').on('click', () => switchView('txs'));
    $account.find('.send-btn').on('click', () => switchView('send'));
    $account.find('.receive-btn').on('click', () => switchView('receive'));
    // $account.find('.buy-btn').on('click', () => switchView('buy'));

    geb_on('account:ready', onReady);
    geb_on('account:balance', onBalance);
  }

  { // Send
    let $send = $('.send.view');
    let $to = $send.find('input.to');
    let $amount = $send.find('input.amount');

    function onConfirm() {
      let to = $to.val().trim();
      let amount = $amount.val().trim();
      let wei = 0;
      let tx = null;

      if (!account || !acc_state) { return notify('Please Wait', 'Your account information has not been loaded yet.'); }
      if (!neb_state) { return notify('Please Wait', 'The network information has not been loaded yet.'); }
      if (!Account.isValidAddress(to)) { return notify('Invalid Address', 'Your destination address should start with an \'n\', followed by 34 characters. Please enter a valid address.'); }

      try {
        wei = Nebulas.Unit.nasToBasic(amount);
      } catch (err) {
        return notify('Invalid Amount', 'The transfer amount must be a number.');
      }

      if (wei < 0) { return notify('Invalid Amount', 'The amount sent must be >= 0. Please enter a valid number.'); }
      if (wei.gt(acc_state.balance)) { return notify('Insufficient Funds', 'The amount you are trying to send is more than your current balance.'); }

      tx = new Nebulas.Transaction({
        chainID: neb_state.chain_id,
        from: account,
        to: to,
        value: wei,
        nonce: (nonce + 1),
        gasPrice: gas.price,
        gasLimit: gas.limit
      });
      tx.signTransaction();

      notify('Sending Tx', 'Please wait ...');
      switchView('account');

      Neb.api.sendRawTransaction({ data: tx.toProtoString() }).then((r) => {
        $to.val('');
        $amount.val('');

        pending.push({ tx: tx.toPlainObject(), hash: r.txhash });
        chrome.storage.local.set({nonce: ++nonce, pending: pending});
        geb_trigger('txs:pending');

        notify('Success', 'Transaction sent! You can check the progress from the transactions list.');
        switchView('txs');
      }).catch((err) => {
        return notify('Raw Tx Error', err);
      });
    }

    $to.on('keypress', onEnter(onConfirm));
    $amount.on('keypress', onEnter(onConfirm));
    $send.find('.cancel-btn').on('click', () => switchView('account'));
    $send.find('.confirm-btn').on('click', onConfirm);
  }

  { // Receive
    let $receive = $('.receive.view');
    let $address = $receive.find('.receive-address');
    let $qr = $receive.find('.receive-qr');

    function onReady () {
      let addr = account.getAddressString();
      $address.val(addr);
      QRCode.toCanvas($qr[0], addr, {
        margin: QR_MARGIN,
        width: QR_SIZE
      }, (err) =>{ if(err) { notify('QR Code Error', err) }});
    }

    function onCopy() {
      $address[0].select();
      document.execCommand("copy");
      notify('Copied', 'Address copied to clipboard');
    }

    $receive.find('.cancel-btn').on('click', () => switchView('account'));
    $receive.find('.copy-btn').on('click', onCopy);

    geb_on('account:ready', onReady);
  }

  { // Txs
    let $txs = $('.txs.view');
    let $list = $txs.find('.txs-list');
    let $tpl = $list.find('.tx.template').remove().removeClass('template');
    let addr = null;

    let $notification = $('.notification.view');
    let height = $body.height() * 1.6;

    function zpad (t) {
      return t < 10 ? ('0' + t) : t;
    }

    function showTx (ev) {
      let $tx = $(this);
      let prefix = ( network == NETWORK_TESTNET ) ? 'testnet/' : '';
      chrome.tabs.create({ url: EXPLORER_URL + prefix + 'tx/' + $tx.data('hash') });
    }

    function txType (tx) {
      if (tx.contract) { return 'contract'; }
      else if (tx.from === addr ) { return 'sent'; }
      else if (tx.to === addr ) { return 'received'; }
      else { return 'unknown'; }
    }

    function receiptDate (receipt) {
      let d = new Date(receipt.timestamp * 1000);
      return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + zpad(d.getHours()) + ':' + zpad(d.getMinutes()) + ':' + zpad(d.getSeconds());
    }

    function receiptStatus (receipt) {
      switch (receipt.status) {
        case TX_STATUS_FAILED: return 'failed';
        case TX_STATUS_SUCCESS: return 'success';
        case TX_STATUS_PENDING: return 'pending';
        default: return 'unknown';
      }
    }

    function renderTxs () {
      $list.empty();

      Object.keys(txs).forEach((t) => {
        let tx = txs[t].tx;
        let receipt = txs[t].receipt;

        let type = txType(tx);
        let name = tx.contract ? tx.contract.function : type;
        let date = receiptDate(receipt);
        let status = receiptStatus(receipt);
        let amount = Nebulas.Unit.fromBasic(receipt.value);

        let $tx = $tpl.clone();
        $tx.addClass('tx-' + type);
        $tx.find('.tx-name').text(name);
        $tx.find('.tx-amount').text(amount + ' NAS');
        $tx.find('.tx-date').text(date);
        $tx.find('.tx-status').text(status);
        $tx.data('hash', receipt.hash);
        $list.prepend($tx);
      });
    }

    function onReady () {
      addr = account.getAddressString();
      renderTxs();
      if (pending.length > 0) {
        setTimeout(onPending, UPDATE_INTERVAL);
      }
    }

    function onPending () {
      let missing = pending.length;

      for (let i = 0; i < pending.length; i++) {
        let tx = pending[i].tx
        let hash = pending[i].hash;
        let req = pending[i].req;

        Neb.api.getTransactionReceipt({ hash: hash }).then((receipt) => {
          txs[receipt.timestamp] = {tx: tx, hash: hash, receipt: receipt};

          if (receipt.status === TX_STATUS_PENDING) { return; }
          pending = pending.filter(t => t.hash !== hash);

          if (!req) { return; }
          req.res = { result: receipt.execute_result, execute_err: receipt.execute_error, estimate_gas: receipt.gas_used };
          req.status = receiptStatus(receipt);
          chrome.runtime.sendMessage(req);

        }).catch((err) => {
          pending = pending.filter(t => t.hash !== hash);
          notify('Tx Receipt Error', err);
          console.error(err, hash);

        }).then(() => {
          if (--missing === 0) {
            chrome.storage.local.set({txs: txs, pending: pending});
            geb_trigger('account:ready');
          }
        });
      }
    }

    function onShow () {
      $notification.removeClass('short-view');
      $notification.addClass('long-view');
      window.resizeBy(0, height);
      window.moveBy(0, -(height / 2));
    }

    function onClose () {
      $notification.addClass('short-view');
      $notification.removeClass('long-view');
      window.resizeBy(0, -height);
      window.moveBy(0, (height / 2));
      switchView('account');
    }

    $txs.find('.cancel-btn').on('click', onClose);
    $list.on('click', '.tx', showTx);

    geb_on('account:ready', onReady);
    geb_on('txs:pending', onPending);
    geb_on('view:txs', onShow);
  }

  { // Notification
    let $notification = $('.notification.view');
    let $title = $notification.find('.head h1');
    let $body = $notification.find('.body p');

    function onNotify (ev, data) {
      $notification.removeClass('hidden');
      $title.text(data.title);
      $body.text(data.msg);
    }

    function onDismiss () {
      $notification.addClass('hidden');
    }

    geb_on('notify', onNotify);
    $notification.find('.dismiss-btn').on('click', onDismiss);
  }

  { // Settings
    let $settings = $('.settings.view');
    let $network = $settings.find('.network-btn');

    function onSeedSuccess (status, xhr) {
      notify('Seeding Wallet', 'You will receive your seed funds on the next minted block!')
    }

    function onSeedError (status, xhr) {
      try {
        let resp = JSON.parse(xhr.responseText);
        notify('Seed Error', resp.errorMessage);
      } catch(err) {
        notify('Seed Error', err);
      }
    }

    function onSeed () {
      chrome.permissions.request({ permissions: ['identity', 'identity.email'] }, (allowed) => {
        if (!allowed) {
          return notify('Permission Denied', 'In order to receive your seed funds, we need to validate your email.');
        }
        chrome.identity.getProfileUserInfo((info) => {
          if (info && info.email && info.id) {
            notify('Seeding Wallet', 'Please Wait a few seconds ...');
            xhr(SEED_URL + '?e=' + info.email + '&a=' + account.getAddressString(), onSeedSuccess, onSeedError);
          }
        });
      });
    }

    function onNetwork () {
      network = network == NETWORK_MAINNET ? NETWORK_TESTNET : NETWORK_MAINNET;
      localStorage['nebulas.wallet.network'] = network;
      showNetwork();
      updateNetwork();
      geb_trigger('account:ready');
    }

    function onExport () {
      chrome.permissions.request({ permissions: ['downloads'] }, (allowed) => {
        if (!allowed) {
          return notify('Permission Denied', 'In order to export your wallet, we need additional permissions.');
        }

        chrome.storage.local.get(['account_str'], function (result) {
          checkChromeError();
          try {
            let blob = new Blob([result.account_str]);
            let url = URL.createObjectURL(blob);
            let filename = account.getAddressString() + ".json";
            chrome.downloads.download({ url: url, filename: filename});
          } catch (err) {
            notify('Download Failed', err);
          }
        });
      });
    }

    function showNetwork () {
      let name = '?';
      switch (network) {
        case NETWORK_MAINNET: name = 'Main'; break;
        case NETWORK_TESTNET: name = 'Test'; break;
        default: console.error('Unknown network:', network);
      }
      $network.text('Network: ' + name);
    }

    $settings.find('.seed-btn').on('click', onSeed);
    $settings.find('.network-btn').on('click', onNetwork);
    $settings.find('.export-btn').on('click', onExport);
    $settings.find('.export-btn').on('click', onExport);
    $settings.find('.theme-btn').on('click', () => switchTheme());
    $settings.find('.cancel-btn').on('click', () => switchView('account'));

    showNetwork();
  }

  { // NebPay
    let $nebpay = $('.nebpay.view');
    let $brand = $nebpay.find('.brand-name');
    let $call_fn = $nebpay.find('.nebpay-call-fn');
    let $call_args = $nebpay.find('.nebpay-call-args');
    let $call_amount = $nebpay.find('.nebpay-call-amount');
    let $to = $nebpay.find('.nebpay-detail.to input');
    let $amount = $nebpay.find('.nebpay-detail.amount input');
    let $fn = $nebpay.find('.nebpay-detail.fn input');
    let $args = $nebpay.find('.nebpay-detail.args input');
    let $gas_limit = $nebpay.find('.nebpay-detail.gas-limit input');
    let $gas_price = $nebpay.find('.nebpay-detail.gas-price input');

    let height = $body.height();
    let detailed = false;
    let type = null;

    function onShow () {
      let req = unapproved[0];
      type = req.params.pay.payload.type;

      $brand.text(req.dapp);

      if (type === 'binary'){
        $call_fn.text('Payment');
      } else {
        $call_fn.text(req.params.pay.payload.function);
        $call_args.text(req.params.pay.payload.args || '[ ]');
        $fn.val(req.params.pay.payload.function);
        $args.val(req.params.pay.payload.args);
      }

      $call_amount.text('Amount: ' + req.params.pay.value + ' wei');
      $to.val(req.params.pay.to);
      $amount.val(req.params.pay.value);

      $gas_limit.val(gas.limit);
      $gas_price.val(gas.price);
    }

    function onDetails () {
      window.resizeBy(0, detailed ? -height : height);
      window.moveBy(0, detailed ? (height / 2) : -(height / 2));
      detailed = !detailed;

      $nebpay.toggleClass('short-view');
      $nebpay.toggleClass('medium-view');
    }

    function onCancel () {
      let req = unapproved.shift();
      chrome.storage.local.set({unapproved: unapproved});
      req.src = 'wallet';
      req.status = 'rejected';
      chrome.runtime.sendMessage(req);
      if (detailed) {
        window.resizeBy(0, -height);
        window.moveBy(0, (height / 2));
      }
      switchView('account');
    }

    function onConfirm () {
      let to = $to.val().trim();
      let amount = $amount.val().trim();
      let fn = $fn.val().trim();
      let args = $args.val().trim();
      let gas_limit = $gas_limit.val().trim();
      let gas_price = $gas_price.val().trim();
      let req = unapproved[0];
      let wei = 0;
      let tx = null;
      let txData = null;

      if (!account || !acc_state) { return notify('Please Wait', 'Your account information has not been loaded yet.'); }
      if (!neb_state) { return notify('Please Wait', 'The network information has not been loaded yet.'); }
      if (!Account.isValidAddress(to)) { return notify('Invalid Address', 'Your destination address should start with an \'n\', followed by 34 characters. Please enter a valid address.'); }
      if (type !== 'binary' && !fn) { return notify('Invalid Function', 'The function name can\'t be empty.'); }

      try {
        wei = Utils.toBigNumber(amount);
      } catch (err) {
        return notify('Invalid Amount', 'The transfer amount must be a number.');
      }

      if (wei < 0) { return notify('Invalid Amount', 'The amount sent must be >= 0. Please enter a valid number.'); }
      if (wei.gt(acc_state.balance)) { return notify('Insufficient Funds', 'The amount you are trying to send is more than your current balance.'); }

      try {
        txData = {
          chainID: neb_state.chain_id,
          from: account,
          to: to,
          value: wei,
          nonce: (nonce + 1),
          gasPrice: gas_price,
          gasLimit: gas_limit,
          serialNumber: req.params.serialNumber,
          callback: req.params.callback
        }

        switch (type) {
          case 'binary': {
            // noop
          } break;

          case 'deploy': {
            txData.contract = {
              source: req.params.pay.payload.source,
              sourceType: req.params.pay.payload.sourceType,
              args: args
            };
          } break;

          case 'call': {
            txData.contract = { function: fn, args: args };
          } break;

          default: {
            return notify('Invalid Tx Type', 'The transaction you are trying to send has an invalid type: ' + type);
          }
        }
      } catch (err) {
        return notify('Tx Error', err);
      }

      tx = new Nebulas.Transaction(txData);
      tx.signTransaction();

      if (detailed) { onDetails(); }
      notify('Sending Tx', 'Please wait ...');
      switchView('account');

      Neb.api.sendRawTransaction({ data: tx.toProtoString() }).then((r) => {
        let req = unapproved.shift();
        req.src = 'wallet';
        req.status = 'submitted';
        chrome.runtime.sendMessage(req);

        pending.push({ tx: tx.toPlainObject(), hash: r.txhash, req: req });
        chrome.storage.local.set({nonce: ++nonce, pending: pending, unapproved: unapproved});
        geb_trigger('txs:pending');

        notify('Success', 'Transaction sent! You can check the progress from the transactions list.');
        switchView('txs');
      }).catch((err) => {
        return notify('Raw Tx Error', err);
      });
    }

    $nebpay.find('.nebpay-call').on('click', onDetails);
    $nebpay.find('.cancel-btn').on('click', onCancel);
    $nebpay.find('.confirm-btn').on('click', onConfirm);

    geb_on('view:nebpay', onShow);
  }

  { // Initialization
    updateNetwork();

    let stored_data = {
      theme: 'light',
      account: null,
      nonce: 0,
      unapproved: [],
      pending: [],
      txs: {}
    }

    chrome.storage.local.get(stored_data, function (result) {
      checkChromeError();

      nonce = result.nonce;
      unapproved = result.unapproved;
      pending = result.pending;
      txs = result.txs;
      theme = result.theme;

      if (result.theme === 'dark') { $body.addClass('dark'); }

      getBgCache(cache => {
        console.log('[WALLET].getBgCache CALLBACK', cache);
        if (cache) {
          account = new Nebulas.Account(cache);
          geb_trigger('account:ready');
          switchView(unapproved.length > 0 ? 'nebpay' : 'account');
        } else {
          account = result.account;
          switchView(account ? 'unlock' : 'onboard');
        }
      })
    });

    xhr(MARKET_URL, function (r) {
      market = JSON.parse(r);
      localStorage['nebulas.wallet.market'] = market;
    });
  }
})()
