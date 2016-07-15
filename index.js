const CONFIG_CACHE_INTERVAL = process.env.CONFIG_UPDATE_INTERVAL || 5

const ajax = require('yeller-ajaxcall')
const urljoin = require('url-join')

function WaterfallOver (list, iterator, callback) {
  var nextItemIndex = 0
  function report () {
    nextItemIndex++
    if (nextItemIndex === list.length) {
      callback()
    } else {
      iterator(list[nextItemIndex], report)
    }
  }
  iterator(list[0], report)
}

module.exports = function (cfg, api) {
  var values = []
  for (var prop in cfg) {
    values.push({ key: prop, value: cfg[prop] })
  }
  WaterfallOver(values, function (value, report) {
    ajax.get(urljoin(api, 'config', value.key), function (data) {
      if (data === null) {
        ajax.post(urljoin(api, 'configs'), { key: value.key, value: JSON.stringify(value.value) }, function () {
          console.debug('configuration created %s', value.key)
        })
      }
      report()
    })
  }, function () {
    console.debug('configuration saved!')
  })
  return {
    _api: api,
    _cache: {},
    _getDB: function (cb) {
      ajax.get(urljoin(this._api, '/configs'), function (v) {
        cb(null, v)
      }, function (erro) {
        console.error(erro)
        cb(erro)
      })
    },
    _parseJSON: function (text) {
      try {
        return JSON.parse(text)
      } catch (e) {
        return text
      }
    },
    value: function (cb) {
      var now = new Date()
      now.setMinutes(now.getMinutes() - CONFIG_CACHE_INTERVAL)
      if (this._cache !== undefined && this._cache.updated > now) {
        return (cb(this._cache.value, { from: 'cache' }))
      } else {
        var config = this
        this._getDB(function (err, values) {
          if (err) console.error(err)
          else {
            var cacheData = values.reduce(function (memo, value) {
              memo[value.key] = config._parseJSON(value.value)
              return memo
            }, {})
            config._cache = { updated: new Date(), value: cacheData }
            return (cb(config._cache.value, { from: 'database' }))
          }
        })
      }
    }
  }
}
