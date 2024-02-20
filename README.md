Value Change Dump ([VCD](https://en.wikipedia.org/wiki/Value_change_dump)) parser using [llparse](https://github.com/nodejs/llparse) based on [wavedrom](https://github.com/wavedrom/vcd).

## Prepare

1. [Install emcc compiler](https://kirigaya.cn/blog/article?seq=55)

2. clone https://github.com/Digital-EDA/digital-vcd-parser

## Build

```bash
source $EMCC_HOME/emsdk_env.sh
# once only
npm install browserify terser -g
# once only
node bin/build.js
# build
make -j 12
# adjust to browser environment
browserify ./bin/vcd.js | terser --compress -o ./out/vcd.js
```

production are :

- `./out/vcd.js`
- `./out/vcd.wasm`

move them to your development worksapce.

## Usage

Only stream of Uint8 is supported as input. e.g. we want to parse a certain `*.vcd` read in browser-like environment. Mount vcd to window in your `index.html`:

```html
<!DOCTYPE html>
<html lang="">

<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <link rel="icon" href="<%= BASE_URL %>favicon.ico">
    <link rel="stylesheet" href="./vcd.css">
    <title>
        <%= htmlWebpackPlugin.options.title %>
    </title>
    <script src="./vcd.js"></script>
</head>

<body>
    <noscript>
        <strong>We're sorry but <%= htmlWebpackPlugin.options.title %> doesn't work properly without JavaScript enabled.
                Please enable it to continue.</strong>
    </noscript>
    <div id="app"></div>
</body>

</html>
```

In your main workspace (`App.vue` for example), goes like this:

```javascript
const uint8array = await readVcdFile();
const vcdstream = await getVcdStream();

// level size diagram data
const values = {};

vcdstream.change.any((id, time, cmd, value, mask) => {
    if (values[id] === undefined) {
        values[id] = [];
    }
    values[id].push({time, cmd, value, mask});
})

const maxChunkLength = 1 << 17;
for (let i = 0; i < uint8array.length; i += maxChunkLength) {
    const piece = uint8array.slice(i, i + maxChunkLength);
    vcdstream.write(piece);
}

// structure info of wires in vcdstream.info
console.log(vcdstream.info);

```

---

## License

MIT [LICENSE](LICENSE)
