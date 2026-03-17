// node.js built-in modules
const assert = require('node:assert')
const sinon = require('sinon')

// plugin module (for P0FClient access)
const { P0FClient } = require('../index.js')

// npm modules
const fixtures = require('haraka-test-fixtures')

beforeEach(function () {
  this.plugin = new fixtures.plugin('p0f')
  this.connection = new fixtures.connection.createConnection()
  this.connection.init_transaction()

  // replace vm-compiled functions with instrumented versions for coverage tracking
  if (process.env.HARAKA_COVERAGE) {
    const plugin_module = require('../index.js')
    Object.assign(this.plugin, plugin_module)
  }

  this.plugin.register()

  this.next = sinon.stub()
})

afterEach(sinon.restore)

describe('p0f', function () {
  it('loads', function () {
    assert.ok(this.plugin)
  })
})

describe('register', function () {
  it('should have register function', function () {
    const load_p0f_ini_spy = sinon.spy(this.plugin, 'load_p0f_ini')

    assert.strictEqual('function', typeof this.plugin.register)

    this.plugin.register()

    assert.ok(this.plugin.register_hook.called)
    assert.ok(load_p0f_ini_spy.calledOnce)
  })

  it('registers hooks', function () {
    let hook_count = 0
    assert.strictEqual(this.plugin.register_hook.args[hook_count++][1], 'start_p0f_client')
    assert.strictEqual(this.plugin.register_hook.args[hook_count++][1], 'start_p0f_client')
    assert.strictEqual(this.plugin.register_hook.args[hook_count++][1], 'query_p0f')
    assert.strictEqual(this.plugin.register_hook.args[hook_count++][1], 'add_p0f_header')

    assert.strictEqual(this.plugin.register_hook.args.length, hook_count)
  })
})

describe('load_p0f_ini', function () {
  it('loads p0f.ini from config/p0f.ini', function () {
    this.plugin.load_p0f_ini()
    assert.ok(this.plugin.cfg)
    assert.ok(this.plugin.cfg.main)
  })
})

describe('start_p0f_client', function () {
  let next, server

  beforeEach(function () {
    next = sinon.spy()

    server = {
      logerror: sinon.stub(),
      notes: {},
    }
  })

  it('will return if missing socket_path', function () {
    this.plugin.start_p0f_client(next, server)

    sinon.assert.calledOnce(next)
    sinon.assert.calledWith(next)
  })
})

describe('query_p0f', function () {
  it('ignores private IPs', async function () {
    this.connection.remote = { is_private: true }

    await this.plugin.query_p0f(this.next, this.connection)

    sinon.assert.calledOnceWithExactly(this.next)
  })

  it('calls next if p0f client is missing', async function () {
    this.connection.remote.is_private = false
    this.connection.server.notes = {}

    await this.plugin.query_p0f(this.next, this.connection)

    sinon.assert.calledOnceWithExactly(this.next)
  })

  it('stores error result when p0f query fails', async function () {
    this.connection.remote.is_private = false
    this.connection.server.notes = {
      p0f_client: { query: sinon.stub().callsFake((_ip, cb) => cb(new Error('connection refused'))) },
    }

    await this.plugin.query_p0f(this.next, this.connection)

    const result = this.connection.results.get('p0f')
    assert.ok(result.err)
    sinon.assert.calledOnceWithExactly(this.next)
  })

  it('stores error result when p0f returns no match', async function () {
    this.connection.remote.is_private = false
    this.connection.server.notes = {
      p0f_client: { query: sinon.stub().callsFake((_ip, cb) => cb(null, null)) },
    }

    await this.plugin.query_p0f(this.next, this.connection)

    const result = this.connection.results.get('p0f')
    assert.ok(result.err)
    sinon.assert.calledOnceWithExactly(this.next)
  })

  it('stores p0f result on success', async function () {
    this.connection.remote.is_private = false
    this.connection.remote.ip = '1.2.3.4'
    this.connection.server.notes = {
      p0f_client: {
        query: sinon
          .stub()
          .callsFake((_ip, cb) =>
            cb(null, {
              os_name: 'Linux',
              os_flavor: '3.x',
              link_type: 'Ethernet',
              distance: 2,
              total_conn: 10,
              last_nat: 0,
            }),
          ),
      },
    }

    await this.plugin.query_p0f(this.next, this.connection)

    const result = this.connection.results.get('p0f')
    assert.strictEqual(result.os_name, 'Linux')
    sinon.assert.calledOnceWithExactly(this.next)
  })
})

describe('add_p0f_header', function () {
  let logdebug_spy, remove_header_spy

  beforeEach(function () {
    this.connection.results.add({ name: 'p0f' }, { os_name: 'BeOS', os_flavor: 'forever' })

    logdebug_spy = sinon.spy(this.connection, 'logdebug')
    remove_header_spy = sinon.spy(this.connection.transaction, 'remove_header')
  })

  it('ignores private IPs', async function () {
    this.connection.remote.is_private = true

    await this.plugin.add_p0f_header(this.next, this.connection)

    sinon.assert.calledOnceWithExactly(this.next)
    sinon.assert.notCalled(logdebug_spy)
    sinon.assert.notCalled(remove_header_spy)
  })

  it('skips adding a header', async function () {
    await this.plugin.add_p0f_header(this.next, this.connection)

    sinon.assert.calledOnceWithExactly(logdebug_spy, this.plugin, 'header disabled in ini')
    sinon.assert.calledOnceWithExactly(this.next)
  })

  it('adds a header when data exists', async function () {
    this.plugin.cfg.main.add_header = 'X-p0f-Result'

    await this.plugin.add_p0f_header(this.next, this.connection)

    sinon.assert.calledOnceWithExactly(remove_header_spy, 'X-p0f-Result')
    sinon.assert.calledOnceWithExactly(this.next)
    assert.equal(this.connection.transaction.header.get('X-p0f-Result'), `os="BeOS forever"`)
  })

  it('records error when result exists but has no os_name', async function () {
    this.plugin.cfg.main.add_header = 'X-p0f-Result'

    // Use a fresh connection so the beforeEach os_name doesn't bleed in
    const conn = fixtures.connection.createConnection()
    conn.init_transaction()
    conn.results.add({ name: 'p0f' }, { link_type: 'Ethernet' })

    await this.plugin.add_p0f_header(this.next, conn)

    sinon.assert.calledOnceWithExactly(this.next)
    //assert.equal(this.connection.transaction.header.headers['x-p0f-result'], undefined)
    assert.ok(conn.results.has(this.plugin, 'err', 'no p0f note'))
    assert.equal(this.connection.transaction.header.get('X-p0f-Result').length, 0)
  })
})

describe('P0FClient.decode_response', function () {
  function makeOkBuffer({ os_name = '', os_flavor = '' } = {}) {
    const buf = Buffer.alloc(232, 0)
    buf.writeUInt32LE(0x50304602, 0) // response magic
    buf.writeUInt32LE(0x10, 4) // status OK
    buf.write(os_name, 40, 32, 'ascii')
    buf.write(os_flavor, 72, 32, 'ascii')
    return buf
  }

  beforeEach(function () {
    const net = require('node:net')
    const EventEmitter = require('node:events').EventEmitter
    const fakeSock = new EventEmitter()
    fakeSock.setTimeout = sinon.stub()
    fakeSock.write = sinon.stub().returns(true)
    fakeSock.destroy = sinon.stub()
    sinon.stub(net, 'createConnection').returns(fakeSock)

    this.client = new P0FClient('/tmp/fake.sock')
  })

  it('throws when receive_queue is empty', function () {
    const buf = makeOkBuffer()
    assert.throws(() => this.client.decode_response(buf), /unexpected data received/)
  })

  it('returns error on bad magic', function (done) {
    this.client.receive_queue.push({
      ip: '1.2.3.4',
      cb: (err) => {
        assert.ok(err)
        assert.ok(/bad response magic/.test(err.message))
        done()
      },
    })

    const buf = Buffer.alloc(232, 0)
    buf.writeUInt32LE(0xdeadbeef, 0)
    buf.writeUInt32LE(0x10, 4)
    this.client.decode_response(buf)
  })

  it('returns error on bad query status (0x00)', function (done) {
    this.client.receive_queue.push({
      ip: '1.2.3.4',
      cb: (err) => {
        assert.ok(err)
        assert.ok(/bad query/.test(err.message))
        done()
      },
    })

    const buf = Buffer.alloc(232, 0)
    buf.writeUInt32LE(0x50304602, 0)
    buf.writeUInt32LE(0x00, 4)
    this.client.decode_response(buf)
  })

  it('returns null on no-match status (0x20)', function (done) {
    this.client.receive_queue.push({
      ip: '1.2.3.4',
      cb: (err, result) => {
        assert.equal(err, null)
        assert.equal(result, null)
        done()
      },
    })

    const buf = Buffer.alloc(232, 0)
    buf.writeUInt32LE(0x50304602, 0)
    buf.writeUInt32LE(0x20, 4)
    this.client.decode_response(buf)
  })

  it('decodes OS name and flavor on OK status (0x10)', function (done) {
    this.client.receive_queue.push({
      ip: '1.2.3.4',
      cb: (err, result) => {
        assert.equal(err, null)
        assert.strictEqual(result.os_name, 'Linux')
        assert.strictEqual(result.os_flavor, '3.x')
        assert.strictEqual(result.query, '1.2.3.4')
        done()
      },
    })

    this.client.decode_response(makeOkBuffer({ os_name: 'Linux', os_flavor: '3.x' }))
  })

  it('throws on unknown status code', function () {
    this.client.receive_queue.push({ ip: '1.2.3.4', cb: sinon.stub() })

    const buf = Buffer.alloc(232, 0)
    buf.writeUInt32LE(0x50304602, 0)
    buf.writeUInt32LE(0xff, 4)
    assert.throws(() => this.client.decode_response(buf), /unknown status/)
  })
})

describe('P0FClient.query', function () {
  beforeEach(function () {
    const net = require('node:net')
    const EventEmitter = require('node:events').EventEmitter
    const fakeSock = new EventEmitter()
    fakeSock.setTimeout = sinon.stub()
    fakeSock.write = sinon.stub().returns(true)
    fakeSock.destroy = sinon.stub()
    sinon.stub(net, 'createConnection').returns(fakeSock)

    this.client = new P0FClient('/tmp/fake.sock')
    this.client.connected = true
    this.client.ready = true
  })

  it('calls cb with error when socket has error', function (done) {
    const socketErr = new Error('broken pipe')
    this.client.socket_has_error = socketErr

    this.client.query('1.2.3.4', (err) => {
      assert.strictEqual(err, socketErr)
      done()
    })
  })

  it('calls cb with error when not connected', function (done) {
    this.client.connected = false

    this.client.query('1.2.3.4', (err) => {
      assert.ok(err)
      assert.ok(/not connected/.test(err.message))
      done()
    })
  })

  it('queues request to send_queue when socket not ready', function () {
    this.client.ready = false

    this.client.query('1.2.3.4', sinon.stub())

    assert.strictEqual(this.client.send_queue.length, 1)
    assert.strictEqual(this.client.send_queue[0].ip, '1.2.3.4')
  })

  it('pushes to receive_queue and writes socket when ready', function () {
    this.client.query('1.2.3.4', sinon.stub())

    assert.strictEqual(this.client.receive_queue.length, 1)
    assert.strictEqual(this.client.receive_queue[0].ip, '1.2.3.4')
  })
})
