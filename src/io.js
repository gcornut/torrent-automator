const moment = require('moment')
const config = require('./config')
const fn = require('./fn')

// Configure transmission
const Transmission = require('transmission')
const transmission = new Transmission({
  host: config.get('transmission-daemon-host'),
  port: config.getNum('transmission-daemon-port')
})

// Configure TPB
process.env.THEPIRATEBAY_DEFAULT_ENDPOINT = config.get('tpb-endpoint')
//process.on('unhandledRejection', console.error)
process.on('unhandledRejection', ()=>null)
const PirateBay = require('thepiratebay')

// Configure TVShowTime
const tvst = new (require('tvshowtime-api'))(config.get('tvshowtime-api-token'))

// FS
const nodeFs = require('fs')
const fs = {
  exists: fn.denodeify(nodeFs.stat),
  link: fn.denodeify(nodeFs.link),
  readdir: fn.denodeify(nodeFs.readdir),
  appendFile: fn.denodeify(nodeFs.appendFile),
  mkdirp: fn.denodeify(require('mkdir-parents')),
  truncateFileSync: (filePath, linesNb) => fn.pipe(
    fn.partial(nodeFs.readFileSync, [filePath]),
    fn.toString,
    fn.split('\n'),
    (lines) => fn.drop(lines.length-linesNb, lines),
    fn.join('\n'),
    fn.partial(nodeFs.writeFileSync, [filePath])
  )()
}

const createFileLog = (filePath) => {
  // Add dash separator
  fs.appendFile(filePath, fn.repeat('-', 50).join('')+'\n')
  // Truncate file to 1000 lines
  fs.truncateFileSync(filePath, 1000)
  return (...args) => {
    fs.appendFile(filePath, args.join(' ')+'\n')
  }
}

module.exports = {
  fs,

  Transmission: {
    get: fn.denodeify(transmission.get.bind(transmission)),
    addUrl: fn.denodeify(transmission.addUrl.bind(transmission)),
  },

  PirateBay,

  TVShowTime: {
    getToWatch: () => new Promise((resolve, _) =>
      tvst.getToWatch({page: 0, limit: 100}, resolve)
    ),
    getEpisode: filename => new Promise((resolve, reject) =>
      tvst.getEpisode({filename}, res => res.episode ? resolve(res.episode) : reject(res))
    )
  },

  Logger: {
    createFileLog,

    create: (scriptFile) => {
      let fileLog = createFileLog(scriptFile.replace('src/', 'logs/').replace('.js', '.log'))
      return (...m) => {
        let date = moment().format("DD/MM/YY HH:mm:ss")
        let args = ['[' + date + ']', ...m]
        fn.apply(console.log, args)
        fn.apply(fileLog, args)
      }
    }
  }
}