const fs = require('fs');
const { makeVcdStream } = require('../bin/vcd');
const createVcd = require('../out/vcd.js');

async function main() {
    const wasmBinary = fs.readFileSync('./vcd.wasm');
    const wasm = await createVcd({ wasmBinary });
    console.log(wasm);
    

    return;

    // const vcdstream = await makeVcdStream();
    // const arraybuffer = fs.readFileSync('./test/samples/iverilog.small.vcd');
    // const answers = JSON.parse(fs.readFileSync('./test/samples/iverilog.small.json'));
    
    // vcdstream.consume(arraybuffer);
    // const info = vcdstream.getBasicInfo();
    // const values = info.signalValues;
}


main();