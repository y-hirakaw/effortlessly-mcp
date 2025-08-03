import esbuild from 'esbuild';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Read package.json to get version
const packageJson = JSON.parse(
  readFileSync(join(rootDir, 'package.json'), 'utf-8')
);

// Build configuration
const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'build/index.js',
  format: 'esm',
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
  define: {
    'process.env.VERSION': JSON.stringify(packageJson.version),
  },
  external: [
    '@modelcontextprotocol/sdk',
    'zod',
    'better-sqlite3',
    'js-yaml',
    'vscode-languageserver-protocol',
  ],
};

// Build function
async function build() {
  try {
    console.log('Building with esbuild...');
    
    const result = await esbuild.build(buildOptions);
    
    if (result.errors.length > 0) {
      console.error('Build errors:', result.errors);
      process.exit(1);
    }
    
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Run build
build();