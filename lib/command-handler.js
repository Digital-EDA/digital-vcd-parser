'use strict';
/* eslint-disable no-console */
/* eslint-disable indent */

const handleScope = (info, str) => {
    const [type, name] = str.split(/\s+/);
    const ero = { kind: 'scope', type, name, body: [] };
    const current = info.stack[info.stack.length - 1];
    current.body.push(ero);
    info.stack.push(ero);
    // console.log(ero);
};

const handleUpScope = (info /* , str */) => {
    info.stack.pop();
    // console.log(['upscope', str]);
};

const handleVar = (info, str) => {
    // reg 3 ( r_reg [2:0]
    // 0   1 2 3+
    const eroj = str.split(/\s+/);
    const ero = {
        kind: 'var',
        type: eroj[0],
        size: parseInt(eroj[1]),
        link: eroj[2],
        name: eroj.slice(3).join('')
    };
    {
        const m = ero.name.match('^(?<name>\\w+)\\[' + (ero.size - 1) + ':0]$');
        if (m) {
            ero.name = m.groups.name;
        }
    }
    const current = info.stack[info.stack.length - 1];
    current.body.push(ero);
    // console.log(ero);
};

/**
 * @description 处理 C++ 中的 on_command 函数，也就是 llparse 框架中的 p.code.store('command') 触发的函数
 * @param {} info 
 * @param {*} cmd 
 * @param {*} str 
 */
const commandHandler = (info, cmd, str) => {
    str = str.trim();

    switch (cmd) {
        case 1:
            // 处理 comment
            info.comment = str;
            break;
        case 2:
            // 处理 date
            info.date = str;
            break;
        case 3:
            // 处理 scope
            handleScope(info, str);
            break;
        case 4:
            // 处理 timescale
            info.timescale = str;
            break;
        case 5:
            handleUpScope(info, str);
            break;
        case 6:
            // 处理变量申明（link 和 wire name 的对应关系）
            handleVar(info, str);
            break;
        case 7:
            // 处理 version
            info.version = str;
            break;
        default:
            // console.log([cmd, str]);
    }
};

module.exports = commandHandler;
