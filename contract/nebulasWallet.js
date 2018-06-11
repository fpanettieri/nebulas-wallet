'use strict';

const NAS_TO_WEI = new BigNumber(1000000000000000000);
const ZERO = new BigNumber(0);
const MIN_SEED = new BigNumber(0.000001);
const MAX_SEED = new BigNumber(1);
const SEED = MIN_SEED;

var NebulasWallet = function () {
  let bnProp = {
 		parse: function (b) { return new BigNumber(b); },
 		stringify: function (o) { return o.toString(); }
	};

  LocalContractStorage.defineProperty(this, 'root');
  LocalContractStorage.defineProperty(this, 'seed', bnProp);
  LocalContractStorage.defineProperty(this, 'balance', bnProp);
  LocalContractStorage.defineMapProperty(this, 'wallets');
};

NebulasWallet.prototype = {
  init: function () {
    this.root = Blockchain.transaction.from;
    this.seed = SEED;
    this.balance = new BigNumber(0);
  },

  deposit: function () {
    if (Blockchain.transaction.value.lte(ZERO)) {
      throw new Error('NAS sent should be > 0');
    }
    if (Blockchain.transaction.from !== this.root) {
      throw new Error('Only the root account can deposit seed funds.');
    }

    this.balance = this.balance.plus(Blockchain.transaction.value.div(NAS_TO_WEI));
  },

  seedWallet: function (addr) {
    if (Blockchain.transaction.value.gt(ZERO)) {
      throw new Error('NAS sent should be 0');
    }
    if (Blockchain.transaction.from !== this.root) {
      throw new Error('Only the root account can send seed funds');
    }
    if (!Blockchain.verifyAddress(addr)) {
      throw new Error('Invalid wallet address');
    }
    if (!!this.wallets.get(addr)) {
      throw new Error('Wallet already seeded');
    }

    let reminder = this.balance.minus(this.seed);
    if (reminder.lte(ZERO)) {
      throw new Error('Not enough funds to seed wallet');
    }

    let result = Blockchain.transfer(addr, this.seed.times(NAS_TO_WEI));
    if (!result) { throw new Error("Seed transfer failed"); }

    this.wallets.set(addr, this.seed);
    this.balance = reminder;
  },

  setSeed: function (seed) {
    if (Blockchain.transaction.value.gt(ZERO)) {
      throw new Error('NAS sent should be 0');
    }
    if (Blockchain.transaction.from !== this.root) {
      throw new Error('Only the root account can update the seed amount');
    }

    seed = new BigNumber(seed);
    if (seed.lt(MIN_SEED) || seed.gt(MAX_SEED)) {
      throw new Error('Seed is out of bounds');
    }

    this.seed = seed;
  },

  getSeed: function () {
    return this.seed;
  },

  getBalance: function () {
    return this.balance;
  }
};

module.exports = NebulasWallet;
