# Robusto

[![Maintainability](https://api.codeclimate.com/v1/badges/32d6450e036d09b4a5c3/maintainability)](https://codeclimate.com/github/stanislavzadiraev/robusto/maintainability)
[![Build Status](https://travis-ci.org/stanislavzadiraev/robusto.svg?branch=master)](https://travis-ci.org/stanislavzadiraev/robusto)

A Node.js HTTP2 static server.

[Installation](#installation) \| [Environment setup](#environment-setup) \| [API usage](#api-usage) \| [CLI usage](#cli-usage) \| [Options](#options) \| [Details](#details) \| [License](#license)

## Installation

-   Install the stable version:

    ```shell
    npm i robusto
    ```

-   Install the latest version:

    ```shell
    npm i stanislavzadiraev/robusto#master
    ```

## Environment setup

-   Get ready to route requests:

    -   Prepare [DNS records](https://en.wikipedia.org/wiki/List_of_DNS_record_types) with the target hostnames for routing requests to the [loopback](https://en.wikipedia.org/wiki/Loopback) IP address in the local [hosts file](https://en.wikipedia.org/wiki/Hosts_%28file%29) for a local usage.

    -   Prepare [DNS records](https://en.wikipedia.org/wiki/List_of_DNS_record_types) with the target hostnames for routing requests to the [current system](https://en.wikipedia.org/wiki/Localhost) IP address on the [DNS servers](https://en.wikipedia.org/wiki/Domain_Name_System) for a network usage.

    -   Use target IP addresses directly instead of hostnames.

-   Get ready for a high load:

    -   Add `net.core.somaxconn=65535` to `/etc/sysctl.conf`.

    -   Run `sysctl net.core.somaxconn=65535`.

## API usage

### Signature

`robusto([options])`

### Receives

An [`Object`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) containing the options. Detailed in [Options](#options) below.

### Returns

A [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) resolved with the [`Http2SecureServer`](https://nodejs.org/api/http2.html#http2_class_http2secureserver) upon success.

### Examples

#### Declare

```javascript
import robusto from 'robusto'
```

#### Execute

-   Create and run a simplex server:

    ```javascript
    robusto({
      hostnames: ['localhost']
    })
    ```

-   Create and run a complex server:

    ```javascript
    robusto({
        port:8080,
        hostnames: ['someonehost', 'otheronehost'],
        mapSignname: signname => `../signs/${signname}`,
        mapHostname: (hostname, pathname) => `../hosts/${hostname}`,
        mapPathname: (pathname, hostname) => `${pathname}`
    })
    ```

#### Control

-   After the server has been created, it can be closed directly:

    ```javascript
    robusto({
      hostnames: ['localhost']
    })
    .then(server => (
      server.close(),
      process.exit(0)
    ))
    ```

-   After the server has been created, runtime errors can be catched:

    ```javascript
    robusto({
      hostnames: ['localhost']
    })
    .then(server =>
      server
      .on('error', error => (
        console.error(error),
        process.exit(1)
      ))
    )
    ```

-   After the server has not been created, throwed error can be catched:

    ```javascript
    robusto({
      hostnames: ['localhost']
    })
    .catch(error => (
      console.error(error),
      process.exit(1)
    ))
    ```

## CLI usage

### Configuration file

`robusto.config.js` exports the object containing the options for the execution command starting a server. Detailed in [Options](#options) below.

### Execution command

`robusto` starts a server with the options contained in the object exported from the configuration file.

### Example

#### Configure

Create a configuration file named `robusto.config.js`:

```javascript
export default {
  port:8080,
  hostnames: ['machine'],
  mapSignname: signname => `../${signname}`,
  mapHostname: (hostname, pathname) => hostname,
  mapPathname: (pathname, hostname) => pathname
}
```

#### Execute

Run `robusto` via `package.json` start/test script:

```json
"scripts": {
  "start": "robusto"
}
```

## Options

-   `port`: A [`Number`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) specifies the port number to take.

-   `hostnames`: An [`Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) containing the hostnames to serve.

-   `mapSignname(filename)`: A [`Function`](https://developer.mozilla.org/en-US/docs/Glossary/Function) mapping paths to SSL files.

-   `mapHostname(hostname[, pathname])`: A [`Function`](https://developer.mozilla.org/en-US/docs/Glossary/Function) transforming request hostname according to the specified hostname and pathname.

-   `mapPathname(pathname[, hostname])`: A [`Function`](https://developer.mozilla.org/en-US/docs/Glossary/Function) transforming request pathname according to the specified hostname and pathname.

## Details

### Limitations

-   Directory listing is not supported.

### Requests

-   **Resulted paths** for file searchings are made up of the requested **hostnames** and **pathnames** according the transformations defined by `mapHostname` and `mapPathname` functions if defined.

-   Requested **hostnames** and **pathnames** are taken from incoming client requests.

-   Requested **hostnames** and **pathnames** are normalized by [`path.normalize`](https://nodejs.org/api/path.html#path_path_normalize_path) function.

-   Requested **hostnames** are decoded by [`punycode.toUnicode`](https://github.com/bestiejs/punycode.js/#punycodetounicodeinput) function.

-   Requested **pathnames** are decoded by [`decodeURIComponent`](https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/decodeURIComponent) function.

### Responses

-   File requests matching to directories and directory requests matching to files are redirected.

-   File requests are responded by the files available by the **resulted paths**.

-   Directory requests are responded by the files that are both acceptable according the order of acceptable MIME types of client's requests and found within the directories available by the **resulted paths**.

    -   Directory requests are responded by the files with the **basenames** defined as `index`.

    -   Directory requests are responded by the files with the **extensions** defined by [`mime.getExtension`](https://github.com/broofa/node-mime#mimegetextensiontype) function which receives the acceptable MIME types of client's requests.

-   Requests are responded by the MIME type defined by [`mime.getType`](https://github.com/broofa/node-mime#mimegettypepathorextension) function which receives the name of the found file.

### Assets

-   If the certificate file or any one of the key files is not found, the selfsigned certificate file and both key files will be regenerated via [node-forge](https://github.com/digitalbazaar/forge).

-   If any one of the root directories is not found, the empty one will be created.

### Features

-   Deflate, Gzip, Brotli are supported and provided by [zlib](https://nodejs.org/dist/latest-v12.x/docs/api/zlib.html).

## License

[MIT](https://github.com/stanislavzadiraev/sreamo/blob/master/LICENSE).
