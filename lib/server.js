var client = require('../src/redis')()
var http = require('http')
var url = require('url')

module.exports = http.createServer(requestHandler)

function requestHandler (req, res) {
  var {method, url} = req
  var body = []
  req.on('error', function (err) {
    console.error(err.stack)
  })
  .on('data', function (chunk) {
    body.push(chunk)
  })
  .on('end', function () {
    body = Buffer.concat(body).toString()
    if (method === 'POST') {
      try {
        body = JSON.parse(body)
      } catch (e) {
        res.writeHead(400, {'Content-Type': 'application/json'})
        return res.end(JSON.stringify({'Error': 'Invalid JSON'}))
      }
    }
    if ((method === 'POST') && (url === '/buyers')) {
      handlePostBuyers(req, res, body)
    } else if (method === 'GET') {
      if (url.startsWith('/buyers') && url.split('/buyers').length === 2) {
        handleGetBuyers(req, res)
      } else if (url.indexOf('/route') > -1) {
        handleRouteBuyers(req, res)
      }
    } else {
      writeResponse(res, 404, {'Error': 'Resource not found'})
    }
  })
}

function handlePostBuyers (req, res, body) {
  if (!(('offers' in body) && ('id' in body))) {
    writeResponse(res, 400, {'Error': 'Malformed Request'})
  } else {
    var id = body.id
    var buyer = JSON.stringify(body, null, 4)
    client.hset('buyers', id, buyer, function (err, reply) {
      if (err) writeResponse(res, 500, {'Error': 'Internal Server Error'})
      if (reply === 1) writeResponse(res, 201, {'Success': `Buyer ${id} added successfully`})
      if (reply === 0) writeResponse(res, 201, {'Existing buyer': `Buyer with id:${id} already existing`})
    })
  }
}

function handleGetBuyers (req, res) {
  var id = req.url.split('/')[2]
  client.hget('buyers', id, function (err, reply) {
    if (err) { writeResponse(res, 500, {'Error': 'Internal Server Error'}) }
    reply
    ? writeResponse(res, 200, JSON.parse(reply))
    : writeResponse(res, 200, {'Error': 'No Match'})
  })
}

function handleRouteBuyers (req, res) {
  client.hgetall('buyers', function (err, reply) {
    if (err) {
      writeResponse(res, 500, {'Error': 'Internal Server Error'})
    } else {
      if (reply) {
        var maxLocation = checkOffers(req, res, reply)
      }
      res.writeHead(302, {'location': maxLocation})
      res.end()
    }
  })
}

function checkOffers (request, response, reply) {
  var queryData = url.parse(request.url, true).query
  var queryTimestamp = queryData.timestamp
  var queryDevice = queryData.device
  var queryState = queryData.state

  var parsedTimestamp = new Date(queryTimestamp)
  var hourTimestamp = parsedTimestamp.getUTCHours()
  var dayTimestamp = parsedTimestamp.getUTCDay()

  var maxValue = 0
  var maxLocation = null

  for (var key in reply) {
    var offers = JSON.parse(reply[key])['offers']
    offers.forEach(function (offer) {
      if (offer['criteria']['hour'].indexOf(hourTimestamp) >= 0 &&
            offer['criteria']['day'].indexOf(dayTimestamp) >= 0 &&
            offer['criteria']['device'].indexOf(queryDevice) >= 0 &&
            offer['criteria']['state'].indexOf(queryState) >= 0) {
        if (offer.value > maxValue) {
          maxValue = offer.value
          maxLocation = offer.location
        }
      }
    })
  }
  return maxLocation
}

function writeResponse (response, statusCode, message) {
  response.writeHead(statusCode, {'Content-Type': 'application/json'})
  return response.end(JSON.stringify(message))
}
