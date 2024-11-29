#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable indent */
'use strict';

const fs = require('fs');
const cp = require('child_process');
const llparse = require('llparse');


const objection = lut => arg => arg.split(/\s+/).reduce((res, key) => {
    if (lut[key] === undefined) {
        throw new Error(key);
    }
    res[key] = lut[key];
    return res;
}, {});

const properties = {
    command: 'i8',
    type: 'i8',
    size: 'i32',
    time: 'i64',        // current simulation time
    trigger: 'ptr',
    triee: 'ptr',       // trigger event emitter
    lifee: 'ptr',       // life cycle event emmiter
    info: 'ptr',
    value: 'ptr',       // value of the signal on change event
    mask: 'ptr',        // mask (x, z) of the signal on change event
    digitCount: 'i32',
    maskCount: 'i32',
    tmpStr: 'ptr',
    timeStampStr: 'ptr',
    idStr: 'ptr',
    tmpStr2: 'ptr',
    stackPointer: 'i32',
    id: 'ptr',
    napi_env: 'ptr'
};

const spaces = [' ', '\n', '\r', '\t'];
const lineSpaces = [' ', '\t'];

function main() {
    const projectName = 'vcd_parser';

    // 有关左推解析器框架 llparse 的文章，移步我之前的博客：https://kirigaya.cn/blog/article?seq=223
    // 如果需要可视化项目图，可以取消下面的注释
    // const { Dot } = require('llparse-dot');
    // const llDot = new Dot();
    // const dotCodeString = llDot.build(method);
    // fs.writeFileSync(projectName + '.dot', code, { encoding: 'utf-8' });
    
    // 项目名为 vcd_parser
    const p = new llparse.LLParse(projectName);
    
    // 注册一些属性
    for (const propertyName of Object.keys(properties)) {
        const propertyType = properties[propertyName];
        p.property(propertyType, propertyName);
    }

    // 自定义 code span，对于游走到这些 span 后要如何处理，都在 vcd_span.c 文件里
    // 比如对于 varNameSpan 的定义，在 vcd_span.c 中存在一个同名的函数来定义它
    const varSizeSpan   = p.span(p.code.span('varSizeSpan'));
    const varIdSpan     = p.span(p.code.span('varIdSpan'));
    const varNameSpan   = p.span(p.code.span('varNameSpan'));
    const idSpan        = p.span(p.code.span('idSpan'));
    const commandSpan   = p.span(p.code.span('commandSpan'));
    const timeSpan      = p.span(p.code.span('timeSpan'));
    
    // 自定义 node, 他们都是具体的节点
    const declaration              = p.node('declaration');
    const varType                  = p.node('varType');
    const varTypeEnd               = p.node('varTypeEnd');
    const varSize                  = p.node('varSize');
    const varSizeEnd               = p.node('varSizeEnd');
    const varId                    = p.node('varId');
    const varIdEnd                 = p.node('varIdEnd');
    const varName                  = p.node('varName');
    const varNameEnd               = p.node('varNameEnd');
    const inDeclaration            = p.node('inDeclaration');
    const simulation               = p.node('simulation');
    const inSimulation             = p.node('inSimulation');
    const simulationTime           = p.node('simulationTime');
    const simulationVector         = p.node('simulationVector');
    const simulationVectorEnd      = p.node('simulationVectorEnd');
    const simulationVectorRecovery = p.node('simulationVectorRecovery');
    const simulationId             = p.node('simulationId');
    const enddefinitions           = p.node('inDeclarationEnd');
    // scopeType scopeTypeEnd
    // scopeIdentifier scopeIdentifierEnd

    const cmd = objection({
        $comment: 1,
        $date: 2,
        $scope: 3,
        $timescale: 4,
        $upscope: 5,
        $var: 6,
        $version: 7,
        $enddefinitions: 8,
        $dumpall: 9,
        $dumpoff: 10,
        $dumpon: 11,
        $dumpvars: 12,
        '#': 13,
        '0': 14,
        '1': 15,
        x: 16, X: 17,
        z: 18, Z: 19,
        u: 20, U: 21, // VHDL states
        w: 22, W: 23,
        l: 24, L: 25,
        h: 26, H: 27,
        '-': 28,
        b: 30, B: 31, r: 32, R: 33
    });


    // p.code.store('command') 的具体执行逻辑移步 command-handler.js 中的 commandHandler
    declaration
        .match(spaces, declaration)
        .select(cmd('$scope $var $upscope $comment $date $timescale $version #'),
            p.invoke(p.code.store('command'), commandSpan.start(inDeclaration)))
        .select(cmd('$enddefinitions'),
            p.invoke(p.code.store('command'), commandSpan.start(enddefinitions)))
        .otherwise(p.error(1, 'Expected declaration command'));


    varType.match(spaces, varType).otherwise(varTypeEnd);
    varTypeEnd
        .select({
            event: 1,
            integer: 2,
            parameter: 3,
            real: 4,
            realtime: 5,
            reg: 6,
            supply0: 7,
            supply1: 8,
            time: 9,
            tri: 10,
            triand: 11,
            trior: 12,
            trireg: 13,
            tri0: 14,
            tri1: 15,
            wand: 16,
            wire: 17,
            wor: 18
        }, p.invoke(p.code.store('type'), varSize))
        .otherwise(p.error(3, 'Expected var type'));

    // $var reg 3 ( r_reg [2:0] $end
    //          ^

    varSize.match(spaces, varSize).otherwise(varSizeSpan.start(varSizeEnd));
    varSizeEnd.match(spaces, varSizeSpan.end(varId)).skipTo(varSizeEnd);

    // $var reg 3 ( r_reg [2:0] $end
    //            ^

    varId.match(spaces, varId).otherwise(varIdSpan.start(varIdEnd));
    varIdEnd.match(spaces, varIdSpan.end(varName)).skipTo(varIdEnd);

    // $var reg 3 ( r_reg [2:0] $end
    //              ^^^^^

    varName.match(spaces, varName).otherwise(varNameSpan.start(varNameEnd));
    varNameEnd.match('$end', commandSpan.end(varNameSpan.end(declaration))).skipTo(varNameEnd);

    // $end

    inDeclaration
        .match('$end', commandSpan.end(declaration))
        .skipTo(inDeclaration);

    enddefinitions
        .match('$end', commandSpan.end(simulation))
        .skipTo(enddefinitions);

    simulation
        .match([' ', '\r', '\n', '\t', '$dumpvars', '$dumpall', '$end'], simulation)
        .select(cmd('$dumpoff $dumpon $comment'),
            p.invoke(p.code.store('command'), commandSpan.start(inSimulation)))
        .select(cmd('#'),
            p.invoke(p.code.store('command'), timeSpan.start(simulationTime)))
        .select(cmd('0 1 x X z Z u U w W l L h H -'),
            p.invoke(p.code.store('command'), idSpan.start(simulationId)))
        .select(cmd('b B r R'),
            p.invoke(p.code.store('command'), simulationVector))
        .otherwise(p.error(4, 'Expected simulation command'));

    inSimulation
        .match('$end', commandSpan.end(simulation))
        .skipTo(inSimulation);

    simulationTime
        .match(spaces, timeSpan.end(p.invoke(p.code.span('onTime'), simulation)))
        .skipTo(simulationTime);

    simulationVector
        .select(
            {
                0: 0,
                1: 1,
                x: 2, X: 2,
                z: 3, Z: 3,
                u: 3, U: 3, // VHDL states
                w: 3, W: 3,
                l: 3, L: 3,
                h: 3, H: 3,
                '-': 3
            },
            p.invoke(
                // p.code.mulAdd('value', {base: 2, signed: false}),
                p.code.value('onDigit'),
                { 1: p.error(5, 'Content-Length overflow') },
                simulationVector
            )
        )
        .otherwise(simulationVectorEnd);

    simulationVectorEnd
        .match(lineSpaces, idSpan.start(simulationId))
        .skipTo(simulationVectorRecovery);

    simulationVectorRecovery
        .select(
            {
                '\n': 1, '\r': 1
            },
            p.invoke(
                p.code.value('onRecover'),
                { 1: p.error(6, 'recover') },
                simulation
            )
        )
        .skipTo(simulationVectorRecovery);

    simulationId
        .match(spaces, idSpan.end(p.invoke(p.code.span('onId'), simulation)))
        .skipTo(simulationId);

    const artifacts = p.build(declaration);

    fs.writeFileSync(projectName + '.h', artifacts.header);
    // fs.writeFileSync('verilog_preprocessor.bc', artifacts.bitcode);
    fs.writeFileSync(projectName + '.c', artifacts.c);

    // const dot = new llparseDot.Dot();
    // fs.writeFileSync(projectName + '.dot', dot.build(declaration));

    // 使用 binding.gyp 把生成的 c 和 h 进行编译
    console.log('build');
    const proc = cp.spawn('node-gyp', ['configure', 'build']);
    proc.stderr.on('data', data => {
        console.error(data.toString());
    });
    proc.on('close', () => {
        console.log('done');
    });
};

main();

/* eslint camelcase: 0 */
