# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/).

### Unreleased

### [1.0.10] - 2025-01-14

- automated code formatting with prettier
- doc: mv Changes.md CHANGELOG.md
- doc(CONTRIBUTORS): added
- populate [files] in package.json.
- deps: bump versions
- dep(eslint): upgrade to v9
- dep: eslint-plugin-haraka -> @haraka/eslint-config

### [1.0.9] - 2022-11-10

- fix connect path argument causing server crash when socket missing

### [1.0.8] - 2022-07-07

- ci: use .github test workflow
- ci: only publish when package.json changes
- Added systemd.service file (#25)

### [1.0.7] - 2022-06-05

- ci: update GHA workflow with shared
- doc(changes): add Unreleased marker
- ci: add submodule .release
- test: require mocha >= 9

### 1.0.6 - 2021-11-10

- bump eslint 6 -> 8

### 1.0.5 - 2020-12-30

- es6: use object shorthand
- update dep ipaddr.js version

### 1.0.4 - 2019-12-23

- update to es6 classes

### 1.0.3 - 2018-05-30

- add_header option visible at config

### 1.0.2 - 2017-09-11

- when socket_path is not configured, emit an error

### 1.0.1 - 2017-09-01

- repackaged as p0f, added contrib scripts, test release

### 1.0.0 - 2017-07-27

- import from Haraka

[1.0.7]: https://github.com/haraka/haraka-plugin-p0f/releases/tag/1.0.7
[1.0.8]: https://github.com/haraka/haraka-plugin-p0f/releases/tag/1.0.8
[1.0.10]: https://github.com/haraka/haraka-plugin-p0f/releases/tag/v1.0.10
[1.0.6]: https://github.com/haraka/haraka-plugin-p0f/releases/tag/1.0.6
[1.0.9]: https://github.com/haraka/haraka-plugin-p0f/releases/tag/1.0.9
