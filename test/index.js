const assert = require('node:assert')
const { describe, it, beforeEach, afterEach } = require('node:test')

// npm modules
const { makeConnection, makePlugin } = require('haraka-test-fixtures')
const sinon = require('sinon')

const { P0FClient } = require('../index.js')

function stubNetConnection() {
  const net = require('node:net')
  const EventEmitter = require('node:events').EventEmitter
  const fakeSock = new EventEmitter()
  fakeSock.setTimeout = sinon.stub()
  fakeSock.write = sinon.stub().returns(true)
  fakeSock.destroy = sinon.stub()
  sinon.stub(net, 'createConnection').returns(fakeSock)
  return fakeSock
}

// a valid 232-byte p0f v3 "OK" (0x10) response
function okResponse(osName = 'Linux', flavor = '3.x') {
  const b = Buffer.alloc(232)
  b.writeUInt32LE(0x50304602, 0) // response magic
  b.writeUInt32LE(0x10, 4) // status OK
  b.writeUInt32LE(42, 16) // total_conn
  b.write(osName, 40)
  b.write(flavor, 72)
  return b
}

let plugin, connection, next

beforeEach(() => {
  plugin = makePlugin('p0f')
  connection = makeConnection({ withTxn: true })
  next = sinon.spy()
})

afterEach(() => sinon.restore())

describe('p0f', () => {
  it('loads', () => {
    assert.ok(plugin)
  })

  it('registers', () => {
    const load_p0f_ini_spy = sinon.spy(plugin, 'load_p0f_ini')
    assert.strictEqual('function', typeof plugin.register)

    plugin.register()

    assert.ok(load_p0f_ini_spy.calledOnce)
  })

  it('registers hooks', () => {
    assert.deepStrictEqual(plugin.hooks.init_master, ['start_p0f_client'])
    assert.deepStrictEqual(plugin.hooks.init_child, ['start_p0f_client'])
    assert.deepStrictEqual(plugin.hooks.lookup_rdns, ['query_p0f'])
    assert.deepStrictEqual(plugin.hooks.data_post, ['add_p0f_header'])
  })
})

describe('load_p0f_ini', () => {
  it('loads p0f.ini from config/p0f.ini', () => {
    plugin.load_p0f_ini()
    assert.ok(plugin.cfg)
    assert.ok(plugin.cfg.main)
  })
})

describe('start_p0f_client', () => {
  let next, server

  beforeEach(() => {
    next = sinon.spy()

    server = {
      logerror: sinon.stub(),
      notes: {},
    }
  })

  it('will return if missing socket_path', () => {
    plugin.start_p0f_client(next, server)

    sinon.assert.calledOnce(next)
  })
})

describe('query_p0f', () => {
  beforeEach(() => {
    connection.remote.is_private = false
    connection.remote.ip = '1.2.3.4'
    connection.server.notes = {}
  })

  it('ignores private IPs', async () => {
    connection.remote = { is_private: true }

    await plugin.query_p0f(next, connection)

    sinon.assert.calledOnceWithExactly(next)
  })

  it('calls next if p0f client is missing', async () => {
    await plugin.query_p0f(next, connection)

    sinon.assert.calledOnceWithExactly(next)
  })

  it('stores error result when p0f query fails', async () => {
    connection.server.notes = {
      p0f_client: { query: sinon.stub().callsFake((_ip, cb) => cb(new Error('connection refused'))) },
    }

    await plugin.query_p0f(next, connection)

    const result = connection.results.get('p0f')
    assert.ok(result.err)
    sinon.assert.calledOnceWithExactly(next)
  })

  it('stores error result when p0f returns no match', async () => {
    connection.server.notes = {
      p0f_client: { query: sinon.stub().callsFake((_ip, cb) => cb(null, null)) },
    }

    await plugin.query_p0f(next, connection)

    const result = connection.results.get('p0f')
    assert.ok(result.err)
    sinon.assert.calledOnceWithExactly(next)
  })

  it('stores p0f result on success', async () => {
    connection.server.notes = {
      p0f_client: {
        query: sinon.stub().callsFake((_ip, cb) =>
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

    await plugin.query_p0f(next, connection)

    const result = connection.results.get('p0f')
    assert.strictEqual(result.os_name, 'Linux')
    sinon.assert.calledOnceWithExactly(next)
  })
})

describe('add_p0f_header', () => {
  let logdebug_spy, remove_header_spy

  beforeEach(() => {
    connection.results.add({ name: 'p0f' }, { os_name: 'BeOS', os_flavor: 'forever' })

    logdebug_spy = sinon.spy(connection, 'logdebug')
    remove_header_spy = sinon.spy(connection.transaction, 'remove_header')
  })

  it('ignores private IPs', async () => {
    connection.remote.is_private = true

    await plugin.add_p0f_header(next, connection)

    sinon.assert.calledOnceWithExactly(next)
    sinon.assert.notCalled(logdebug_spy)
    sinon.assert.notCalled(remove_header_spy)
  })

  it('skips adding a header', async () => {
    await plugin.add_p0f_header(next, connection)

    sinon.assert.calledOnceWithExactly(logdebug_spy, plugin, 'header disabled in ini')
    sinon.assert.calledOnceWithExactly(next)
  })

  it('adds a header when data exists', async () => {
    plugin.cfg.main.add_header = 'X-p0f-Result'

    await plugin.add_p0f_header(next, connection)

    sinon.assert.calledOnceWithExactly(remove_header_spy, 'X-p0f-Result')
    sinon.assert.calledOnceWithExactly(next)
    assert.equal(connection.transaction.header.get('X-p0f-Result'), `os="BeOS forever"`)
  })

  it('records error when result exists but has no os_name', async () => {
    plugin.cfg.main.add_header = 'X-p0f-Result'

    // Use a fresh connection so the beforeEach os_name doesn't bleed in
    const conn = makeConnection({ withTxn: true })
    conn.results.add({ name: 'p0f' }, { link_type: 'Ethernet' })

    await plugin.add_p0f_header(next, conn)

    sinon.assert.calledOnceWithExactly(next)
    //assert.equal(this.connection.transaction.header.headers['x-p0f-result'], undefined)
    assert.ok(conn.results.has(plugin, 'err', 'no p0f note'))
    assert.equal(conn.transaction.header.get('X-p0f-Result').length, 0)
  })
})

describe('P0FClient.decode_response', () => {
  function makeOkBuffer({ os_name = '', os_flavor = '' } = {}) {
    const buf = Buffer.alloc(232, 0)
    buf.writeUInt32LE(0x50304602, 0) // response magic
    buf.writeUInt32LE(0x10, 4) // status OK
    buf.write(os_name, 40, 32, 'ascii')
    buf.write(os_flavor, 72, 32, 'ascii')
    return buf
  }

  let client

  beforeEach(() => {
    stubNetConnection()
    client = new P0FClient('/tmp/fake.sock')
  })

  it('throws when receive_queue is empty', () => {
    const buf = makeOkBuffer()
    assert.throws(() => client.decode_response(buf), /unexpected data received/)
  })

  it('returns error on bad magic', (t, done) => {
    client.receive_queue.push({
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
    client.decode_response(buf)
  })

  it('returns error on bad query status (0x00)', (t, done) => {
    client.receive_queue.push({
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
    client.decode_response(buf)
  })

  it('returns null on no-match status (0x20)', (t, done) => {
    client.receive_queue.push({
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
    client.decode_response(buf)
  })

  it('decodes OS name and flavor on OK status (0x10)', (t, done) => {
    client.receive_queue.push({
      ip: '1.2.3.4',
      cb: (err, result) => {
        assert.equal(err, null)
        assert.strictEqual(result.os_name, 'Linux')
        assert.strictEqual(result.os_flavor, '3.x')
        assert.strictEqual(result.query, '1.2.3.4')
        done()
      },
    })

    client.decode_response(makeOkBuffer({ os_name: 'Linux', os_flavor: '3.x' }))
  })

  it('throws on unknown status code', () => {
    client.receive_queue.push({ ip: '1.2.3.4', cb: sinon.stub() })

    const buf = Buffer.alloc(232, 0)
    buf.writeUInt32LE(0x50304602, 0)
    buf.writeUInt32LE(0xff, 4)
    assert.throws(() => client.decode_response(buf), /unknown status/)
  })

  it('reassembles a response split across two TCP chunks', (t, done) => {
    client.receive_queue.push({
      ip: '1.2.3.4',
      cb: (err, p0f) => {
        assert.equal(err, null)
        assert.equal(p0f.os_name, 'Linux')
        done()
      },
    })
    const frame = makeOkBuffer({ os_name: 'Linux', os_flavor: '3.x' })
    // simulate the kernel handing us the frame in two pieces
    client.sock.emit('data', frame.subarray(0, 100))
    client.sock.emit('data', frame.subarray(100))
  })

  it('catches parse error without crashing and surfaces to caller', (t, done) => {
    client.receive_queue.push({
      ip: '1.2.3.4',
      cb: (err) => {
        assert.ok(err)
        done()
      },
    })
    const bad = Buffer.alloc(232, 0xff)
    client.sock.emit('data', bad)
  })
})

describe('P0FClient.query', () => {
  let client

  beforeEach(() => {
    stubNetConnection()
    client = new P0FClient('/tmp/fake.sock')
    client.connected = true
    client.ready = true
  })

  it('calls cb with error when socket has error', (t, done) => {
    const socketErr = new Error('broken pipe')
    client.socket_has_error = socketErr

    client.query('1.2.3.4', (err) => {
      assert.strictEqual(err, socketErr)
      done()
    })
  })

  it('queues the request when not yet connected (C2)', () => {
    client.connected = false
    client.ready = false

    client.query('1.2.3.4', sinon.stub())

    assert.strictEqual(client.send_queue.length, 1)
    assert.strictEqual(client.send_queue[0].ip, '1.2.3.4')
    assert.strictEqual(client.receive_queue.length, 0)
  })

  it('queues request to send_queue when socket not ready', () => {
    client.ready = false

    client.query('1.2.3.4', sinon.stub())

    assert.strictEqual(client.send_queue.length, 1)
    assert.strictEqual(client.send_queue[0].ip, '1.2.3.4')
  })

  it('pushes to receive_queue and writes socket when ready', () => {
    client.query('1.2.3.4', sinon.stub())

    assert.strictEqual(client.receive_queue.length, 1)
    assert.strictEqual(client.receive_queue[0].ip, '1.2.3.4')
  })
})

describe('P0FClient lifecycle', () => {
  let sock
  let client

  beforeEach(() => {
    sock = stubNetConnection()
    client = new P0FClient('/tmp/fake.sock')
  })

  afterEach(() => client.shutdown())

  it("'connect' marks ready and drains the send queue", () => {
    // connected but not yet ready -> request lands in send_queue
    client.connected = true
    client.ready = false
    client.query('8.8.8.8', sinon.stub())
    assert.equal(client.send_queue.length, 1)

    sock.emit('connect')

    assert.equal(client.connected, true)
    assert.equal(client.ready, true)
    assert.equal(client.send_queue.length, 0) // flushed
    assert.equal(client.receive_queue.length, 1)
  })

  it("'data' decodes a response and invokes the queued cb", (t, done) => {
    sock.emit('connect')
    client.query('8.8.8.8', (err, res) => {
      assert.ifError(err)
      assert.equal(res.os_name, 'Linux')
      assert.equal(res.total_conn, 42)
      done()
    })
    sock.emit('data', okResponse('Linux'))
  })

  it("'data' splits multiple 232-byte records", () => {
    sock.emit('connect')
    const cbs = [sinon.stub(), sinon.stub()]
    client.query('1.1.1.1', cbs[0])
    client.query('2.2.2.2', cbs[1])
    sock.emit('data', Buffer.concat([okResponse('A'), okResponse('B')]))
    assert.ok(cbs[0].calledOnce)
    assert.ok(cbs[1].calledOnce)
  })

  it("'drain' re-readies and processes the queue", () => {
    sock.emit('connect')
    client.ready = false
    sock.emit('drain')
    assert.equal(client.ready, true)
  })

  it("'error' fails queued requests and schedules a reconnect", (t, done) => {
    sock.emit('connect')
    client.receive_queue.push({
      ip: '9.9.9.9',
      cb: (err) => {
        assert.ok(err)
        assert.match(err.message, /socket: \/tmp\/fake\.sock/)
        assert.ok(client.restart_interval) // reconnect scheduled
        done()
      },
    })
    sock.emit('error', new Error('ECONNRESET'))
    assert.equal(client.connected, false)
  })

  it('process_send_queue fails queued items when socket has error', () => {
    const cb = sinon.stub()
    client.socket_has_error = new Error('dead')
    client.send_queue.push({ ip: '5.5.5.5', cb, buf: Buffer.alloc(21) })
    client.process_send_queue()
    assert.ok(cb.calledOnceWith(client.socket_has_error))
  })
})

describe('start_p0f_client', () => {
  afterEach(() => sinon.restore())

  it('creates a P0FClient when socket_path is configured', () => {
    stubNetConnection()
    plugin.cfg.main.socket_path = '/tmp/p0f.sock'
    const server = { notes: {}, logerror: sinon.stub() }
    const nextSpy = sinon.spy()
    plugin.start_p0f_client(nextSpy, server)
    assert.ok(server.notes.p0f_client instanceof P0FClient)
    assert.ok(nextSpy.calledOnce)
    server.notes.p0f_client.shutdown()
  })
})
