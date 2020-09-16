#include <stdio.h>
#include <stdlib.h>
#include "vcd_parser.h"
#include <node_api.h>

#define ASSERT(val, expr) \
    if (expr != napi_ok) { \
        napi_throw(env, val); \
    }

void strcopy(const unsigned char* p, const unsigned char* endp, unsigned char* dst) {
  unsigned char* src;
  src = p;
  while (src < (endp - 1)) {
    *dst = *src;
    src++;
    dst++;
  }
  *dst = 0;
}

// FIXME use a better structure to match strings
int stringEq (
  const unsigned char* gold, // search pattern
  const unsigned char* p,
  const unsigned char* endp
) {
  if (gold[0] == 0) {
    return 1;
  }
  unsigned char* i;
  unsigned char* j;
  i = gold;
  j = p;
  while (1) {
    if (*i == ' ') { // end of search pattern
      return 0;
    }
    while (*i == *j) { // follow matching trail
      i++;
      j++;
    }
    if ((*i == ' ') && (j == (endp - 1))) { // exact match
      return 1;
    }
    while (*i != ' ') { // skip to the end of pattern word
      i++;
    }
    i++;
    j = p; // try another word
  }
}

int commandSpan(vcd_parser_t* state, const unsigned char* p, const unsigned char* endp) {
  napi_env env = state->napi_env;

  if (state->command == 5) { // $upscope
    state->stackPointer -= 1;
    return 0;
  }

  if (state->command == 8) { // $enddefinitions
    napi_value status, undefined, eventName, eventPayload, return_val;
    ASSERT(status, napi_create_string_latin1(env, "simulation", NAPI_AUTO_LENGTH, &status))
    ASSERT(state->info, napi_set_named_property(env, state->info, "status", status))
    ASSERT(undefined, napi_get_undefined(env, &undefined))
    ASSERT(eventName, napi_create_string_latin1(env, "$enddefinitions", NAPI_AUTO_LENGTH, &eventName))
    // ASSERT(eventPayload, napi_create_string_latin1(env, "payload", NAPI_AUTO_LENGTH, &eventPayload))
    napi_value* argv[] = { &eventName }; // , &eventPayload };
    ASSERT(state->lifee, napi_call_function(env, undefined, state->lifee, 1, *argv, &return_val))
    return 0;
  }

  return 0;
}

int scopeIdentifierSpan(vcd_parser_t* state, const unsigned char* p, const unsigned char* endp) {
  napi_env env = state->napi_env;
  // *(endp - 1) = 0; // FIXME NULL termination of ASCII string
  strcopy(p, endp, state->tmpStr);
  napi_value name, obj, stack, top;
  ASSERT(name, napi_create_string_latin1(env, (char*)p, (endp - p - 1), &name))
  ASSERT(obj, napi_create_object(env, &obj))
  ASSERT(state->info, napi_get_named_property(env, state->info, "stack", &stack))
  ASSERT(top, napi_get_element(env, stack, state->stackPointer, &top))
  ASSERT(top, napi_set_named_property(env, top, state->tmpStr, obj))
  state->stackPointer += 1;
  ASSERT(top, napi_set_element(env, stack, state->stackPointer, obj))
  return 0;
}

int varSizeSpan(vcd_parser_t* state, const unsigned char* p, const unsigned char* endp) {
  state->size = strtol((const char *)p, (char **)&endp, 10);
  return 0;
}

int varIdSpan(vcd_parser_t* state, const unsigned char* p, const unsigned char* endp) {
  napi_env env = state->napi_env;
  napi_value varId;
  ASSERT(varId, napi_create_string_latin1(env, (char*)p, (endp - p - 1), &varId))
  ASSERT(state->info, napi_set_named_property(env, state->info, "varId", varId))
  return 0;
}

int varNameSpan(vcd_parser_t* state, const unsigned char* p, const unsigned char* endp) {
  napi_env env = state->napi_env;
  // *(endp - 1) = 0; // FIXME NULL termination of ASCII string
  strcopy(p, endp, state->tmpStr);
  napi_value stack, top, varId;
  ASSERT(state->info, napi_get_named_property(env, state->info, "stack", &stack))
  ASSERT(top, napi_get_element(env, stack, state->stackPointer, &top))
  ASSERT(state->info, napi_get_named_property(env, state->info, "varId", &varId))
  ASSERT(state->info, napi_set_named_property(env, top, state->tmpStr, varId))
  return 0;
}

int idSpan(vcd_parser_t* state, const unsigned char* p, const unsigned char* endp) {
  napi_env env = state->napi_env;
  if (stringEq((state->trigger), p, endp)) {
    const uint8_t command = state->command;
    uint64_t* value = state->value;
    uint64_t* mask = state->mask;
    if (command == 14) {
      value[0] = 0;
      mask[0] = 0;
    } else
    if (command == 15) {
      value[0] = 1;
      mask[0] = 0;
    }
    const int valueWords = (state->digitCount >> 6) + 1;
    napi_value undefined, eventName, aTime, aCommand, aValue, aMask, return_val;
    ASSERT(undefined, napi_get_undefined(env, &undefined))
    ASSERT(eventName, napi_create_string_latin1(env, (char*)p, (endp - p - 1), &eventName))
    ASSERT(aTime, napi_create_int64(env, state->time, &aTime))
    ASSERT(aCommand, napi_create_int32(env, command, &aCommand))
    ASSERT(aValue, napi_create_bigint_words(env, 0, valueWords, value, &aValue))
    ASSERT(aMask, napi_create_bigint_words(env, 0, valueWords, mask, &aMask))
    napi_value* argv[] = {&eventName, &aTime, &aCommand, &aValue, &aMask};
    ASSERT(state->triee, napi_call_function(env, undefined, state->triee, 5, *argv, &return_val))
    for (int i = 0; i < valueWords; i++) {
      value[i] = 0;
      mask[i] = 0;
    }
    state->digitCount = 0;
  }
  return 0;
}

int onDigit(
  vcd_parser_t* state,
  const unsigned char* p,
  const unsigned char* endp,
  int digit
) {
  unsigned int valueCin = (digit & 1);
  unsigned int maskCin = ((digit >> 1) & 1);
  unsigned int valueCout;
  unsigned int maskCout;
  uint64_t* value = state->value;
  uint64_t* mask = state->mask;
  const int valueWordsMinus = (state->digitCount >> 6);
  for (int i = 0; i <= valueWordsMinus; i++) {

    valueCout = value[i] >> 63;
    value[i] = (value[i] << 1) + valueCin;
    valueCin = valueCout;

    maskCout = mask[i] >> 63;
    mask[i]  = (mask[i] << 1) + maskCin;
    maskCin = maskCout;

  }
  state->digitCount += 1;
  return 0;
}

int timeSpan(vcd_parser_t* state, const unsigned char* p, const unsigned char* endp) {
  state->time = strtoul((const char *)p, (char **)&endp, 10);
  return 0;
}
