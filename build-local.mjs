import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import ts from 'typescript';
import { existsSync, realpathSync, mkdirSync, copyFileSync, cpSync } from 'node:fs';

// In-process TypeScript compilation avoids the external esbuild helper.
await build({
  configFile: false,
  esbuild: false,
  resolve: { preserveSymlinks: true },
  plugins: [
    { name: 'resolve-local-packages', enforce: 'pre', async resolveId(source, importer, options) {
      if (source.startsWith('\0')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved && existsSync(resolved.id)) return { ...resolved, id: realpathSync(resolved.id).replaceAll('\\', '/') };
      return resolved;
    } },
    { name: 'local-typescript', enforce: 'pre', transform(source, id) {
      if (!/\.[jt]sx?(?:\?|$)/.test(id)) return null;
      source = source.replaceAll('process.env.NODE_ENV', '"production"');
      if (id.includes('node_modules')) return { code: source, map: null };
      return { code: ts.transpileModule(source, { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
      }, fileName: id }).outputText, map: null };
    } },
    tailwindcss(),
  ],
  build: { outDir: 'dist/client', target: 'esnext', minify: false, cssMinify: false },
});

mkdirSync('dist/server', { recursive: true });
copyFileSync('server/worker.mjs', 'dist/server/index.js');
mkdirSync('dist/.openai', { recursive: true });
copyFileSync('.openai/hosting.json', 'dist/.openai/hosting.json');
cpSync('drizzle', 'dist/.openai/drizzle', { recursive: true });
