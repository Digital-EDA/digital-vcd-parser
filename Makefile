.PHONY: wasm all important clean

all: wasm

WASM_MAIN = wasm_main.cpp

HPP_FILES = \
vcd_parser.h \
wasm_main.hpp \

CPP_FILES = \
vcd_parser.c \
vcd_spans.c \

EXPORT_STRING = \
"_execute", \
"_init", \
"_setTrigger", \
"_getTime", \

# warning and error flags
CLANG_WARN_FLAGS = \
-fno-exceptions \

CLANG_OTHER_FLAGS = \
-DVCDWASM \

CLANG_O_FLAG = '-Os'

ifdef NOOPT
  CLANG_O_FLAG = ' '
endif

ifdef OPT3
  CLANG_O_FLAG = '-O3'
endif

wasm: $(WASM_MAIN) $(CPP_FILES) $(HPP_FILES) Makefile
	mkdir -p out
	emcc \
	$(WASM_MAIN) \
	$(CPP_FILES) \
	-o out/vcd.js \
	-s DISABLE_EXCEPTION_CATCHING=1 \
	-s WASM_BIGINT \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s INITIAL_MEMORY=1GB \
	-s MAXIMUM_MEMORY=2GB \
	-s ALLOW_TABLE_GROWTH=1 \
	-s MODULARIZE=1 \
	-s EXPORTED_FUNCTIONS='[$(EXPORT_STRING) "_main"]' \
	-s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "addOnPostRun", "addFunction", "setValue", "getValue"]' \
	$(CLANG_O_FLAG) $(CLANG_WARN_FLAGS) $(CLANG_OTHER_FLAGS)

.PHONY: patchlib patchlib1 patchlib2
.PHONY: all build watch dev start test pretest lint jestc copydist cleandist prepare
.PHONY: test testonly

watch:
	npm run watch

test:
	npm run test

testonly:
	npm run testonly

prepare:
	npm run prepare

clean:
	rm -rf out/*
