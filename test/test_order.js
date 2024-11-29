/**
 * @description 有序性测试
 * @author 锦恢
 */

const fs = require('fs');
const { makeVcdStream } = require('../bin/vcd');
const createVcd = require('../out/vcd.js');

/**
 * 
 * @param {number[][]} waves
 * @returns {boolean} 
 */
function isordered(waves) {    
    let lastTime = undefined;
    let i = 0;
    for (const wave of waves) {
        const time = wave[0];
        if (lastTime !== undefined && lastTime > time) {
            console.error('detect error time, current time: ' + time, ', last time: ' + lastTime);
            console.log(waves[i - 2]);
            console.log(waves[i - 1]);
            console.log(waves[i]);
            console.log(waves[i + 1]);
            console.log(waves[i + 2]);
            console.log(waves[i + 3]);
            
            return false;
        }
        lastTime = time;
        i ++;
    }
    return true;
}

async function main() {
    // 初始化 wasm
    const wasmBinary = fs.readFileSync('./out/vcd.wasm');
    const vcdstream = await makeVcdStream({ wasmBinary });

    // 读入 vcd 转换成 arraybuffer 输入 其中进行计算
    const arraybuffer = fs.readFileSync('test/SIMv0.2/Tb_Sync_FIFO.vcd');
    vcdstream.consume(arraybuffer);
    const info = vcdstream.getBasicInfo();
    const values = info.signalValues;
    console.log('time', info.time);
    console.log('timescale', info.vcdInfo.timescale);
    

    // clk link is #
    // 每隔 12500 翻转一次
    console.log(isordered(values['#'].wave));
}

main();