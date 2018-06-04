#!/bin/bash

# static
mkdir -p dist
cp src/manifest.json dist/

# html
mkdir -p dist/html
pug -b src < src/pug/wallet.pug > dist/html/wallet.html

# img
ditto src/img dist/img

# fonts
ditto src/fonts dist/fonts

# css
mkdir -p dist/css
node-sass src/css/wallet.scss | cleancss -o dist/css/wallet.min.css

# js
mkdir -p dist/js
cp -f src/js/*.min.js dist/js/
uglifyjs src/js/wallet.js -c -m -o dist/js/wallet.min.js
uglifyjs src/js/background.js -c -m -o dist/js/background.min.js
uglifyjs src/js/content.js -c -m -o dist/js/content.min.js
