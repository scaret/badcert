# Badcert

一个HTTPS静态服务器。根据本地IP地址提供了合法的HTTPS证书及DNS地址。

## 用法1：命令行下当作静态服务器使用

cd到指定目录后执行以下命令，当前目录就会被托管为根目录：

```
  > npm install -g badcert
  > badcert
```

## 用法2：nodejs环境下可获取key和cert，并注册自己的IP

`badcert.register()`的返回值可以直接传递给`https.createServer`

```
const badcert = require("badcert");
const express = require("express");
const https = require("https");

const app = express();

badcert.register().then((keyAndCert)=>{
  https.createServer(keyAndCert, app).listen(4000, () => {
    console.log('server is runing at port 4000')
  })
})
```


## 用法3: 通过UI界面直接下载证书、注册IP地址

[https://wrtc.dev/badcert](https://wrtc.dev/badcert)
