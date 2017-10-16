// Super Simple Static HTTP Server

var static = require('node-static'),
    port = process.env.PORT || 3000,
    http = require('http');

var staticServer = new static.Server( './public', {
    cache: 3600,
    gzip: true
});

http.createServer(function(req, res) {
    req.addListener('end', function() {
        staticServer.serve(req, res);
    }).resume();
}).listen(port, function() {
    console.log("Listening on port " + port + ".");
    console.log("Open http://localhost:" + port + " in your browser.");
});
