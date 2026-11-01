import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function runMigrationPipeline(options = {}) {
    const { ticketId, scriptPath, rawInput } = options;
    const identifier = ticketId ? `Ticket [${ticketId}]` : (scriptPath ? `Script [${path.basename(scriptPath)}]` : 'Generic UiPath Input');
    console.log(`🚀 Antigravity Agent: Initializing migration for ${identifier}`);
    
    // 1. Ingest Input (Jira ticket is optional)
    let payload = '';
    if (scriptPath && fs.existsSync(scriptPath)) {
        console.log(`📂 Ingesting UiPath script file: ${scriptPath}`);
        payload = fs.readFileSync(scriptPath, 'utf8');
    } else if (rawInput) {
        console.log(`📝 Ingesting provided UiPath input...`);
        payload = rawInput;
    } else if (ticketId) {
        console.log(`📡 Fetching test case data for ${ticketId}...`);
        payload = execSync(`python3 ./orchestration/fetch_jira.py --ticket ${ticketId}`).toString();
    } else {
        console.log(`ℹ️ No Jira ID or script specified. Running in Generic UiPath migration mode...`);
        payload = execSync(`python3 ./orchestration/fetch_jira.py`).toString();
    }
    
    // 2. Initial Code Generation Draft
    console.log(`✍️ Generating Playwright test spec adhering to modern semantic standards...`);
    let specPath = execSync(`node ./executions/generate_spec.js`, { input: payload }).toString().trim();
    console.log(`📄 Generated test spec draft at: ${specPath}`);
    
    // 3. Execution Verification & Self-Healing Loop (Max 3 Retries)
    let executionPassed = false;
    let attempts = 0;
    
    while (!executionPassed && attempts < 3) {
        try {
            console.log(`\n▶️ Running verification test (Attempt ${attempts + 1} of 3)...`);
            execSync(`npx playwright test ${specPath} --trace on`, { stdio: 'pipe' });
            executionPassed = true;
            console.log(`\n🎉 Success! Spec executed cleanly with all assertions passing.`);
        } catch (error) {
            attempts++;
            console.log(`\n⚠️ Test attempt ${attempts} encountered a failure. Extracting trace & logs for self-healing...`);
            
            // Extracting comprehensive error log
            const stdErr = error.stderr ? error.stderr.toString() : '';
            const stdOut = error.stdout ? error.stdout.toString() : '';
            const logDump = `${stdErr}\n${stdOut}\n${error.message}`;
            
            if (attempts >= 3) {
                console.error("\n❌ Max self-healing iterations (3) reached without full pass.");
                console.error("🚩 STRUCTURAL SYSTEM EXCEPTION: Human developer action required to review DOM mutations.");
                throw new Error("HUMAN_DEVELOPER_ACTION_REQUIRED: Max self-healing iterations exceeded.");
            }
            
            // Execute healing script to modify locators reactively
            console.log(`🩺 Executing self-healing module on ${specPath}...`);
            execSync(`node ./executions/self_heal.js --target ${specPath}`, { input: logDump, stdio: ['pipe', 'inherit', 'inherit'] });
        }
    }
    return specPath;
}

// CLI Argument Parsing
const args = process.argv.slice(2);
let ticketId = null;
let scriptPath = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--script' && args[i + 1]) {
        scriptPath = args[i + 1];
        i++;
    } else if (args[i] === '--ticket' && args[i + 1]) {
        ticketId = args[i + 1];
        i++;
    } else if (!args[i].startsWith('-') && !ticketId) {
        ticketId = args[i];
    }
}

// Check if running from CLI directly
if (process.argv[1] && process.argv[1].endsWith('coordinator.js')) {
    runMigrationPipeline({ ticketId, scriptPath }).catch((err) => {
        console.error(`\n[PIPELINE_ERROR] ${err.message}`);
        process.exit(1);
    });
}

export { runMigrationPipeline };
