import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const staticDirs = ['rooms', 'schemas', 'examples'];

export function isLoopbackAddress(value = '') {
  const address = String(value).split('%')[0];
  const normalized = address.startsWith('::ffff:') ? address.slice(7) : address;
  return normalized === '::1' || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

function campusStaticJson() {
  const mime = {
    '.json': 'application/json; charset=utf-8',
    '.yaml': 'text/yaml; charset=utf-8',
    '.yml': 'text/yaml; charset=utf-8'
  };

  function sendFile(req, res, next) {
    const url = decodeURIComponent((req.url || '').split('?')[0]);
    const dir = staticDirs.find((name) => url === `/${name}` || url.startsWith(`/${name}/`));
    if (!dir) return next();
    const file = path.resolve(root, url.slice(1));
    if (!file.startsWith(path.resolve(root, dir) + path.sep) && file !== path.resolve(root, dir)) {
      return next();
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
    res.statusCode = 200;
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(file).pipe(res);
  }

  return {
    name: 'campus-static-json',
    configureServer(server) {
      server.middlewares.use(sendFile);
    },
    configurePreviewServer(server) {
      server.middlewares.use(sendFile);
    },
    closeBundle() {
      for (const dir of staticDirs) {
        const from = path.join(root, dir);
        if (fs.existsSync(from)) fs.cpSync(from, path.join(root, 'dist', dir), {recursive: true});
      }
    }
  };
}

function campusLiveState() {
  const script = path.join(root, 'scripts', 'live_state.py');
  const allowed = new Set(['home', 'tsh', 'folio-work-kits', 'midas', 'wanderpick', 'agent-staff']);
  const cache = new Map();

  function sendState(req, res, next) {
    const parsed = new URL(req.url || '/', 'http://campus.local');
    if (parsed.pathname !== '/api/campus-state') return next();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (!isLoopbackAddress(req.socket?.remoteAddress)) {
      res.statusCode = 403;
      res.end(JSON.stringify({connected: false, error: 'Local adapter is available only from this Mac'}));
      return;
    }
    if (process.env.CAMPUS_LIVE_ADAPTER === '0') {
      res.statusCode = 503;
      res.end(JSON.stringify({connected: false, error: 'Local adapter disabled'}));
      return;
    }
    const room = parsed.searchParams.get('room') || '';
    if (!allowed.has(room)) {
      res.statusCode = 400;
      res.end(JSON.stringify({connected: false, error: 'Unknown room'}));
      return;
    }
    const hit = cache.get(room);
    if (hit && Date.now() - hit.at < 900) {
      res.statusCode = 200;
      res.end(hit.body);
      return;
    }
    execFile('python3', [script, '--room', room], {
      cwd: root,
      timeout: 2500,
      maxBuffer: 1024 * 1024,
      env: process.env
    }, (error, stdout) => {
      if (error) {
        res.statusCode = 503;
        res.end(JSON.stringify({connected: false, error: 'Local adapter unavailable'}));
        return;
      }
      try {
        const body = JSON.stringify(JSON.parse(stdout));
        cache.set(room, {at: Date.now(), body});
        res.statusCode = 200;
        res.end(body);
      } catch {
        res.statusCode = 503;
        res.end(JSON.stringify({connected: false, error: 'Invalid adapter response'}));
      }
    });
  }

  return {
    name: 'campus-live-state',
    configureServer(server) {
      server.middlewares.use(sendState);
    },
    configurePreviewServer(server) {
      server.middlewares.use(sendState);
    }
  };
}

export default {
  preview: {
    allowedHosts: ['localhost', '.local', '.ts.net']
  },
  plugins: [campusLiveState(), campusStaticJson()]
};
