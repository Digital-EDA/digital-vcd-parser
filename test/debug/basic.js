'use strict';
/* eslint-disable no-console */
/* eslint-disable indent */
/* eslint-disable no-unused-vars */

const fs = require('fs');

const { makeVcdStream } = require('../../bin/vcd');

async function main() {
    const arraybuffer = fs.readFileSync('./test/debug/small.vcd');
    const vcdstream = await makeVcdStream();
    vcdstream.consume(arraybuffer);
    const info = vcdstream.getBasicInfo();
    console.log(info);
}

main();