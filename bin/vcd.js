/* eslint-disable no-undef */
'use strict';

const createVCD = require('../out/vcd.js');
const webVcdParser = require('../lib/web-vcd-parser.js');

/**
 * @typedef {{ maxChunkLength: number, useGcd: boolean }} consumeConfig
 * 
 * @typedef {{ kind: string, wave: number[] }} vcdValue
 * 
 * @typedef {Object} VarSignal
 * @property { 'var' } kind
 * @property { 'event' | 'integer' | 'parameter' | 'real' | 'realtime' | 'reg' | 'supply0' | 'supply1' | 'time' | 'tri' | 'triand' | 'trior' | 'trireg' | 'tri0' | 'tri1' | 'wand' | 'wire' | 'wor' | 'string' } type
 * @property {string} name 信号的真实名字
 * @property {string} link 信号的 id
 * @property {number} size 位宽
 * 
 * @typedef {Object} ScopeSignal
 * @property { 'scope' } kind
 * @property { 'module' | 'begin' | 'fork' | 'function' | 'task' } type
 * @property {string} name
 * @property {ScopeSignal[]} body
 * 
 * @typedef { VarSignal | ScopeSignal } VcdSignal
 * 
 * @typedef {Object} VcdInfo
 * @property {number} t0
 * @property {string} timescale
 * @property {string} version
 * @property {string} date
 * @property {string} status
 * @property {VcdSignal} wires
 * 
 * @typedef {Object} VcdBasicInfo
 * @property {number} time
 * @property {number} tgcd
 * @property {VcdInfo} vcdInfo
 * @property {any} signalValues
 */

// 结果变量
const vcdBasicInfo = {
    signalValues: {},
    vcdInfo: undefined,
    tgcd: undefined,
    time: undefined
};

/**
 * 
 * @param {number} a 
 * @param {number} b 
 * @returns {number}
 */
function gcd(a, b) {
    if (a === undefined) {
        return b;
    }
    let r;
    while (b !== 0) {
        r = a % b;
        a = b;
        b = r;
    }
    return (a < 0) ? -a : a;
}

const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * 
 * @param {BigInt} val 
 * @returns {string | number}
 */
function numberOrString(val) {
    if (val < MAX_SAFE_INTEGER) {
        return Number(val);
    }
    const stringNumber = '0x' + val.toString(16);
    return stringNumber;
}

/**
 * 
 * @param {string} timescale 
 * @returns {string}
 */
function parseTimescale(timescale) {
    if (typeof timescale !== 'string') {
        return;
    }
    const str1 = timescale.trim();
    const m = str1.match(/^(\d+)\s*(\w+)$/);
    const res1 = ({ 1: 0, 10: 1, 100: 2 })[m[1]];
    const res2 = ({ s: 0, ms: -3, us: -6, ns: -9, ps: -12, fs: -15 })[m[2]];
    return res1 + res2;
}

/**
 * 
 * @returns {{
 *  write: (piece: Uint8Array) => void
 *  consume: (arraybuffer: ArrayBuffer, config?: consumeConfig) => void
 *  getBasicInfo: () => VcdBasicInfo
 * }}
 */
async function makeVcdStream() {
    const vcdstream = await getVcdStream();
    // 使用 vcdstream 的 any 回调获取波形数据，并按照正确的格式进行解码和存储
    // 这段处理来自 https://github.com/wavedrom/vcd 的 vcd-pipe-deso.js 的 58 行
    // 请严格对准转换规则
    vcdstream.change.any((id, time, cmd, value, mask) => {
        const time53 = Number(time);
        vcdBasicInfo.tgcd = gcd(vcdBasicInfo.tgcd, time53);
        vcdBasicInfo.signalValues[id] = vcdBasicInfo.signalValues[id] || { kind: '', wave: [] };

        // if (id === 'x#') {
        //     console.log(id, time, cmd, value, mask);
        //     console.log(time > MAX_SAFE_INTEGER);
        // }

        // TODO: 解决这个问题，有关 parameter 参数读取
        if (time > MAX_SAFE_INTEGER) {
            vcdBasicInfo.signalValues[id].wave = [[0, Number(value)]];
            return;
        }

        if (cmd >= 14 && cmd <= 28) {
            vcdBasicInfo.signalValues[id].kind = 'bit';
            vcdBasicInfo.signalValues[id].wave.push([time53, cmd - 14]);
        } else {
            vcdBasicInfo.signalValues[id].kind = 'vec';
            const point = [time53, numberOrString(value)];
            if (mask !== 0n) {
                point.push(numberOrString(mask));
            }
            vcdBasicInfo.signalValues[id].wave.push(point);
        }
    });

    vcdstream.consume = (arraybuffer, config) => {
        return consume(vcdstream, arraybuffer, config);
    };

    vcdstream.getBasicInfo = () => {
        return vcdBasicInfo;
    };

    return vcdstream;
}

/**
 * 
 * @param {ArrayBuffer} arraybuffer 
 * @param {consumeConfig} config 
 */
function consume(vcdstream, arraybuffer, config) {
    config = config || { maxChunkLength: 1 << 17, useGcd: true };

    const maxChunkLength = config.maxChunkLength;
    const uint8array = new Uint8Array(arraybuffer);
    for (let i = 0; i < uint8array.length; i += maxChunkLength) {
        const piece = uint8array.slice(i, i + maxChunkLength);
        vcdstream.write(piece);
    }

    // 装载信息
    if (vcdBasicInfo.time === undefined) {
        vcdBasicInfo.time = Number(vcdstream.getTime());
    }
    if (vcdBasicInfo.vcdInfo === undefined) {
        vcdBasicInfo.vcdInfo = vcdstream.info;
    }

    // 通过 gcd 来缩放时间
    const tgcd = vcdBasicInfo.tgcd;
    const signalValues = vcdBasicInfo.signalValues;
    
    vcdBasicInfo.time /= tgcd;
    vcdBasicInfo.vcdInfo.t0 /= tgcd;
    vcdBasicInfo.vcdInfo.timescale = parseTimescale(vcdBasicInfo.vcdInfo.timescale);

    for (const id of Object.keys(signalValues)) {
        // point[0] 是当前这个点的时间点
        signalValues[id].wave.map(point => { point[0] /= tgcd });
    }

    const exp = Math.log10(tgcd) | 0;
    if (exp > 0) {
        const scale = Math.pow(10, exp);
        const scaleGcd = tgcd / scale;
        if (scaleGcd === (scaleGcd | 0)) {
            vcdBasicInfo.tgcd = scaleGcd;
            vcdBasicInfo.vcdInfo.timescale += exp;
        }
    }
}

async function getVcdStream() {
  const wasm = await createVCD();
  const vcdstream = await webVcdParser(wasm);
  return vcdstream;
}

// 测试时关闭该函数
// 部署时激活该函数
try {
    if (self) {
        self.getVcdStream = getVcdStream;
        self.makeVcdStream = makeVcdStream;
        self.vcdBasicInfo = vcdBasicInfo;
    }    
} catch (error) {}

module.exports = {
    getVcdStream,
    makeVcdStream,
    vcdBasicInfo
};