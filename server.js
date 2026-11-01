import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { parseUiPathInput } from './orchestration/uipath_parser.js';
import { generatePlaywrightSpec } from './executions/generate_spec.js';

const PORT = process.env.PORT || 3333;
const TESTS_DIR = path.resolve(process.cwd(), 'tests');

function getJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. Serve UI Dashboard
  if (pathname === '/' || pathname === '/index.html') {
    const htmlPath = path.resolve(process.cwd(), 'dashboard/index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(htmlPath).pipe(res);
      return;
    }
  }

  // 2. API: List all migrated tests / activity history
  if (pathname === '/api/tests' && req.method === 'GET') {
    try {
      if (!fs.existsSync(TESTS_DIR)) fs.mkdirSync(TESTS_DIR, { recursive: true });
      const files = fs.readdirSync(TESTS_DIR).filter(f => f.endsWith('.spec.ts'));
      
      const tests = files.map(file => {
        const filePath = path.join(TESTS_DIR, file);
        const stat = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract Title / Origin
        const titleMatch = content.match(/Title:\s*(.*)/i) || content.match(/test\.describe\(['"]([^'"]+)['"]/);
        const originMatch = content.match(/Migration Origin:\s*(.*)/i);
        
        return {
          filename: file,
          filePath,
          title: titleMatch ? titleMatch[1].trim() : file,
          origin: originMatch ? originMatch[1].trim() : 'UiPath Workflow',
          sizeBytes: stat.size,
          lastModified: stat.mtime
        };
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, tests }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 3. API: Get content of a specific spec
  if (pathname === '/api/spec' && req.method === 'GET') {
    const filename = parsedUrl.searchParams.get('file');
    if (!filename) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing ?file parameter' }));
      return;
    }
    const safeFile = path.basename(filename);
    const filePath = path.join(TESTS_DIR, safeFile);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }
    const code = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, filename: safeFile, filePath, code }));
    return;
  }

  // 4. API: Save updated spec code
  if (pathname === '/api/save-spec' && req.method === 'POST') {
    try {
      const data = await getJsonBody(req);
      const safeFile = path.basename(data.filename || 'updated.spec.ts');
      const filePath = path.join(TESTS_DIR, safeFile);
      fs.writeFileSync(filePath, data.code, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, filePath }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 5. API: Delete a test spec
  if (pathname === '/api/spec' && req.method === 'DELETE') {
    const filename = parsedUrl.searchParams.get('file');
    if (filename) {
      const safeFile = path.basename(filename);
      const filePath = path.join(TESTS_DIR, safeFile);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // 6. API: Migrate UiPath Script to Playwright (TypeScript, Python, JavaScript, C#)
  if (pathname === '/api/migrate' && req.method === 'POST') {
    try {
      const data = await getJsonBody(req);
      const { script, testName, targetUrl, ticketId, language } = data;
      const targetLang = (language || 'typescript').toLowerCase();

      if (!script && !ticketId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Please provide either a UiPath script or an optional Jira ID' }));
        return;
      }

      let parsed;
      if (script) {
        parsed = parseUiPathInput(script, {
          testName: testName || 'Migrated UiPath Journey',
          targetUrl: targetUrl || '/',
          ticketId: ticketId || null
        });
      } else {
        // Fallback to Jira fetch
        const rawJira = execSync(`python3 ./orchestration/fetch_jira.py --ticket ${ticketId}`).toString();
        parsed = JSON.parse(rawJira);
      }

      parsed.language = targetLang;

      // Generate Playwright code for requested language
      const specCode = generatePlaywrightSpec(parsed, targetLang);

      // Save to tests/ directory
      if (!fs.existsSync(TESTS_DIR)) fs.mkdirSync(TESTS_DIR, { recursive: true });
      const rawSlug = ticketId || testName || 'migrated_uipath_journey';
      const sanitizedId = rawSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

      let ext = '.spec.ts';
      if (targetLang === 'python' || targetLang === 'py') ext = '_test.py';
      else if (targetLang === 'csharp' || targetLang === 'cs') ext = 'Test.cs';
      else if (targetLang === 'javascript' || targetLang === 'js') ext = '.spec.js';

      const filename = `${sanitizedId}${ext}`;
      const filePath = path.join(TESTS_DIR, filename);

      fs.writeFileSync(filePath, specCode, 'utf8');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        filename,
        filePath,
        specCode,
        language: targetLang,
        parsedStepsCount: (parsed.steps || []).length,
        parsed
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 7. API: Execute Verification Test & Self-Healing Loop
  if (pathname === '/api/run-test' && req.method === 'POST') {
    try {
      const data = await getJsonBody(req);
      const filename = path.basename(data.filename || '');
      const filePath = path.join(TESTS_DIR, filename);

      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Spec ${filename} not found` }));
        return;
      }

      let attempts = 0;
      let passed = false;
      let logs = [];
      let healingActions = [];

      while (!passed && attempts < 3) {
        attempts++;
        logs.push(`▶️ Running Playwright verification (Attempt ${attempts} of 3)...`);

        try {
          const testOutput = execSync(`npx playwright test ${filePath} --reporter=list`, {
            encoding: 'utf8',
            stdio: 'pipe'
          });
          passed = true;
          logs.push(testOutput);
          logs.push(`✅ Success: All assertions and locators verified!`);
        } catch (testError) {
          const errOutput = (testError.stderr || '') + '\n' + (testError.stdout || '') + '\n' + testError.message;
          logs.push(`⚠️ Attempt ${attempts} failed.`);

          if (attempts >= 3) {
            logs.push(`❌ Max self-healing iterations (3) reached. Manual developer action required.`);
            break;
          }

          logs.push(`🩺 Invoking self-healing module on ${filename}...`);
          try {
            const healOutput = execSync(`node ./executions/self_heal.js --target ${filePath}`, {
              input: errOutput,
              encoding: 'utf8'
            });
            healingActions.push({ attempt: attempts, log: healOutput });
            logs.push(healOutput);
          } catch (healError) {
            logs.push(`Healing execution error: ${healError.message}`);
          }
        }
      }

      // Read final code after potential healing
      const finalCode = fs.readFileSync(filePath, 'utf8');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        passed,
        attempts,
        logs: logs.join('\n'),
        healingActions,
        finalCode
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 404 Fallback
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n======================================================`);
  console.log(`🌐 UiPath Playwright Migrator Console`);
  console.log(`👉 Open Dashboard: http://127.0.0.1:${PORT}`);
  console.log(`======================================================\n`);
});
