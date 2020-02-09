#!/usr/bin/env -S node --experimental-modules

const log = str => console.log(str) || str
const err = str => console.error(str) || str

Promise.all([
    import(`../index.js`),
    import(`file://${process.cwd()}/robusto.config.js`)
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
  .catch(error => {
    err(error)
    process.exit(1)
  })