'use strict';

const fs = require('fs');
const expect = require('chai').expect;
const { makeVcdStream } = require('../bin/vcd');

describe('wasm iverilog', () => {
    it('small vcd', async () => {
        const vcdstream = await makeVcdStream();
        const arraybuffer = fs.readFileSync('./test/samples/iverilog.small.vcd');
        const answers = JSON.parse(fs.readFileSync('./test/samples/iverilog.small.json'));
        
        vcdstream.consume(arraybuffer);
        const info = vcdstream.getBasicInfo();
        const values = info.signalValues;

        // task 1
        expect(Object.keys(values)).to.have.length.above(0);

        // task 2
        expect(info.vcdInfo.date.trim()).to.eq('Thu Jul 22 22:29:56 2021');
        expect(info.vcdInfo.version.trim()).to.eq('Icarus Verilog');
        expect(info.vcdInfo.timescale).to.eq(-9);

        // task 3
        for (const key of Object.keys(answers)) {
            const ans = answers[key];
            expect(values[key]).to.not.be.undefined;
            expect(values[key]).to.deep.eq(ans);
        }
    });

    it('large vcd', async () => {
        const vcdstream = await makeVcdStream();
        const arraybuffer = fs.readFileSync('./test/samples/iverilog.large.vcd');
        // const answers = JSON.parse(fs.readFileSync('./test/samples/iverilog.large.json'));
        vcdstream.clean();
        vcdstream.consume(arraybuffer);
        const info = vcdstream.getBasicInfo();
        const values = info.signalValues;

        // task 1
        expect(Object.keys(values)).to.have.length.above(0);
        expect(values['*']).to.not.be.undefined;
        expect(values['+']).to.not.be.undefined;


        // // task 2
        // for (const key of Object.keys(answers)) {
        //     const ans = answers[key];
        //     expect(values[key]).to.not.be.undefined;
        //     expect(values[key]).to.deep.eq(ans);
        // }

        // console.log(info.signalValues['*']);

        // task 3
        expect(info.vcdInfo.date.trim()).to.eq('Sat Apr 20 20:06:14 2024');
        expect(info.vcdInfo.version.trim()).to.eq('Icarus Verilog');
        expect(info.vcdInfo.timescale).to.eq(-9);

        // task 4

    });
});
