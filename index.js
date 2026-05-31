const http = require('node:http');
const { connect } = require('node:net');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const { Server, createWebSocketStream } = require('ws');
const { bin, install } = require('cloudflared');

const textDecoder = new TextDecoder();
const redirectLocation = 'https://newsnow.busiyi.world/';
const handshakeTimeoutMs = 10000;
const connectTimeoutMs = 15000;

function parseTarget(msg, offset) {
  if (msg.length < offset + 3) return null;

  const port = msg.readUInt16BE(offset);
  offset += 2;

  const addressType = msg[offset++];
  let host;

  if (addressType === 1) {
    if (msg.length < offset + 4) return null;
    host = `${msg[offset]}.${msg[offset + 1]}.${msg[offset + 2]}.${msg[offset + 3]}`;
    offset += 4;
  } else if (addressType === 2) {
    const length = msg[offset++];
    if (!length || msg.length < offset + length) return null;
    host = textDecoder.decode(msg.subarray(offset, offset + length));
    offset += length;
  } else if (addressType === 3) {
    if (msg.length < offset + 16) return null;

    const parts = new Array(8);
    for (let i = 0; i < 8; i += 1) {
      parts[i] = msg.readUInt16BE(offset + (i * 2)).toString(16);
    }

    host = parts.join(':');
    offset += 16;
  } else {
    return null;
  }

  return { host, port, offset };
}

function startTunnel(token) {
  const args = ['tunnel', '--protocol', 'http2', 'run', '--token', token];

  if (!fs.existsSync(bin)) {
    install(bin).then(() => {
      console.log('installed tunnel');
      spawn(bin, args, { stdio: 'inherit' });
    }).catch(error => {
      console.log('tunnel install failed', error);
    });

    return;
  }

  spawn(bin, args, { stdio: 'inherit' });
}

function run(config) {
  if (!config.port) {
    console.error('port?');
    return;
  }

  const expectedUuid = config.uuid ? config.uuid.replace(/-/g, '').toLowerCase() : null;

  const httpServer = http.createServer((req, res) => {
    res.writeHead(302, { Location: redirectLocation });
    res.end();
  });

  httpServer.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);

    if (config.token) {
      console.log('starting tunnel...');
      startTunnel(config.token);
    }
  });

  const wss = new Server({ noServer: true, path: config.path || null });

  wss.on('connection', ws => {
    const handshakeTimer = setTimeout(() => {
      ws.close();
    }, handshakeTimeoutMs);

    ws.once('message', msg => {
      clearTimeout(handshakeTimer);

      if (!Buffer.isBuffer(msg)) msg = Buffer.from(msg);

      if (msg.length < 19) {
        ws.close();
        return;
      }

      const version = msg[0];

      if (expectedUuid && msg.subarray(1, 17).toString('hex') !== expectedUuid) {
        ws.close();
        return;
      }

      const target = parseTarget(msg, msg[17] + 19);

      if (!target) {
        ws.close();
        return;
      }

      ws.send(Buffer.from([version, 0]));

      const duplex = createWebSocketStream(ws);
      const remote = connect({ host: target.host, port: target.port }, function () {
        this.setTimeout(0);
        this.setNoDelay(true);
        this.write(msg.subarray(target.offset));
        duplex.pipe(this).pipe(duplex);
      });

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;

        ws.removeListener('close', cleanup);
        duplex.removeListener('error', cleanup);
        remote.removeListener('error', cleanup);
        remote.removeListener('timeout', cleanup);
        remote.removeListener('close', cleanup);

        remote.destroy();
        duplex.destroy();
      };

      remote.setTimeout(connectTimeoutMs, cleanup);
      ws.once('close', cleanup);
      duplex.once('error', cleanup);
      remote.once('error', cleanup);
      remote.once('timeout', cleanup);
      remote.once('close', cleanup);
    });

    ws.once('close', () => {
      clearTimeout(handshakeTimer);
    });
  });

  httpServer.on('upgrade', (request, socket, head) => {
    if ((request.headers.upgrade || '').toLowerCase() !== 'websocket') {
      socket.end('HTTP/1.1 400 Bad Request');
      return;
    }

    wss.handleUpgrade(request, socket, head, ws => {
      wss.emit('connection', ws, request);
    });
  });
}

process.on('uncaughtException', error => {
  console.log(error);
});

process.on('unhandledRejection', error => {
  console.log(error);
});

run({
  port: process.env.PORT || 8080,
  uuid: process.env.UUID || 'f65c45c4-08c0-49f4-a2bf-aed46e0c008a',
  token: process.env.TOKEN || '',
});
