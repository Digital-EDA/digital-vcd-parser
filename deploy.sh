browserify ./bin/vcd.js | terser --compress -o ./out/vcd-web.js
sed -i -e 's/wasmBinaryFile=Module.locateFile?Module.locateFile(path,scriptDirectory):scriptDirectory+path/wasmBinaryFile=self.location.href.replace("worker.js", "vcd.wasm")/g' out/vcd-web.js
cp out/vcd-web.js $1/public/vcd.js
cp out/vcd.wasm $1/public/vcd.wasm