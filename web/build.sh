#!/bin/bash
mkdir -p dist

# static
cp src/favicon.ico src/robots.txt src/sitemap.txt dist/

# html
pug -b src < src/pug/index.pug > dist/index.html
pug -b src < src/pug/404.pug > dist/404.html

# img
ditto src/img dist/img

# css
mkdir -p dist/css
node-sass src/css/style.scss src/css/style.css
cleancss -o dist/css/style.min.css src/css/style.css

# js
mkdir -p dist/js
cp -rf src/js/*.min.js dist/js/
uglifyjs src/js/stars.js -c -m -o dist/js/stars.min.js
uglifyjs src/js/util.js -c -m -o dist/js/util.min.js
