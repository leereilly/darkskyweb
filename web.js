var express = require ("express"),
    path = require ("path"),
    request = require ("request"),
    util = require ("util"),
    app = express.createServer (),
    key = process.argv[2]

if (!key)
  throw "please provide an API key as a command line argument"

app.use (express.query ())
app.use (express.static (path.join (__dirname, "public")))

function clamp (x) {
  if (x < 0) return 0
  if (x > 1) return 1
  return x * x
}

function locations (query, callback) {
  var locations = []

  if (query.lat && query.lon)
    locations.push ({
      name: "Here",
      latitude: parseFloat (query.lat),
      longitude: parseFloat (query.lon)
    })

  return request (
    util.format (
      "https://api.darkskyapp.com/v1/interesting/%s",
      key
    ),
    function (err, res, storms) {
      if (err)
        return callback (err)

      if (res.statusCode !== 200)
        return callback (new Error ("Received an error from Dark Sky."))

      var cities = {},
          i

      storms = JSON.parse (storms).storms

      for (i = 0; i !== storms.length; ++i) {
        if (cities[storms[i].city]) continue
        cities[storms[i].city] = true

        locations.push ({
          name: storms[i].city,
          latitude: storms[i].latitude,
          longitude: storms[i].longitude
        })
      }

      return callback (null, locations)
    }
  )
}

function forecast (lat, lon, callback) {
  return request (
    util.format (
      "https://api.darkskyapp.com/v1/forecast/%s/%d,%d",
      key,
      lat,
      lon
    ),
    function (err, res, forecast) {
      if (err)
        return callback (err)

      if (res.statusCode !== 200)
        return callback (new Error ("Received an error from Dark Sky."))

      forecast = JSON.parse (forecast)

      if (forecast.error)
        return callback (new Error (forecast.error))

      return callback (null, forecast)
    }
  )
}

app.get ("/darksky", function (req, res, next) {
  locations (req.query, function (err, locations) {
    if (err)
      return next (err)

    var i = locations.length,
        todo = i

    function join (err) {
      if (!todo)
        return

      if (err) {
        todo = 0
        return next (err)
      }

      if (--todo)
        return

      return res.send (locations)
    }

    function addForecast (i) {
      var loc = locations[i]

      return forecast (loc.latitude, loc.longitude, function (err, forecast) {
        if (err)
          return join (err)

        var data = forecast.hourPrecipitation,
            i = data.length,
            k, e

        while (i--) {
          k = (data[i].probability * data[i].intensity - 3) / (60 - 3)
          e = data[i].error / 150
          data[i] = {min: clamp (k - e), max: clamp (k + e)}
        }

        loc.current = forecast.currentSummary
        loc.forecast = forecast.hourSummary
        loc.data = data

        return join (null)
      })
    }

    while (i--)
      addForecast (i)
  })
})

app.listen (8080)
