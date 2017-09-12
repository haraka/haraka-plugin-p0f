[![Build Status][ci-img]][ci-url]
[![Code Climate][clim-img]][clim-url]
[![Greenkeeper badge][gk-img]][gk-url]
[![Windows Build Status][ci-win-img]][ci-win-url]
[![NPM][npm-img]][npm-url]

# haraka-plugin-p0f

TCP Fingerprinting

Use TCP fingerprint info (remote computer OS, network distance, etc) to
implement more sophisticated anti-spam policies.

This plugin inserts a _p0f_ connection note with information deduced
from the TCP fingerprint. The note typically includes at least the link,
detail, distance, uptime, genre. Here's an example:

 genre    => FreeBSD
 detail   => 8.x (1)
 uptime   => 1390
 link     => ethernet/modem
 distance => 17

Which was parsed from this p0f fingerprint:

  24.18.227.2:39435 - FreeBSD 8.x (1) (up: 1390 hrs)
    -> 208.75.177.101:25 (distance 17, link: ethernet/modem)

The following additional values may also be available in
the _p0f_ connection note:

    magic, status, first_seen, last_seen, total_conn, uptime_min, up_mod_days, last_nat, last_chg, distance, bad_sw, os_match_q, os_name, os_flavor, http_name, http_flavor, link_type, and language.


Configuration
-----------------

1. start p0f

Create a startup script for p0f that creates a communication socket when your
server starts up.

    /usr/local/bin/p0f -u smtpd -d -s /tmp/.p0f_socket 'dst port 25 or dst port 587'
    chown smtpd /tmp/.p0f_socket

2. configure p0f plugin

add an entry to config/plugins to enable p0f:

    p0f


3. review settings in config/p0f.ini

At a minimum, [main]socket_path must be defined.

## Startup

In the contrib/ubuntu-upstart directory is a config file (p0f.conf) for Ubuntu.

In the contrib/bsd-rc.d directory is a startup file for FreeBSD.


<!-- leave these buried at the bottom of the document -->
[ci-img]: https://travis-ci.org/haraka/haraka-plugin-p0f.svg
[ci-url]: https://travis-ci.org/haraka/haraka-plugin-p0f
[ci-win-img]: https://ci.appveyor.com/api/projects/status/eh4or0tpwldv2fx7?svg=true
[ci-win-url]: https://ci.appveyor.com/project/msimerson/haraka-plugin-p0f
[cov-img]: https://codecov.io/github/haraka/haraka-plugin-p0f/coverage.svg
[cov-url]: https://codecov.io/github/haraka/haraka-plugin-p0f
[clim-img]: https://codeclimate.com/github/haraka/haraka-plugin-p0f/badges/gpa.svg
[clim-url]: https://codeclimate.com/github/haraka/haraka-plugin-p0f
[gk-img]: https://badges.greenkeeper.io/haraka/haraka-plugin-p0f.svg
[gk-url]: https://greenkeeper.io/
[npm-img]: https://nodei.co/npm/haraka-plugin-p0f.png
[npm-url]: https://www.npmjs.com/package/haraka-plugin-p0f
