import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '3000', '--host', '127.0.0.1', '--strictPort'], {
  stdio: 'inherit', env: { ...process.env, LEDGER_LOCAL_PREVIEW: 'true' },
});
child.on('exit', code => process.exit(code ?? 1));
