/**
 * light-server
 *
 * Serve, watch, exucute commands and live-reload, all in one.
 *
 * Copyright (c) 2018 by Tianxiang Chen
 */
'use strict'

const getCerts = require('./lib/getCerts')
const registerLocalIps = require('./lib/registerLocalIps')

const axios = require('axios');
var morgan = require('morgan')
var connect = require('connect')
var serveStatic = require('serve-static')
var serveIndex = require('serve-index')
var injector = require('connect-injector')
var Gaze = require('gaze').Gaze
var LR = require('./livereload')
var spawn = require('child_process').spawn
var os = require('os').type()

function LightServer (options) {
  if (!(this instanceof LightServer)) return new LightServer(options)
  this.options = options
  this.id = Math.floor(Math.random() * 1e10)
  if (os === 'Windows_NT') {
    this.shell = 'cmd'
    this.firstParam = '/c'
  } else {
    this.shell = 'bash'
    this.firstParam = '-c'
  }
}

LightServer.prototype.writeLog = function (logLine) {
  !this.options.quiet && console.log(logLine)
}

LightServer.prototype.start = async function () {
  var _this = this

  if (!_this.options.serve && !_this.options.proxy) {
    _this.watch()
    return
  }

  var app = connect()
  if (!this.options.quiet) {
    app.use(function (req, res, next) {
      if (req.url === '/favicon.ico') {
        next()
      } else if (req.url === '/badcertinfo.json') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({id: _this.id}, null, 2));
      } else {
        morgan('dev')(req, res, next)
      }
    })
  }

  if (!_this.options.noReload) {
    _this.lr = LR({
      quiet: _this.options.quiet,
      https: _this.options.https,
      http2: _this.options.http2
    })
    app.use(_this.lr.middleFunc)
    app.use(
      injector(
        function (req, res) {
          return (
            res.getHeader('content-type') &&
            res.getHeader('content-type').indexOf('text/html') !== -1
          )
        },
        function (data, req, res, callback) {
          callback(
            null,
            data
              .toString()
              .replace(
                '</body>',
                '<script src="/__lightserver__/reload-client.js"></script></body>'
              )
          )
        }
      )
    )
  }

  if (_this.options.serve) {
    if (_this.options.proxy) {
      var proxy = require('./proxy')
      app.use(proxy(_this.options.proxy, _this.options.proxypaths).middleFunc)
    }

    if (_this.options.historyindex) {
      var history = require('connect-history-api-fallback')
      app.use(history({ index: _this.options.historyindex }))
    }

    app.use(
      _this.options.servePrefix || '',
      serveStatic(_this.options.serve, {
        extensions: ['html'],
        redirect: _this.options.serveRedirect === true,
        fallthrough: true })
    )
    app.use(
      _this.options.servePrefix || '',
      serveIndex(_this.options.serve, { icons: true })
    )
  }

  var server
  const config = await registerLocalIps();
  if (_this.options.http2) {
    var fs = require('fs')
    var path = require('path')

    server = require('spdy').createServer(
      {
        key: fs.readFileSync(config.keyPath),
        cert: fs.readFileSync(config.certPath)
      },
      app
    )
  }else if (_this.options.https) {

    var fs = require('fs')
    var path = require('path')

    server = require('https').createServer(
      {
        key: fs.readFileSync(config.keyPath),
        cert: fs.readFileSync(config.certPath)
      },
      app
    )
  } else {
    server = require('http').createServer(app)
  }

  server
    .listen(_this.options.port, _this.options.bind, async () => {
      console.log(`Listening on port ${_this.options.port}`);
      let needOpen = _this.options.open;
      setTimeout(()=>{
        if (needOpen){
          const url = `https://ip-127-0-0-1.wrtc.dev}:${_this.options.port}`;
          console.log(url);
          var opener = require('opener')
          opener(url)
          needOpen = false
        }
      }, 5000)
      for (let ip in config.ipMap){
        const url = `https://${config.ipMap[ip].domain}:${_this.options.port}`;
        try{
          const info = await axios.get(url + '/badcertinfo.json');
          if (info.data.id === this.id){
            console.log(`Available ${url}`);
            if (needOpen) {
              var opener = require('opener')
              opener(url)
              needOpen = false
            }
          }else{
            console.log(`wrong domain  ${url} (ID ${info.data.id} should be ${instanceId})`)
          }
        }catch(e){
          if (needOpen){
            console.log(`Not available for now ${url}`, e.name, e.message, e.stack)
          }
        }
      }

      if (_this.lr) {
        _this.lr.startWS(server) // websocket shares same port with http
      }
      _this.watch()

    })
    .on('error', function (err) {
      if (err.errno === 'EADDRINUSE') {
        console.log(
          '## ERROR: port ' + _this.options.port + ' is already in use'
        )
        process.exit(2)
      } else {
        console.log(err)
      }
    })
}

LightServer.prototype.watch = function () {
  var _this = this
  _this.options.watchexps.forEach(function (we) {
    var tokens = we.trim().split(/\s*#\s*/)
    var filesToWatch = tokens[0].trim().split(/\s*,\s*/)
    var commandToRun = tokens[1]
    var reloadOption = tokens[2]
    if (reloadOption !== 'reloadcss' && reloadOption !== 'no-reload') {
      reloadOption = 'reload' // default value
    }

    if (commandToRun || _this.lr) {
      _this.processWatchExp(filesToWatch, commandToRun, reloadOption)
    } else {
      console.log(
        '## WARNING: Ignoring watch expression "' +
          we +
          '", because ' +
          'it doesn\'t specify a command and live-reloading is disabled.'
      )
    }
  })
}

LightServer.prototype.processWatchExp = function (
  filesToWatch,
  commandToRun,
  reloadOption
) {
  var _this = this
  var gaze = new Gaze(filesToWatch, { interval: _this.options.interval })

  // A file has been added/changed/deleted has occurred
  gaze.on('all', function (event, filepath) {
    if (gaze.executing) {
      return
    }

    gaze.executing = true
    _this.writeLog('* file: ' + filepath + ' was ' + event)
    if (!commandToRun) {
      if (_this.lr) {
        _this.lr.trigger(reloadOption, _this.options.delay)
      }

      gaze.executing = false
      return
    }

    console.log('## executing command: ' + commandToRun)
    var start = new Date().getTime()
    var p = spawn(_this.shell, [_this.firstParam, commandToRun], {
      stdio: 'inherit'
    })
    p.on('close', function (code) {
      if (code !== 0) {
        console.log(
          '## ERROR: command ' + commandToRun + ' exited with code ' + code
        )
      } else {
        _this.writeLog(
          '## command succeeded in ' + (new Date().getTime() - start) + 'ms'
        )
        if (_this.lr) {
          _this.lr.trigger(reloadOption, _this.options.delay)
        }
      }

      gaze.executing = false
    })
  })

  if (filesToWatch.length) {
    _this.writeLog(
      'light-server is watching these files: ' + filesToWatch.join(', ')
    )
    _this.writeLog('  when file changes,')
    if (commandToRun) {
      _this.writeLog('  this command will be executed:      ' + commandToRun)
    }
    if (_this.lr) {
      _this.writeLog(
        '  this event will be sent to browser: ' + reloadOption + '\n'
      )
    }
  }
}

module.exports = LightServer
