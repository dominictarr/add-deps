var semver = require('semver')
var fs = require('fs')
var path = require('path')

//if no range is given, add a tight range around what module is currently installed.


function packagePath(dir, module) {
  return path.join(dir, 'node_modules', module, 'package.json')
}


function readJson(file, cb) {
  fs.readFile(file, 'utf-8', function (err, data) {
    if(err) return cb(err)
    try { data = JSON.parse(data) } catch (err) { return cb(err) }
    cb(null, data)
  })
}

function currentPackage(dir, moduleAtVersion, cb) {
  moduleAtVersion = moduleAtVersion.split('@')
  var module = moduleAtVersion.shift()
  var vrange = moduleAtVersion.shift()

  if(vrange && !semver.validRange(vrange))
    return cb(new Error(JSON.stringify(vrange) + ' is not a valid range'))

  readJson(packagePath(dir, module), function (err, pkg) {
    if(err) {
      err.message =
        'module:'+module + ' is not currently installed.\n'
      + 'it must be installed before you can add it as dep\n'
      + err.message
      return cb(err)
    }
    
    if(!vrange) return cb(null, '~'+pkg.version, module)
    if(!semver.satisfies(pkg.version, vrange))
      return cb(new Error(
        'current version of ' + module+' ('+pkg.version+')\n'
      + 'does not satisfy range:' + JSON.stringify(vrange)
      ))
    cb(null, vrange, module)
  })
}

function collectRanges(dir, modules, cb) {
  var n = modules.length
  var deps = {}
  if(!n) return cb(new Error('no modules'))

  for(var i in modules)
    currentPackage(dir, modules[i], next)

  function next(err, vrange, module) {
    if(err) return n=-1, cb(err)
    deps[module] = vrange
    if(--n) return
    cb(null, deps)
  }
}

function merge (a, b) {
  for(var k in b)
    a[k] = b[k]
  return a
}

function updateDeps(dir, modules, opts, cb) {
  var pkgFile = path.join(dir, 'package.json')
  var deps
    = opts['save-dev']  ? 'devDependencies'
    : opts['save-peer'] ? 'peerDependencies'
    :                     'dependencies'

  readJson(pkgFile, function (err, pkg) {
    if(err) return cb(err)
    collectRanges(dir, modules, function (err, dependencies) {
      if(err) return cb(err)
      pkg[deps] = pkg[deps] || {}
      merge(pkg[deps], dependencies)
      fs.writeFile(pkgFile, JSON.stringify(pkg, null, 2), function (err) {
        if(err) return cb(err)
        cb(null, deps)
      })
    })
  })
}

module.exports = updateDeps

if(!module.parent) {
  updateDeps(process.cwd(), process.argv.slice(2), {}, function (err) {
    if(err) throw err
  })
}
