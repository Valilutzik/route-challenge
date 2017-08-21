function createServer () {
  var client = require('../src/redis')()
  var express = require('express')
  var bodyParser = require('body-parser')

  var app = express()
  app.use(bodyParser.json())

// Syntax error in case JSON was invalid
  app.use(function (error, req, res, next) {
    if (error instanceof SyntaxError) {
      res.status(400).send({error: 'Invalid JSON'})
    } else {
      next()
    }
  })

// =========================================================================
// POST /buyers to the database
  app.post('/buyers', function (req, res) {
    addBuyer(req.body, res, function (result) {
      return res.send(result)
    })
  })

  function addBuyer (body, res, cb) {
    if (('id' in body) && ('offers' in body)) {
      var id = body.id
      var buyer = JSON.stringify(body.id)
      client.hset('buyers', id, buyer, function (err, reply) {
        if (!err) {
          if (reply === 1) {
            return cb(res.status(201).send({'Success': `Buyer ${id} added successfully`}))
          } else if (reply === 0) {
            return cb(res.status(201).send({'Existing Buyer': `Buyer ${id} already exists`}))
          }
        } else {
          return cb(res.status(500).send({error: 'Internal Server Error'}))
        }
      })
    } else {
      return cb(res.status(400).send({error: 'Malformed request'}))
    }
  }

// =========================================================================

// =========================================================================
// GET /buyers/:id
  app.get('/buyers/:id', function (req, res) {
    var id = req.params.id
    getBuyer(id, res, function (result) {
      return result
    })
  })

  function getBuyer (id, res, cb) {
    client.hget('buyers', id, function (err, reply) {
      if (!err) {
        var data = JSON.parse(reply)
        if (data) {
          return cb(res.status(200).send(data))
        } else {
          return cb(res.status(200).json({'Error': 'No match'}))
        }
      } else {
        return cb(res.status(500).json({'Error': 'Internal Server Error'}))
      }
    })
  }
// =========================================================================

// =========================================================================
// GET /route
  app.get('/route', function (req, res) {
    routeTraffic(req, res, function (result) {
      return result
    })
  })

  function routeTraffic (request, response, cb) {
    var queryTimestamp = request.query.timestamp
    var queryDevice = request.query.device
    var queryState = request.query.state

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
        return cb(response.status(302).json({'location': maxLocation}))
      } else {
        return cb(response.status(500).send({'Error': 'Internal Server Error'}))
      }
    })
  }

// =========================================================================

  var server = app.listen(3000, function () { console.log('running...') })
  return server
}

module.exports = createServer
