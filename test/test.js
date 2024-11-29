/**
 * @description 普通测试
 * @author 锦恢
 * @script node test/test.js
 */

const fs = require('fs');
const { makeVcdStream } = require('../bin/vcd');
const createVcd = require('../out/vcd.js');

async function main() {
    // 初始化 wasm
    const wasmBinary = fs.readFileSync('./out/vcd.wasm');
    const vcdstream = await makeVcdStream({ wasmBinary });

    // 读入 vcd 转换成 arraybuffer 输入 其中进行计算
    const arraybuffer = fs.readFileSync('./test/samples/iverilog.small.vcd');
    const answers = JSON.parse(fs.readFileSync('./test/samples/iverilog.small.json'));
    
    vcdstream.consume(arraybuffer);
    const info = vcdstream.getBasicInfo();
    const values = info.signalValues;
    console.log(values);
}

main();