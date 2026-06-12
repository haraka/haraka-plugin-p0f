# haraka-plugin-p0f

[![Test][ci-img]][ci-url] [![Cover][cov-img]][cov-url] [![Qlty][qlty-img]][qlty-url]

TCP Fingerprinting

Supply TCP fingerprint info (remote computer OS, network distance, etc) about the remote mail server. This can be used to implement more sophisticated anti-spam policies.

This plugin stores results with information deduced from the TCP fingerprint. The store typically includes at least the link, detail, distance, uptime, genre. Here's an example:

genre => FreeBSD
detail => 8.x (1)
uptime => 1390
link => ethernet/modem
distance => 17

Which was parsed from this p0f fingerprint:

24.18.227.2:39435 - FreeBSD 8.x (1) (up: 1390 hrs)
-> 208.75.177.101:25 (distance 17, link: ethernet/modem)

The following additional values may also be available in
the _p0f_ connection store:

    query, first_seen, last_seen, total_conn, uptime_min, up_mod_days, last_nat, last_chg, distance, bad_sw, os_match_q, os_name, os_flavor, http_name, http_flavor, link_type, and language.

## Configuration

1. start p0f

Create a startup script for p0f that creates a communication socket when your
server starts up.

    /usr/local/bin/p0f -u smtpd -d -s /tmp/.p0f_socket 'dst port 25 or dst port 587'
    chown smtpd /tmp/.p0f_socket

2. configure p0f plugin

add an entry to config/plugins to enable p0f:

    p0f

3. review settings in config/p0f.ini

At a minimum, `[main]socket_path` must be defined.

## Startup

In the contrib/ubuntu-upstart directory is a config file (p0f.conf) for Ubuntu.

In the contrib/bsd-rc.d directory is a startup file for FreeBSD.

<!-- leave these buried at the bottom of the document -->

[ci-img]: https://github.com/haraka/haraka-plugin-p0f/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/haraka/haraka-plugin-p0f/actions/workflows/ci.yml
[cov-img]: https://codecov.io/github/haraka/haraka-plugin-p0f/coverage.svg
[cov-url]: https://codecov.io/github/haraka/haraka-plugin-p0f
[qlty-img]: https://qlty.sh/gh/haraka/projects/haraka-plugin-p0f/maintainability.svg
[qlty-url]: https://qlty.sh/gh/haraka/projects/haraka-plugin-p0f
