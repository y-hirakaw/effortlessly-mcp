
import { JavaLSP } from '../build/services/lsp/java-lsp.js';
import { Logger } from '../build/utils/logger.js';

async function testJavaLSP() {
  try {
    console.log('🧪 Testing Java LSP auto-download functionality...');
    const logger = new Logger('test');
    
    const javaLsp = await JavaLSP.createWithAutoSetup({
      workspaceRoot: process.cwd(),
      logger: logger,
      autoInstall: true
    });
    
    console.log('✅ Java LSP created successfully');
    console.log('Server jar path:', javaLsp.serverJarPath || 'default');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testJavaLSP();

