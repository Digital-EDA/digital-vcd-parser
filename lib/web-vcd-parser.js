'use strict';

const stream = require('stream');
const EventEmitter = require('events').EventEmitter;
const commandHandler = require('./command-handler.js');

function h8ToBn(HEAPU8, start, len) {
    if (len === 0) {
        return 0n;
    }
    let str = '';
    const fin = start + len * 8;
    for (let i = start; i < fin; i++) {
        const val = HEAPU8[i];
        str = val.toString(16) + str;
        if (val < 16) {
            str = '0' + str;
        }
    }
    return BigInt('0x' + str);
}

const bindCWrap = (c, wasm) => {
    const w = wasm.cwrap;
    c.execute = w('execute', 'number', ['number', 'number', 'number', 'number', 'number', 'array', 'number']);
    c.init = w('init', 'number', ['number', 'number', 'number', 'number']);
    c.getTime = w('getTime', 'number', ['number']);
    c.setTrigger = w('setTrigger', 'number', ['number', 'string']);
};

const getWrapper = wasm => {
    const c = {};
    let bindCallback;
    const start = async () => {
        bindCWrap(c, wasm);
        bindCallback();
    };

    // gets a string from a c heap pointer and length
    const getString = (name, len) => {
        let string = '';
        const end = name + len;
        for (let i = name; i < end; i++) {
            string += String.fromCharCode(wasm.HEAPU8[i]);
        }
        return string;

    };

    let boundInfo;

    let boundSet;
    let boundGet;

    let ee = [];

    let boundEE0;
    let boundEE1;

    let context = -1;


    const onEE1 = (
    /* const char* */   eventName,
    /* const size_t */  eventNameLength, // strlen(name)
    /* const int64_t */ time,
    /* const int */     cmd,
    /* const int */     valueWords,
    /* uint64_t* */     value,
    /* const int */     maskWords,
    /* uint64_t* */     mask
    ) => {
        const name = getString(eventName, eventNameLength);
        if (cmd >= 14 && cmd <= 28) {
            ee[1](name, time, cmd);
        } else {
            const bigValue = h8ToBn(wasm.HEAPU8, value, valueWords);
            const bigMask = h8ToBn(wasm.HEAPU8, mask, maskWords);
            ee[1](name, time, cmd, bigValue, bigMask);
        }
    };

    // wasm.addFunction can't be called until after
    // start finishes
    bindCallback = () => {
        boundSet = wasm.addFunction(function (name, len, type, v0, v1) {
            let prop = getString(name, len);
            let tmp;

            switch (type) {
                // set number
                case 0:
                    boundInfo[prop] = v0;
                    break;
                // set string
                case 1:
                    boundInfo[prop] = getString(v0, v1);
                    break;
                // set string to path
                case 2:
                    break;
                // path to path (any type)
                case 3:
                    break;
                // create empty object at path
                case 4:
                    break;
                case 5:
                    commandHandler(boundInfo, v0, prop);
                    break;
                default: throw new Error();
            }
            // viiiii means returns void, accepts int int int int int
        }, 'viiiii');

        boundGet = wasm.addFunction(function (name, len) {
            let prop = getString(name, len);
            return prop;
        }, 'iii');


        boundEE0 = wasm.addFunction(function (name, len) {
            ee[0](getString(name, len));
        }, 'vii');

        boundEE1 = wasm.addFunction(onEE1, 'viijiiiii');
    };

    return {
        start,
        c,
        init: (cb0, cb1, info) => {
            boundInfo = info;
            ee[0] = cb0;
            ee[1] = cb1;
            context = c.init(boundEE0, boundEE1, boundSet, boundGet);
            return context;
        },
        /**
         * 
         * @param {*} ctx 
         * @param {*} cb0 
         * @param {*} cb1 
         * @param {*} info 
         * @param {*} chunk 
         * @returns 
         */
        execute: (ctx, cb0, cb1, info, chunk) => {            
            boundInfo = info;
            ee[0] = cb0;
            ee[1] = cb1;
            return c.execute(ctx, boundEE0, boundEE1, boundSet, boundGet, chunk, chunk.length);
        },
        setTrigger: (ctx, triggerString) => {
            return c.setTrigger(ctx, triggerString);
        },
        getTime: (ctx) => {
            return BigInt(c.getTime(ctx));
        }
    };

};

module.exports = async wasm => {
    const lib = getWrapper(wasm);
    await lib.start();
    const wires = { kind: 'scope', type: '.', name: '.', body: [] };
    const info = { stack: [wires], wires };
    const s = new stream.Writable();

    // gets called by c with 1 argument, a string
    const lifemit = s.emit.bind(s);
    const triee = new EventEmitter();

    const triemit = triee.emit.bind(triee);
    let triemit2 = triemit;

    const cxt = lib.init(lifemit, triemit, info);

    s._write = function (chunk, encoding, callback) {
        const err = lib.execute(cxt, lifemit, triemit2, info, chunk);
        if (err) {
            console.log(err);
        }
        callback();
    };

    s.change = {
        on: (id, fn) => {
            triemit2 = triemit;
            triee.on(id, fn);
            const triggerString = triee.eventNames().join(' ') + '  ';
            lib.setTrigger(cxt, triggerString);
        },
        any: fn => {
            triemit2 = fn;
            lib.setTrigger(cxt, '\0');
        }
    };

    s.info = info;
    s.getTime = () => lib.getTime(cxt);
    s.start = lib.start;

    return s;
};
