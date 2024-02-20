/* eslint-disable no-undef */
'use strict';

const createVCD = require('../out/vcd.js');
const webVcdParser = require('../lib/web-vcd-parser.js');

async function getVcdStream() {
  const wasm = await createVCD();
  const ostream = await webVcdParser(wasm);
  return ostream;
}

window.getVcdStream = getVcdStream;