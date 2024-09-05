基于 [llparse](https://github.com/nodejs/llparse) 的 vcd 解析器，用于 [Digital IDE 的 wave 渲染器](https://github.com/Digital-EDA/digital-vcd-render) 的 vcd 后端解析器构建。

## 准备工作

[安装 emcc](https://kirigaya.cn/blog/article?seq=55)

```bash
git clone https://github.com/Digital-EDA/digital-vcd-parser
cd digital-vcd-parser
npm i
npm install browserify terser node-gyp -g
```


## 构建

```bash
# 激活 emcc
source $EMCC_HOME/emsdk_env.sh

# 生成 vcd_parser.c 和 vcd_parser.h（每次修改 ./bin/build.js 都需要重新运行）
# llparse 使用教程：https://kirigaya.cn/blog/article?seq=223
node bin/build.js

# build
make -j 12
```

生成 :

- `./out/vcd.js`
- `./out/vcd.wasm`

部署到 digital-vcd-render ：

```bash
# 将生成的 wasm 通过 浏览器化和特殊处理后部署到 render 项目中
source deploy.sh /mnt/c/Users/11934/Project/Digital-IDE/digital-vcd-render
```

## 测试

快速测试：

```bash
node test/debug/basic.js
```

通用测试：
```bash
npm run test
```

> tip: 不要运行 `browserify` 如果你要进行测试的话


## 浏览器使用

```bash
source deploy.sh /path/to/digital-vcd-render
```



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
