(function(){
  'use strict';

  { // Inject extension
    let s = document.createElement('script');
    s.appendChild(document.createTextNode('var webExtensionWallet = "Nebulas Wallet";'));
    (document.body || document.head || document.documentElement).appendChild(s);
    s.onload = s.remove;
  }

  {
    function onWindowMsg (ev) {
      if (!ev.isTrusted) { return; }
      if (ev.data.logo !== 'nebulas' || ev.data.src !== 'nebPay') { return; }
      if (!ev.data.hasOwnProperty('dapp')) { ev.data.dapp = ev.source.document.title || 'NAS DApp'; }
      chrome.runtime.sendMessage(ev.data);
    }

    function onMessage (req, sender) {
      if(req.logo !== 'nebulas' || req.src !== 'background'){ return; }
      req.src = 'content'
      window.postMessage(req, '*');
    }

    chrome.runtime.onMessage.addListener(onMessage);
    window.addEventListener('message', onWindowMsg);
  }
})();
