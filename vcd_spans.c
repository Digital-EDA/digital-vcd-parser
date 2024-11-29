#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "vcd_parser.h"

#ifndef VCDWASM
#include <node_api.h>
#else
#include "wasm_main.hpp"
#endif

#ifdef VCDWASM
typedef void* napi_env;
#endif

// #define LOGSPAN
// #define LOGSPAN printf("%s\n", __FUNCTION__);

#define ASSERT(val, expr)     \
    if (expr != napi_ok) {    \
        napi_throw(env, val); \
    }

void strcopy(const unsigned char* p, const unsigned char* endp,
             unsigned char* dst) {
    const unsigned char* src;
    src = p;
    while (src < (endp - 1)) {
        *dst = *src;
        src++;
        dst++;
    }
    *dst = 0;
}

void strconcat(const unsigned char* p, const unsigned char* endp,
               unsigned char* dst) {
    // printf("<len:%d>", endp - p);
    dst += strlen((char*)dst);  // go to the end of string
    while (p < endp) {
        *dst = *p;
        p++;
        dst++;
    }
    *dst = 0;
}

// FIXME use a better structure to match strings
int stringEq(
    const unsigned char* i,  // search pattern
    const unsigned char* p,
    const unsigned char* endp
) {
    if (*i == 0) {
        return 1;
    }
    const unsigned char* j;
    while (1) {
        j = p;
        // printf("(%s|%s)", (char *)i, (char *)j);
        if (*i == 0) {  // end of search pattern
            return 0;
        }
        while (*i == *j) {             // follow matching trail
            if (*i == 0 && *j == 0) {  // match zeros
                return 1;
            }
            i++;
            j++;
        }
        while (*i != 0) {  // skip to the end of pattern word
            i++;
        }
        i++;
    }
}

int commandSpan(vcd_parser_t* state, const unsigned char* p,
                const unsigned char* endp) {
    const uint8_t command = state->command;

    if ((command > 0) && (command < 8)) {        
        const int len = endp - p;
        int tailLen = 3;
        if (len < 4) {
            tailLen = len;
        }
        strcopy(p, endp - tailLen, state->tmpStr);
        // set_property_string(key, state->tmpStr);
        on_command(state->tmpStr, command);
        return 0;
    }

    if (command == 8) {  // $enddefinitions
        *(char*)state->idStr = 0;
        *(char*)state->timeStampStr = 0;

        set_property_string("status", "simulation");
        emit_lifee("$enddefinitions");
        return 0;
    }

    return 0;
}

int scopeIdentifierSpan(vcd_parser_t* state, const unsigned char* p,
                        const unsigned char* endp) {
    strcopy(p, endp, state->tmpStr);  // load the value into temp string 1

    // set stack[sp].`tmpStr` to {}
    snprintf(state->tmpStr2, 4096, "stack.%d.%s", state->stackPointer,
             (char*)state->tmpStr);
    new_object_path(state->tmpStr2);

    // bump
    state->stackPointer += 1;

    // set stack[sp+1] to the same object as stack[sp].`tmpStr`
    snprintf(state->tmpStr, 4096, "stack.%d", state->stackPointer);

    set_path_to_path(state->tmpStr, state->tmpStr2);

    return 0;
}

int varSizeSpan(
    vcd_parser_t* state,
    const unsigned char* p,
    const unsigned char* endp
) {
    const int32_t size = strtol((const char*)p, (char**)&endp, 10);
    state->size = size;
    set_property_int("varType", state->type);
    set_property_int("varSize", size);
    return 0;
}

int varIdSpan(
    vcd_parser_t* state,
    const unsigned char* p,
    const unsigned char* endp
) {
    strcopy(p, endp, state->tmpStr);
    set_property_string("varId", state->tmpStr);
    return 0;
}

int varNameSpan(vcd_parser_t* state, const unsigned char* p,
                const unsigned char* endp) {

    strcopy(p, endp, state->tmpStr);
    snprintf(state->tmpStr2, 4096, "stack.%d.%s", state->stackPointer,
             (char*)state->tmpStr);
    set_path_to_path(state->tmpStr2, "varType,varSize,varId");

    return 0;
}

int idSpan(vcd_parser_t* state, const unsigned char* p,
           const unsigned char* endp) {
    strconcat(p, endp, state->idStr);
    // printf("<idSpan|%s>\n", (char *)state->idStr);
    return 0;
}

int onId(vcd_parser_t* state, const unsigned char* _p,
         const unsigned char* _endp) {

    const unsigned char* p = (unsigned char*)state->idStr;
    const unsigned int plen = strlen((char*)p) - 1;
    *(char*)(p + plen) = 0;  // null instead of space
    const unsigned char* endp = p + plen - 1;

    const int valueWords = (state->digitCount + 63) >> 6;
    const int maskWords = (state->maskCount + 63) >> 6;
    uint64_t* value = state->value;
    uint64_t* mask = state->mask;
    if (stringEq((state->trigger), p, endp)) {
        const uint8_t command = state->command;
        emit_triee(
            (char*)p,
            state->time,
            command,
            valueWords,
            value,
            maskWords,
            mask
        );
    }

    for (int i = 0; i < valueWords; i++) {
        value[i] = 0;
    }

    for (int i = 0; i < maskWords; i++) {
        mask[i] = 0;
    }
    state->digitCount = 0;
    state->maskCount = 0;
    *(char*)state->idStr = 0;
    return 0;
}

// 匹配 value id 这样的格式
int onDigit(vcd_parser_t* state, const unsigned char* _p,
            const unsigned char* _endp, int digit) {
    unsigned int valueCin = (digit & 1);
    unsigned int maskCin = ((digit >> 1) & 1);

    if ((valueCin != 0) || (state->digitCount != 0)) {
        unsigned int valueCout;
        uint64_t* value = state->value;
        const int valueWordsMinus = (state->digitCount >> 6);
        for (int i = 0; i <= valueWordsMinus; i++) {
            valueCout = value[i] >> 63;
            value[i] = (value[i] << 1) + valueCin;
            valueCin = valueCout;
        }
        state->digitCount += 1;
    }
    if ((maskCin != 0) || (state->maskCount != 0)) {
        unsigned int maskCout;
        uint64_t* mask = state->mask;
        const int maskWordsMinus = (state->maskCount >> 6);
        for (int i = 0; i <= maskWordsMinus; i++) {
            maskCout = mask[i] >> 63;
            mask[i] = (mask[i] << 1) + maskCin;
            maskCin = maskCout;
        }
        state->maskCount += 1;
    }
    return 0;
}

int onRecover(vcd_parser_t* state, const unsigned char* p,
              const unsigned char* endp, int digit) {
    state->digitCount = 0;
    state->maskCount = 0;
    return 0;
}

int starts_with_50(const char* str) {
    // 检查字符串的前两位是否为 '5' 和 '0'
    return str[0] == '5' && str[1] == '0';
}

uint16_t debug_tag = 0;

int timeSpan(
    vcd_parser_t* state,
    const unsigned char* p,
    const unsigned char* endp
) {
    strconcat(p, endp, state->timeStampStr);
    char* timeStampStr = (char*)state->timeStampStr;
    return 0;
}

// int starts_with_50(int64_t num) {
//     // 将 int64_t 转换为字符串
//     char str[21];  // 20 位数字 + 1 位空字符
//     snprintf(str, sizeof(str), "%lld", num);

//     // 检查字符串的前两位是否为 '5' 和 '0'
//     if (strlen(str) >= 2 && str[0] == '5' && str[1] == '0') {
//         return 1;  // 以 50 开头
//     } else {
//         return 0;  // 不以 50 开头
//     }
// }




int onTime(vcd_parser_t* state, const unsigned char* _p,
           const unsigned char* _endp) {
    char* end;

    // char* timeStampStr = (char*)state->timeStampStr;
    // if (starts_with_50(timeStampStr)) {
    //     printf("current time: %s", timeStampStr);
    // }

    const int64_t time = strtoul(state->timeStampStr, &end, 10);


    if (state->time == INT64_MAX) {
        set_property_int("t0", time);
    }
    state->time = time;
    *(char*)state->timeStampStr = 0;
    return 0;
}
