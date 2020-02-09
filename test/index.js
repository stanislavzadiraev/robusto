import stream from 'stream'
import fs from 'fs'
import path from 'path'
import http2 from 'http2'
import zlib from 'zlib'

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

const mute = !true

const noop = _ => _

const log = str =>
  mute && noop(str) ||
  (console.log(str), str)

const err = str =>
  (console.error(str), str)

////////////////////////////////////////////////////////////////////////////////

const I = 1
const K = 1024 * I
const M = 1024 * K
const G = 1024 * M

////////////////////////////////////////////////////////////////////////////////

const SOURCES = (phrase, length, filenames, dirname) =>
  Promise.all([
    new stream.Readable({
      read(size) {
        (length > size) && (this.push(phrase.repeat(size)), length -= size) ||
        (length > 0) && (this.push(phrase.repeat(length)), length = 0) ||
        this.push(null)
      }
    }),
    Promise.all(filenames.map(filename =>
      fs.promises.mkdir(dirname)
      .catch(error =>
        new Promise((resolve, reject) =>
          error.code === 'EEXIST' && resolve() ||
          reject(error)
        ))
      .then(() =>
        fs.createWriteStream(
          path.join(dirname, filename)
        )
      )
    ))
  ])
  .then(([source, files]) =>
    Promise.all(files.map(file =>
      new Promise((resolve, reject) =>
        source
        .on('error', errot => reject(error))
        .pipe(
          file
          .on('error', errot => reject(error))
          .on('finish', () => resolve())
        )
      )
    ))
  )

////////////////////////////////////////////////////////////////////////////////

const ECHO = (data, echo) =>
  setInterval(
    () =>
    echo && log(data),
    1000
  )

////////////////////////////////////////////////////////////////////////////////

const id = () =>
  ("000" + ((Math.random() * 46656) | 0).toString(36)).slice(-3) +
  ("000" + ((Math.random() * 46656) | 0).toString(36)).slice(-3)

const transit = () =>
  new stream.Transform({
    transform: (chunk, encoding, callback) =>
      setImmediate(callback, null, chunk)
  })

const output = (sign, echo) =>
  new stream.Writable({
    write(chunk, encoding, callback) {
      echo && log({
        sign,
        size: chunk.length
      })
      callback()
    }
  })

const NOISE = (requests, force, interval, echo) =>
  setInterval(
    () =>
    Promise.all(requests
      .map(headers =>
        Promise.all((new Array(force)).fill(headers).map(headers =>
          Promise.all([
            http2.connect('https://localhost:8888'),
            transit(),
            output({
                id: `noise-${id()}`,
                path: headers[':path'],
                mime: headers['accept']
              },
              echo
            )
          ])
          .then(([client, transit, output]) =>
            new Promise((resolve, reject) => (
              setTimeout(
                () =>
                client.destroy(),
                Math.floor(Math.random() * interval)
              ),
              client
              .on('error', error => reject(error))
              .once('goaway', error => reject(Error(
                `test noise, GOAWAY frame received with ${error} code`
              )))
              .request(headers)
              .on('error', error => reject(error))
              .once('end', () => client.close())
              .pipe(transit)
              .pipe(
                output
                .once('error', error => reject(error))
                .once('finish', () => resolve())
              )
            ))
          )
          .catch(noop)
        ))
      )
    ),
    interval
  )

const FLOOD = (requests, force, calls, echo) =>
  Promise.all(requests
    .map(headers =>
      Promise.all((new Array(force)).fill(headers).map(headers =>
        Promise.all([
          http2.connect('https://localhost:8888'),
          transit(),
          output({
              id: `flood-${id()}`,
              path: headers[':path'],
              mime: headers['accept']
            },
            echo
          )
        ])
        .then(([client, transit, output]) =>
          new Promise((resolve, reject) =>
            client
            .on('error', error => reject(error))
            .once('goaway', error => reject(Error(
              `test flood, GOAWAY frame received with ${error} code`
            )))
            .request(headers)
            .on('error', error => reject(error))
            .once('end', () => client.close())
            .once('readable', calls.opening)
            .on('data', calls.streaming)
            .once('end', calls.closing)
            .pipe(transit)
            .pipe(
              output
              .once('error', error => reject(error))
              .once('finish', () => resolve())
            )
          )
        )
        .catch(calls.crashing)
      ))
    )
  )
  .then(calls.finishing)

////////////////////////////////////////////////////////////////////////////////

Promise.all([
    import(`../index.js`),
    import(`./config.js`),
  ])
  .then(([servermodule, configmodule]) =>
    servermodule.default(configmodule.default)
  )
  .then(server =>
    server
    .on('error', error => {
      err(error)
      process.exit(1)
    })
  )
  //////////////////////////////////////////////////////////////////////////////
  .then(server => [
    server,
    {
      source: {
        location: './test/dst/',
        names: ['index.html', 'index.js'],
        phrase: 'A',
        length: 1 * M
      },
      target: {
        requests: [{
          ':path': '/',
          'accept': 'text/plain, text/html',
        }, {
          ':path': '/',
          'accept': 'application/javascript',
        }]
      },
      noise: {
        interval: 5000,
        force: 1 * I,
        echo: !false
      },
      flood: {
        force: 2 * K,
        echo: false
      },
      echo: true
    }
  ])
  .then(([server, config]) =>
    SOURCES(
      config.source.phrase,
      config.source.length,
      config.source.names,
      config.source.location
    )
    .then(() => [
      server, config
    ])
  )
  .then(([server, config]) => [
    server,
    log({
      config,
      target: {
        length: config.target.requests.length *
          config.flood.force *
          config.source.phrase.length *
          config.source.length,
        opened: config.target.requests.length *
          config.flood.force,
        closed: config.target.requests.length *
          config.flood.force,
        crashed: 0
      },
      errors: []
    })
  ])
  .then(([server, test]) =>
    Promise.all([
      server,
      ECHO({
          target: test.target
        },
        test.config.echo
      ),
      NOISE(
        test.config.target.requests,
        test.config.noise.force,
        test.config.noise.interval,
        test.config.noise.echo
      ),
      FLOOD(
        test.config.target.requests,
        test.config.flood.force,
        ({
          streaming: chunk =>
            test.target.length -= chunk.length,
          opening: () =>
            --test.target.opened,
          closing: () =>
            --test.target.closed,
          crashing: error => (
            test.errors.push(error),
            ++test.target.crashed
          ),
          finishing: () => log({
            errors: test.errors,
            target: test.target,
            config: test.config
          })
        }),
        test.config.flood.echo
      )
    ])
  )
  .then(([server, echo, noise, flood]) => (
    clearInterval(echo),
    clearInterval(noise),
    new Promise((resolve, reject) =>
      flood.target.length !== 0 && reject(Error(
        'wrong target length'
      )) ||
      flood.errors.length !== 0 && reject(Error(
        'wrong errors length'
      )) ||
      resolve(server)
    )
    .catch(error => (
      err(error),
      server
    ))
  ))
  //////////////////////////////////////////////////////////////////////////////
  .then(server => (
    server.close(),
    process.exit(0)
  ))