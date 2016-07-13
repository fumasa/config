const CONFIG_SEPARETOR = process.env.CONFIG_SEPARETOR || '.'

const ajax = require('yeller-ajaxcall')
const d3 = require('d3')
const urljoin = require('url-join')

function getValues (config, parent) {
  var values = []
  var keys = d3.keys(config)
  if (typeof config === 'object') {
    for (var i = 0; i < keys.length; i++) {
      if (typeof config[keys[i]] === 'object') {
        var newValue = getValues(config[keys[i]], (parent ? parent + CONFIG_SEPARETOR : '') + keys[i])
        values = values.concat(newValue)
      } else {
        values.push({ key: (parent ? parent + CONFIG_SEPARETOR : '') + keys[i], value: config[keys[i]] })
      }
    }
    return values
  } else {
    return config
  }
}

function getObj (fromdb, obj) {
  obj = obj || fromdb.filter(function (val) {
    return val.indexOf(CONFIG_SEPARETOR) > -1
  }).reduce(function (memo, value) {
    memo[value.key] = value.value
    return memo
  }, [])
  if (typeof fromdb === 'object') {
    return getObj(fromdb.filter(function (val) {
      return val.indexOf(CONFIG_SEPARETOR) !== -1
    }).reduce(function (memo, value) {
      memo.push({ key: value.key.substring(0, value.key.indexOf(CONFIG_SEPARETOR)), value: value.value })
      return memo
    }), obj)
  } else {
    return obj
  }
}

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

function getDBValues (api, values, cb) {
  var list = []
  WaterfallOver(values, function (value, report) {
    ajax.get(urljoin(api, '/config/', value.key), function (v) {
      list.push({ key: value.key, value: v })
      report()
    }, function (erro) {
      console.error(erro)
    })
  }, function () {
    cb(list)
  })
}

function setDBValues (api, defaultValues, fromdb, cb) {
  var list = []
  WaterfallOver(fromdb, function (value, report) {
    if (value.value === null) {
      value = defaultValues.filter(function (val) {
        return val.key === value.key
      })[0]
      list.push(value)
      ajax.post(urljoin(api, '/configs/'), value, function () {
        report()
      }, function (erro) {
        console.error(erro)
      })
    } else {
      list.push(value)
      report()
    }
  }, function () {
    cb(list)
  })
}

module.exports = function (cfg, api) {
  const _default = cfg
  var _values = getValues(cfg)
  getDBValues(api, _values, function (_fromdb) {
    setDBValues(api, _values, _fromdb, function (_todb) {
      _values = getObj(_todb)
      console.debug('yeller-config', _values)
    })
  })
  return _default
}
