#!/bin/bash
cd ~/dev/nas-wallet
node server.js &> /dev/null &

cd $GOPATH/src/github.com/nebulasio/go-nebulas
./neb -c conf/default/config.conf &
./neb -c conf/example/miner.conf &

tail -F logs/miner.1/neb.log | grep --line-buffered 'Minted new block' | while read ; do say -v Samantha "Minted new block"; done
