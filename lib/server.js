var client = require('../src/redis')()
var http = require('http')
var url = require('url')

module.exports = http.createServer(requestHandler)

function requestHandler (req, res) {
  if (req.method === 'POST' && req.url === '/buyers') {
    var jsonString = ''
    req.on('data', function (data) {
      jsonString += data
    })
    req.on('end', function () {
      handlePostBuyers(req, res, jsonString)
    })
  } else if ((req.method === 'GET') && (req.url.startsWith('/buyers')) && (req.url.split('/buyers').length === 2)) {
    handleGetBuyers(req, res)
  } else if ((req.method === 'GET') && (req.url.indexOf('/route') > -1)) {
    handleRouteBuyers(req, res)
  } else {
    res.writeHead(404, {'Content-Type': 'application/json'})
    res.write(JSON.stringify({'Error': 'Resource not found'}))
    return res.end()
  }
}

function handlePostBuyers (req, res, body) {
  try {
    var jsonParsed = JSON.parse(body)
    if (('offers' in jsonParsed) && ('id' in jsonParsed)) {
      var id = jsonParsed.id
      var buyer = body
      client.hset('buyers', id, buyer, function (err, reply) {
        if (!err) {
          if (reply === 1) {
            res.writeHead(201, {'Content-Type': 'application/json'})
            res.write(JSON.stringify({'Success': `Buyer ${id} added successfully`}))
            return res.end()
          } else if (reply === 0) {
            res.writeHead(201, {'Content-Type': 'application/json'})
            res.write(JSON.stringify({'Existing buyer': `Buyer with id:${id} already existing`}))
            return res.end()
          }
        } else {
          res.writeHead(500, {'Content-Type': 'application/json'})
          res.write(JSON.stringify({'Error': 'Internal Server Error'}))
          return res.end()
        }
      })
    } else {
      res.writeHead(400, {'Content-Type': 'application/json'})
      res.write(JSON.stringify({'Error': 'Malformed Request'}))
      return res.end()
    }
  } catch (e) {
    res.writeHead(400, {'Content-Type': 'application/json'})
    res.write(JSON.stringify({'Error': 'Invalid JSON'}))
    return res.end()
  }
}

function handleGetBuyers (req, res) {
  var id = req.url.split('/')[2]
  client.hget('buyers', id, function (err, reply) {
    if (!err) {
      if (reply) {
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.write(reply)
        return res.end()
      } else {
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.write(JSON.stringify({'Error': 'No Match'}))
        return res.end()
      }
    } else {
      res.writeHead(500, {'Content-Type': 'application/json'})
      res.write(JSON.stringify({'Error': 'Internal Server Error'}))
      return res.end()
    }
  })
}

function handleRouteBuyers (req, res) {
  var queryData = url.parse(req.url, true).query
  var queryTimestamp = queryData.timestamp
  var queryDevice = queryData.device
  var queryState = queryData.state
  var parsedTimestamp = new Date(queryTimestamp)
  var hourTimestamp = parsedTimestamp.getHours()
  var dayTimestamp = parsedTimestamp.getDay()

  client.hgetall('buyers', function (err, reply) {
    if (!err) {
      var maxValue = 0
      var maxLocation = null

      for (var key in reply) {
        // buyer has many offers
        if (JSON.parse(reply[key])['offers'].length > 1) {
          JSON.parse(reply[key])['offers'].forEach(function (element) {
            // check if there is a match...
            if (element['criteria']['hour'].indexOf(hourTimestamp) >= 0 &&
                        element['criteria']['day'].indexOf(dayTimestamp) >= 0 &&
                        element['criteria']['device'].indexOf(queryDevice) >= 0 &&
                        element['criteria']['state'].indexOf(queryState) >= 0) {
              // ...if there is one track location of highest value
              if (element.value > maxValue) {
                maxValue = element.value
                maxLocation = element.location
              }
            }
          })
        } else {
          var element = JSON.parse(reply[key])['offers'][0]
          if (element['criteria']['hour'].indexOf(hourTimestamp) >= 0 &&
                      element['criteria']['day'].indexOf(dayTimestamp) >= 0 &&
                      element['criteria']['device'].indexOf(queryDevice) >= 0 &&
                      element['criteria']['state'].indexOf(queryState) >= 0) {
            if (JSON.parse(reply[key])['offers'][0].value > maxValue) {
              maxValue = JSON.parse(reply[key])['offers'][0].value
              maxLocation = JSON.parse(reply[key])['offers'][0].location
            }
          }
        }
      }
      res.writeHead(302, {'location': maxLocation})
      res.end()
    } else {
      res.writeHead(500, {'Content-Type': 'application/json'})
      res.write(JSON.stringify({'Error': 'Internal Server Error'}))
      res.end()
    }
  })
}
