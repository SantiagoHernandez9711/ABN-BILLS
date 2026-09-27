const https = require('https');
const http = require('http');

exports.handler = async function(event) {
  const url = event.queryStringParameters && event.queryStringParameters.url;

  if (!url) {
    return { statusCode: 400, body: 'Missing url parameter' };
  }

  return new Promise(function(resolve) {
    const lib = url.startsWith('https') ? https : http;

    lib.get(url, function(response) {
      let data = '';
      response.on('data', function(chunk) { data += chunk; });
      response.on('end', function() {
        resolve({
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/calendar'
          },
          body: data
        });
      });
    }).on('error', function(err) {
      resolve({ statusCode: 500, body: 'Error: ' + err.message });
    });
  });
};
