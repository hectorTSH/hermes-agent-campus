import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const staticDirs = ['rooms', 'schemas', 'examples'];

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

export default {
  preview: {
    allowedHosts: true
  },
  plugins: [campusStaticJson()]
};
