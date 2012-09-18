/**
 * Copyright(c) 2012 Goku Gong <gokugong@gmail.com>
 * MIT Licensed
 */
var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    //d3 = require('d3'),
    path = require('path'),
    fs = require('fs');

app.listen(8888);

// data history cache
var history = [];

var DATA_FILE = 'lmdata.json';
var SIGNAL_RELOAD = 'lmdata.json.reload';

// open data file to persist
//TODO: persist to database
var log = fs.createWriteStream(DATA_FILE, {'flags': 'a'});

function handler(req, res) {
  var filePath = req.url;
  var extname = path.extname(filePath);
  var contentTypesByExtention = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css'
  };
  var contentType = contentTypesByExtention[extname]; //|| 'text/plain';

  //console.log('content type by extension: ' + extname);
  //console.log('content type: ' + contentType);

  // ignore favicon requests
  if (filePath == '/favicon.ico') {
    console.log('favicon request. muted.');
    res.writeHead(200, {'Content-Type': 'image/x-icon'});
    return res.end();
  }

  var canHandle = false;

  // check for all the cases this handler handles
  if (filePath == undefined || filePath == '/') {
    // load default file
    filePath = __dirname + '/lmclient.html';
    contentType = 'text/html';
    canHandle = true;

  } else if (true == /^\/*javascript.*/.test(filePath)) {
    console.log('javascript request. ' + filePath);
    console.log('content type: ' + contentType);
    filePath = __dirname + filePath;
    canHandle = true;
  }

  if (true == canHandle) {
    fs.readFile(filePath, function (err, data) {
      if (err) {
        console.log(err);
        res.writeHead(500);
        return res.end('Error loading default page.');
      }

      //console.log('fetch ' + filePath);
      res.writeHead(200, { 'content-type': contentType });
      res.end(data);
    });
  }
};

// create a new websocket 
io.sockets.on('connection', function (socket) {
  // send client it's id
  socket.emit('socketid', {'socket_id': socket.id});

  // broadcast total number of connected clients
  io.sockets.emit('totalclients',
    {'total_clients': io.sockets.clients().length});

  // send client data history to enable redraw
  socket.emit('synchistory', {'history': history});

  console.log('total connected = ' + io.sockets.clients().length);

  //TODO: fetch data from database upon client's refresh

  // demo: reload from file
  // polling SIGNAL_RELOAD every {interval}
  fs.watchFile(SIGNAL_RELOAD, { persistent: true, interval:5007 },
      function (curr, prev) {

    if (curr.mtime == prev.mtime) return; 

    fs.readFile(DATA_FILE, 'utf8', function (err, data) {
      if (err) throw err;

      //console.log(data);
      var data2 = '[' + data + '{}]';
      history = JSON.parse(data2);
      io.sockets.emit('synchistory', { 'history': history } );

      //console.log('fetch from file = ' + data);
    });
  });

  socket.on('newpoint', function(data) {
    data.timestamp = new Date().getTime();
    history.push(data);
    console.log(data);
    io.sockets.emit('notification', data);

    // persist
    log.write(JSON.stringify(data) + ',\n');
  });

  socket.on('disconnect', function() {
    // remove upon disconnect
    delete io.sockets.clients[socket.id];
    io.sockets.emit('totalclients',
      {'total_clients': io.sockets.clients().length});
  });
});

