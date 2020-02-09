export default {
  port: 8888,
  hostnames: ['localhost'],
  mapSignname: signname =>
    './test/' + signname,
  mapHostname: (hostname, pathname) =>
    hostname === 'localhost' && './test/dst/' ||
    hostname,
  //mapPathname: (pathname, hostname) =>
  //pathname
}