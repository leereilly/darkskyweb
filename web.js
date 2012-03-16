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

app.get ("/interesting", function (req, res, next) {
  return request (
    util.format (
      "https://api.darkskyapp.com/v1/interesting/%s",
      key
    ),
    function (err, httpres, storms) {
      if (err)
        return next (err)

      if (httpres.statusCode !== 200)
        return next (new Error ("Received an error from Dark Sky."))

      var i
      storms = JSON.parse (storms).storms

      for (i = 0; i !== storms.length; ++i)
        storms[i] = {
          name: storms[i].city,
          latitude: storms[i].latitude,
          longitude: storms[i].longitude
        }

      return res.send (storms)
    }
  )
})

app.get ("/darksky", function (req, res, next) {
  return request (
    util.format (
      "https://api.darkskyapp.com/v1/forecast/%s/%d,%d",
      key,
      parseFloat (req.query.lat),
      parseFloat (req.query.lon)
    ),
    function (err, httpres, forecast) {
      if (err)
        return next (err)

      if (httpres.statusCode !== 200)
        return next (new Error ("Received an error from Dark Sky."))

      forecast = JSON.parse (forecast)

      var data = forecast.hourPrecipitation,
          i = data.length,
          k, e

      while (i--) {
        k = (data[i].probability * data[i].intensity - 3) / (60 - 3)
        e = data[i].error / 150
        data[i] = {min: clamp (k - e), max: clamp (k + e)}
      }

      return res.send ({
        current: forecast.currentSummary,
        forecast: forecast.hourSummary,
        data: data
      })
    }
  )
})

app.listen (8080)
