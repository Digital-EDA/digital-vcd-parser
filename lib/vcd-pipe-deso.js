'use strict';
/* eslint-disable no-console */
/* eslint-disable indent */

const parseTimescale = require('./parse-time-scale.js');

const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

const numberOrString = val => {
  if (val < MAX_SAFE_INTEGER) {
    return Number(val);
  }
  return '0x' + val.toString(16);
};

const gcd = (a, b) => {
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
};

const tNorm = o => {
  const {tgcd, chango} = o;

  o.t0 /= tgcd;
  o.time /= tgcd;
  Object.keys(chango).map(key => {
    const {wave} = chango[key];
    wave.map(e => {
      e[0] /= tgcd;
    });
  });

  const exp = Math.log10(tgcd) |0;
  if (exp > 0) {
    const scale = Math.pow(10, exp);
    const tgcd1 = tgcd / scale;
    if (tgcd1 === (tgcd1 |0)) {
      o.tgcd = tgcd1;
      o.timescale += exp;
    }
  }
  return o;
};


module.exports = async (deso, inst, done) => {
  const chango = {};
  let tgcd;
  deso.chango = chango;
  deso.view = [];

  const onAnyChange = (id, time, cmd, value, mask) => {
    // console.log(id, time, cmd, value, mask);
    const time53 = Number(time);
    tgcd = gcd(tgcd, time53);
    chango[id] = chango[id] || {wave: []};
    if (cmd >= 14 && cmd <= 28) {
      chango[id].kind = 'bit';
      chango[id].wave.push([time53, cmd - 14]);
    } else {
      chango[id].kind = 'vec';
      const point = [time53, numberOrString(value)];
      if (mask !== 0n) {
        point.push(numberOrString(mask));
      }
      chango[id].wave.push(point);
    }
  };

  const t0 = Date.now();

  inst.on('$enddefinitions', () => {
    // console.log('$enddefinitions');
    Object.assign(deso.wires, inst.info.wires);
    deso.timescale = parseTimescale(inst.info.timescale);
  });

  inst.change.any(onAnyChange);

  inst.on('finish', () => {
    // console.log((Date.now() - t0) / 1000);
    deso.tgcd = tgcd;
    deso.t0 = (inst.info.t0 || 0);
    // console.log(inst.getTime());
    deso.time = Number(inst.getTime());
    tNorm(deso);
    done(deso);
  });
};
