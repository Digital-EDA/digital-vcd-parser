browserify ./bin/vcd.js | terser --compress -o ./out/vcd-web.js
cp out/vcd-web.js $1/public/vcd.js
cp out/vcd.wasm $1/public/vcd.wasm
