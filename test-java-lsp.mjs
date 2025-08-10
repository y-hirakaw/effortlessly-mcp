import { JavaLSP } from './build/services/lsp/java-lsp.js';
import { Logger } from './build/services/logger.js';

async function testJavaLSP() {
  try {
    console.log('🧪 Testing Java LSP auto-download functionality...');
    const logger = new Logger('test');
    
    console.log('📁 Workspace root:', process.cwd() + '/test-java');
    
    const javaLsp = await JavaLSP.createWithAutoSetup({
      workspaceRoot: process.cwd() + '/test-java',
      logger: logger,
      autoInstall: true,
      serverJarPath: '/Users/y-hirakawa/git/effortlessly-mcp/.claude/workspace/effortlessly/lsp-servers/java/.claude/workspace/effortlessly/lsp-servers/java/plugins/org.eclipse.equinox.launcher_1.7.0.v20250519-0528.jar'
    });
    
    console.log('✅ Java LSP created successfully');
    console.log('📦 Server jar path:', javaLsp.serverJarPath || 'using default');
    
    // Try to connect to the LSP server  
    console.log('\n🚀 Connecting to LSP server...');
    await javaLsp.connect();
    
    // Wait for initialization and indexing
    console.log('⏳ Waiting for LSP server initialization...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📚 Waiting for project indexing to complete...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // プロジェクトインデックス化を待つ
    
    // Try to open one of the Java files to trigger indexing
    console.log('📂 Opening Java files to trigger indexing...');
    
    // Get Java files in the project
    const javaFiles = await javaLsp.findJavaFiles();
    console.log(`Found ${javaFiles.length} Java files:`, javaFiles.slice(0, 3));
    
    if (javaFiles.length > 0) {
      // Try to open UserService.java
      const userServiceFile = javaFiles.find(file => file.includes('UserService.java'));
      if (userServiceFile) {
        console.log(`🔄 Attempting to open: ${userServiceFile}`);
        // This would trigger LSP to process the file
      }
    }
    
    // Test multiple symbol searches
    console.log('\n🔍 Testing symbol search...');
    
    // Test 1: Search for UserService class
    console.log('\n1️⃣ Searching for "UserService"...');
    let symbols = await javaLsp.searchSymbols('UserService', { limit: 10 });
    console.log(`Found ${symbols.length} symbols for "UserService"`);
    symbols.forEach(symbol => {
      console.log(`  - ${symbol.name} (${symbol.kind}) at ${symbol.file}:${symbol.position.line}`);
    });
    
    // Test 2: Search for User class
    console.log('\n2️⃣ Searching for "User"...');
    symbols = await javaLsp.searchSymbols('User', { limit: 10 });
    console.log(`Found ${symbols.length} symbols for "User"`);
    symbols.forEach(symbol => {
      console.log(`  - ${symbol.name} (${symbol.kind}) at ${symbol.file}:${symbol.position.line}`);
    });
    
    // Test 3: Search for MathUtils class
    console.log('\n3️⃣ Searching for "MathUtils"...');
    symbols = await javaLsp.searchSymbols('MathUtils', { limit: 10 });
    console.log(`Found ${symbols.length} symbols for "MathUtils"`);
    symbols.forEach(symbol => {
      console.log(`  - ${symbol.name} (${symbol.kind}) at ${symbol.file}:${symbol.position.line}`);
    });
    
    // Test 4: General search
    console.log('\n4️⃣ Searching for "Demo"...');
    symbols = await javaLsp.searchSymbols('Demo', { limit: 10 });
    console.log(`Found ${symbols.length} symbols for "Demo"`);
    symbols.forEach(symbol => {
      console.log(`  - ${symbol.name} (${symbol.kind}) at ${symbol.file}:${symbol.position.line}`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testJavaLSP();