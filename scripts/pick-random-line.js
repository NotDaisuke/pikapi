var url = require('url');
var http = require('http');
var winston = require('winston');


var urlWithUrlRegex = /^(.+)(https?:\/\/.*)$/gi;


function getLine(remoteURL, lineNumber, onSuccess, onFailure) {

    var urlParts = url.parse(remoteURL, true);
    var requestOptions = {
        host: urlParts.hostname,
        path: urlParts.path
    };

    if(url.port && url.port != '80') {
        requestOptions.port = url.port;
    }

    winston.info("Querying " + remoteURL + "...");
    http.request(
        requestOptions,
        function(response) {
            winston.info("Request successful.");
            handleRemoteResponse(response, function(err, data) {
                if(err) {
                    winston.warn("Error while retrieving remote document: " + err);
                    onFailure("Connection error: " + err);
                    return;
                }

                if(!data || !data.trim()) {
                    winston.warn("Request succeeded but document was empty!");
                    onFailure("Empty document!");
                    return;
                }

                var line = getLineFromString(data, lineNumber);
                if(line) {
                    winston.info("Line found: " + line);
                    onSuccess(line);
                }
                else {
                    winston.warn("Line not found!");
                    if(lineNumber !== null) {
                        onFailure("Line " + lineNumber + " is empty or nonexistent!");
                    }
                    else {
                        onFailure("Could not find a non-empty line!");
                    }
                }
            });
        }
    ).on(
        'error',
        function(err) {
            winston.warn("Request unsuccessful.");
            onFailure(err);
        }
    ).end();
}

function handleRemoteResponse(response, cb) {
    var str = '';

    response.on('data', function(data) {
        str += data;
    });

    response.on('end', function() {
        cb(null, str);
    });

    response.on('error', function(err) {
        cb(err);
    });
}

function getLineFromString(str, lineNumber) {
    // reject empty strings
    if(!str.trim()) {
        return null;
    }

    var parts = str.split(/[\n\r]+/g);
    var line;
    if(lineNumber !== null) {
        if(lineNumber >= 1 && parts[lineNumber - 1]) {
            line = parts[lineNumber - 1];
        }
        else {
            line = null;
        }
    }
    else {
        do {
            var idx = Math.floor(Math.random() * parts.length);
            line = parts[idx];
        } while(!line.trim());
    }
    return line;
}

function handleRequest(request, response, cb) {
    var requestURL = request.url;

    // if we spot a URL, encode everything from that URL forward
    var matches = urlWithUrlRegex.exec(requestURL);
    if(matches && matches[1] && matches[2]) {
        var encodedSecondURL = encodeURIComponent(matches[2]);
        requestURL = requestURL.replace(urlWithUrlRegex, "$1" + encodedSecondURL);
        winston.log('URL encoded to ' + requestURL);
    }

    var parts = url.parse(requestURL, true);
    if(parts.query && parts.query.url) {
        // if line number not specified, default to null,
        // which will result in a random line being selected
        var lineNumber = parts.query.line;
        if(!lineNumber || isNaN(lineNumber)) {
            lineNumber = null;
        }
        else {
            // lineNumber guaranteed to be numeric
            lineNumber = parseInt(lineNumber);
        }

        getLine(
            parts.query.url,
            lineNumber,
            function(line) {
                response.write(line);
                cb();
            },
            function(err) {
                response.write("Error! " + err);
                cb();
            }
        );
    }
    else {
        response.write("Invalid request! You must provide the 'url' parameter.");
    }
}


module.exports = {
    endpoint: '/pick-random-line',
    requestHandler: handleRequest
};
