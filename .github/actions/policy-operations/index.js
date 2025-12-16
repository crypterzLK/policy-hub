const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');

// Import all the functionality from the individual actions
class PolicyOperations {
  constructor() {
    this.workspace = core.getInput('workspace', { required: true });
  }

  // Detection functionality
  async detectChangedPolicies() {
    const baselineSha = core.getInput('baseline-sha', { required: true });
    
    core.info(`🔍 Detecting policy changes since ${baselineSha}`);
    process.chdir(this.workspace);
    
    try {
      await this.execGit(['cat-file', '-e', baselineSha]);
    } catch (error) {
      throw new Error(`Baseline SHA ${baselineSha} does not exist in repository`);
    }
    
    const diffOutput = await this.execGit([
      'diff', '--name-only', `${baselineSha}..HEAD`
    ]);
    
    if (!diffOutput) {
      core.info('📭 No changes detected since baseline');
      return this.setDetectionOutputs([], 0);
    }
    
    const changedFiles = diffOutput.split('\n').filter(Boolean);
    const policyFolders = new Set();
    
    for (const file of changedFiles) {
      if (this.isValidPolicyPath(file)) {
        const folder = this.extractPolicyFolder(file);
        if (folder) policyFolders.add(folder);
      }
    }
    
    if (policyFolders.size === 0) {
      return this.setDetectionOutputs([], 0);
    }
    
    const policies = [];
    for (const folder of policyFolders) {
      const parts = folder.split('/');
      policies.push({
        path: folder,
        name: parts[1],
        version: parts[2]
      });
    }
    
    // Filter out already delivered policies early for efficiency
    const stateFile = core.getInput('state-file') || '.state/delivered.json';
    const stateFilePath = path.resolve(this.workspace, stateFile);
    const deliveryState = await this.readDeliveryState(stateFilePath);
    
    const newPolicies = policies.filter(policy => {
      const isAlreadyDelivered = deliveryState[policy.path];
      if (isAlreadyDelivered) {
        core.info(`⏭️ Skipping ${policy.path} - already delivered (immutable)`);
        return false;
      }
      return true;
    });
    
    core.info(`📊 Detection Summary: ${policies.length} changed, ${newPolicies.length} need processing`);
    
    newPolicies.sort((a, b) => {
      if (a.name !== b.name) return a.name.localeCompare(b.name);
      return a.version.localeCompare(b.version);
    });
    
    return this.setDetectionOutputs(newPolicies, newPolicies.length);
  }

  // Validation functionality
  async validatePolicy() {
    const policyPath = core.getInput('policy-path', { required: true });
    const configFile = core.getInput('config-file', { required: true });
    
    core.info(`🔍 Validating policy: ${policyPath}`);
    
    const parts = policyPath.split('/');
    if (parts.length !== 3 || parts[0] !== 'policies') {
      throw new Error(`Invalid policy path format: ${policyPath}`);
    }
    
    const policyName = parts[1];
    const policyVersion = parts[2];
    const policyDir = path.resolve(this.workspace, policyPath);
    const configPath = path.resolve(this.workspace, configFile);
    
    if (!await this.fileExists(policyDir)) {
      throw new Error(`Policy directory does not exist: ${policyDir}`);
    }
    
    const config = await this.readJsonFile(configPath);
    const result = { errors: [], warnings: [] };
    
    await this.validateStructure(policyDir, result);
    await this.validateMetadata(policyDir, policyName, policyVersion, result);
    await this.validateDocumentation(policyDir, config, result);
    await this.validateSource(policyDir, result);
    await this.validatePolicyDefinition(policyDir, result);
    
    const isValid = result.errors.length === 0;
    core.setOutput('valid', isValid.toString());
    core.setOutput('validation-errors', JSON.stringify(result.errors));
    core.setOutput('validation-warnings', JSON.stringify(result.warnings));
    
    if (!isValid) {
      throw new Error(`Policy validation failed with ${result.errors.length} error(s)`);
    }
    
    return { valid: isValid, errors: result.errors, warnings: result.warnings };
  }

  // Status check functionality
  async checkDeliveryStatus() {
    const policyPath = core.getInput('policy-path', { required: true });
    const stateFile = core.getInput('state-file', { required: true });
    
    core.info(`🔍 Checking delivery status for: ${policyPath}`);
    
    const stateFilePath = path.resolve(this.workspace, stateFile);
    const deliveryState = await this.readDeliveryState(stateFilePath);
    const decision = this.shouldDeliver(policyPath, deliveryState);
    
    core.setOutput('should-deliver', decision.shouldDeliver.toString());
    core.setOutput('delivery-reason', decision.reason);
    
    return decision;
  }

  // API existence check functionality
  async checkApiExistence() {
    const policyName = core.getInput('policy-name', { required: true });
    const policyVersion = core.getInput('policy-version', { required: true });
    const policySha = core.getInput('policy-sha', { required: true });
    const apiUrl = core.getInput('api-url', { required: true });
    const apiKey = core.getInput('api-key', { required: true });
    const stateFile = core.getInput('state-file', { required: true });
    
    core.info(`🌐 Checking if policy exists in API: ${policyName} ${policyVersion}`);
    
    try {
      // Check if policy exists in API directly (no health check needed)
      const existsResult = await this.checkPolicyExistsInApi(apiUrl, apiKey, policyName, policyVersion);
      
      if (existsResult.exists) {
        core.info(`✅ Policy ${policyName} ${policyVersion} exists in API - marking as delivered in local state`);
        
        // Update local state to reflect that this policy was already delivered
        // Since policy versions are IMMUTABLE, if it exists in API, it's considered delivered
        const stateFilePath = path.resolve(this.workspace, stateFile);
        await this.updateStateForExistingPolicy(stateFilePath, core.getInput('policy-path'));
        
        core.setOutput('api-available', 'true');
        core.setOutput('policy-exists-in-api', 'true');
        core.setOutput('should-skip', 'true');
        core.setOutput('check-result', 'exists-in-api');
        return { apiAvailable: true, policyExists: true, shouldSkip: true };
      } else {
        core.info(`📝 Policy ${policyName} ${policyVersion} does not exist in API - proceed with publishing`);
        core.setOutput('api-available', 'true');
        core.setOutput('policy-exists-in-api', 'false');
        core.setOutput('should-skip', 'false');
        core.setOutput('check-result', 'not-in-api');
        return { apiAvailable: true, policyExists: false, shouldSkip: false };
      }
      
    } catch (error) {
      core.warning(`API existence check failed: ${error.message}`);
      // On error, proceed with normal processing (don't block the workflow)
      core.setOutput('api-available', 'false');
      core.setOutput('policy-exists-in-api', 'false');
      core.setOutput('should-skip', 'false');
      core.setOutput('check-result', 'check-failed');
      return { apiAvailable: false, policyExists: false, shouldSkip: false };
    }
  }

  // Publishing functionality
  async publishPolicy() {
    const policyPath = core.getInput('policy-path', { required: true });
    const policyName = core.getInput('policy-name', { required: true });
    const policyVersion = core.getInput('policy-version', { required: true });
    const policySha = core.getInput('policy-sha', { required: true });
    const apiUrl = core.getInput('api-url', { required: true });
    const apiKey = core.getInput('api-key', { required: true });
    
    core.info(`📦 Publishing policy: ${policyName} ${policyVersion}`);
    
    const policyDir = path.resolve(this.workspace, policyPath);
    const payload = await this.preparePolicyPayload(policyDir, policyName, policyVersion);
    const result = await this.publishToApi(apiUrl, apiKey, payload);
    
    core.setOutput('published', result.success.toString());
    core.setOutput('api-response', result.message);
    if (result.data?.url) {
      core.setOutput('policy-url', result.data.url);
    }
    
    if (!result.success) {
      throw new Error(`Failed to publish policy: ${result.message}`);
    }
    
    return result;
  }

  // State update functionality
  async updateDeliveryState() {
    const policyPath = core.getInput('policy-path', { required: true });
    const releaseTag = core.getInput('release-tag', { required: true });
    const stateFile = core.getInput('state-file', { required: true });
    
    core.info(`💾 Updating delivery state for: ${policyPath}`);
    
    const stateFilePath = path.resolve(this.workspace, stateFile);
    const state = await this.readDeliveryState(stateFilePath);
    this.updatePolicyRecord(state, policyPath, releaseTag);
    
    await this.writeDeliveryState(stateFilePath, state);
    
    core.setOutput('state-updated', 'true');
    
    return { updated: true, previousSha };
  }

  // Utility methods
  async execGit(args, options = {}) {
    let output = '';
    let error = '';
    
    const exitCode = await exec.exec('git', args, {
      ...options,
      listeners: {
        stdout: (data) => { output += data.toString(); },
        stderr: (data) => { error += data.toString(); }
      },
      silent: true
    });
    
    if (exitCode !== 0) {
      throw new Error(`Git command failed: ${error}`);
    }
    
    return output.trim();
  }

  isValidPolicyPath(filePath) {
    const parts = filePath.split('/');
    return parts.length >= 3 &&
           parts[0] === 'policies' &&
           parts[2].match(/^v\d+\.\d+\.\d+$/);
  }

  extractPolicyFolder(filePath) {
    const parts = filePath.split('/');
    if (parts.length >= 3 && parts[0] === 'policies') {
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    return null;
  }

  setDetectionOutputs(policies, count) {
    const matrixConfig = {
      include: policies.map(p => ({
        path: p.path,
        name: p.name,
        version: p.version
      }))
    };
    
    core.setOutput('changed-policies', JSON.stringify(policies));
    core.setOutput('changed-policies-matrix', JSON.stringify(matrixConfig));
    core.setOutput('policy-count', count.toString());
    
    return { policies, count };
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async readDeliveryState(stateFilePath) {
    try {
      const content = await fs.readFile(stateFilePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw new Error(`Failed to read delivery state: ${error.message}`);
    }
  }

  async writeDeliveryState(stateFilePath, state) {
    const dir = path.dirname(stateFilePath);
    await fs.mkdir(dir, { recursive: true });
    const content = JSON.stringify(state, null, 2);
    await fs.writeFile(stateFilePath, content, 'utf8');
  }

  shouldDeliver(policyPath, deliveryState) {
    const record = deliveryState[policyPath];
    
    if (!record) {
      return {
        shouldDeliver: true,
        reason: 'never-delivered',
        message: 'Policy version has never been delivered'
      };
    }
    
    // Policy versions are IMMUTABLE - once delivered, NEVER deliver again
    // regardless of folder content changes
    return {
      shouldDeliver: false,
      reason: 'version-immutable',
      message: `Policy version already delivered and is immutable (delivered at ${record.deliveredAt})`,
      lastDeliveredAt: record.deliveredAt
    };
  }

  updatePolicyRecord(state, policyPath, releaseTag) {
    state[policyPath] = {
      deliveredAt: new Date().toISOString(),
      release: releaseTag
    };
  }

  async validateStructure(policyDir, result) {
    const requiredFiles = ['metadata.json', 'policy-definition.yaml'];
    const requiredDirs = ['docs', 'src'];
    
    for (const file of requiredFiles) {
      const filePath = path.join(policyDir, file);
      if (!await this.fileExists(filePath)) {
        result.errors.push({ message: `Missing required file: ${file}`, file, type: 'error' });
      }
    }
    
    for (const dir of requiredDirs) {
      const dirPath = path.join(policyDir, dir);
      if (!await this.fileExists(dirPath)) {
        result.errors.push({ message: `Missing required directory: ${dir}`, file: dir, type: 'error' });
      }
    }
  }

  async validateMetadata(policyDir, policyName, policyVersion, result) {
    const metadataPath = path.join(policyDir, 'metadata.json');
    const metadata = await this.readJsonFile(metadataPath);
    
    if (!metadata) return;
    
    const requiredFields = ['name', 'version', 'description', 'author'];
    
    for (const field of requiredFields) {
      if (!metadata[field]) {
        result.errors.push({ message: `metadata.json missing required field: ${field}`, file: 'metadata.json', type: 'error' });
      }
    }
    
    if (metadata.name && metadata.name !== policyName) {
      result.errors.push({
        message: `metadata.json name "${metadata.name}" does not match folder name "${policyName}"`,
        file: 'metadata.json',
        type: 'error'
      });
    }
    
    if (metadata.version && metadata.version !== policyVersion) {
      result.errors.push({
        message: `metadata.json version "${metadata.version}" does not match folder version "${policyVersion}"`,
        file: 'metadata.json',
        type: 'error'
      });
    }
  }

  async validateDocumentation(policyDir, config, result) {
    const docsDir = path.join(policyDir, 'docs');
    if (!await this.fileExists(docsDir)) return;
    
    const requiredDocs = config?.validation?.requiredDocs || [
      'overview.md', 'configuration.md', 'examples.md'
    ];
    
    for (const doc of requiredDocs) {
      const docPath = path.join(docsDir, doc);
      if (!await this.fileExists(docPath)) {
        result.errors.push({ message: `Missing required documentation file: docs/${doc}`, file: `docs/${doc}`, type: 'error' });
      }
    }
  }

  async validateSource(policyDir, result) {
    const srcDir = path.join(policyDir, 'src');
    if (!await this.fileExists(srcDir)) return;
    
    try {
      const files = await fs.readdir(srcDir);
      const sourceFiles = files.filter(f => 
        f.endsWith('.go') || f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.py')
      );
      
      if (sourceFiles.length === 0) {
        result.errors.push({ message: 'No source files found in src/ directory', file: 'src/', type: 'error' });
      }
    } catch (error) {
      result.errors.push({ message: `Failed to read src/ directory: ${error.message}`, file: 'src/', type: 'error' });
    }
  }

  async validatePolicyDefinition(policyDir, result) {
    const definitionPath = path.join(policyDir, 'policy-definition.yaml');
    if (!await this.fileExists(definitionPath)) return;
    
    try {
      const content = await fs.readFile(definitionPath, 'utf8');
      if (content.trim().length === 0) {
        result.errors.push({ message: 'policy-definition.yaml is empty', file: 'policy-definition.yaml', type: 'error' });
      }
    } catch (error) {
      result.errors.push({
        message: `Failed to read policy-definition.yaml: ${error.message}`,
        file: 'policy-definition.yaml',
        type: 'error'
      });
    }
  }

  async preparePolicyPayload(policyDir, policyName, policyVersion) {
    const payload = {
      name: policyName,
      version: policyVersion,
      commitSha: process.env.GITHUB_SHA || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    try {
      const metadataPath = path.join(policyDir, 'metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      payload.metadata = JSON.parse(metadataContent);
    } catch (error) {
      core.warning(`Could not read metadata.json: ${error.message}`);
    }
    
    try {
      const definitionPath = path.join(policyDir, 'policy-definition.yaml');
      const definitionContent = await fs.readFile(definitionPath, 'utf8');
      payload.definition = definitionContent;
    } catch (error) {
      core.warning(`Could not read policy-definition.yaml: ${error.message}`);
    }
    
    return payload;
  }

  async publishToApi(apiUrl, apiKey, payload) {
    const url = `${apiUrl}/policies`;
    const requestBody = JSON.stringify(payload);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'Authorization': `Bearer ${apiKey}`,
        'X-Idempotency-Key': process.env.GITHUB_SHA || payload.commitSha,
        'User-Agent': 'GitHub-Actions-Policy-Publisher/1.0'
      }
    };
    
    try {
      const response = await this.makeRequest(url, options, requestBody);
      
      let responseData = null;
      try {
        responseData = JSON.parse(response.body);
      } catch {
        responseData = { message: response.body };
      }
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {
          success: true,
          statusCode: response.statusCode,
          message: responseData.message || 'Policy published successfully',
          data: responseData
        };
      } else if (response.statusCode === 409) {
        return {
          success: true,
          statusCode: response.statusCode,
          message: 'Policy already published (idempotent)',
          data: responseData
        };
      } else {
        return {
          success: false,
          statusCode: response.statusCode,
          message: responseData.message || `API returned status ${response.statusCode}`,
          data: responseData
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  makeRequest(url, options, body = null) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const req = client.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error(`Request timeout after 30000ms`));
      });
      
      if (body) {
        req.write(body);
      }
      
      req.end();
    });
  }

  async checkPolicyExistsInApi(apiUrl, apiKey, policyName, policyVersion) {
    try {
      const url = `${apiUrl}/policies/${encodeURIComponent(policyName)}/${encodeURIComponent(policyVersion)}`;
      const options = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'GitHub-Actions-Policy-Publisher/1.0'
        }
      };
      
      const response = await this.makeRequest(url, options);
      
      if (response.statusCode === 200) {
        // Policy exists
        return { exists: true, data: JSON.parse(response.body) };
      } else if (response.statusCode === 404) {
        // Policy does not exist
        return { exists: false };
      } else {
        throw new Error(`API returned unexpected status ${response.statusCode}: ${response.body}`);
      }
    } catch (error) {
      throw new Error(`Failed to check policy existence: ${error.message}`);
    }
  }

  async updateStateForExistingPolicy(stateFilePath, policyPath) {
    try {
      const deliveryState = await this.readDeliveryState(stateFilePath);
      
      // Mark as delivered since it exists in API (policy versions are immutable)
      deliveryState[policyPath] = {
        deliveredAt: new Date().toISOString(),
        release: 'api-existing',
        note: 'Policy exists in API - marked as delivered'
      };
      
      await this.writeDeliveryState(stateFilePath, deliveryState);
      core.info(`📝 Updated local state to mark policy as delivered: ${policyPath}`);
    } catch (error) {
      core.warning(`Failed to update state for existing policy: ${error.message}`);
    }
  }
}

// Main execution
async function run() {
  try {
    const operation = core.getInput('operation', { required: true });
    const ops = new PolicyOperations();
    
    core.info(`🎯 Running operation: ${operation}`);
    
    switch (operation) {
      case 'detect':
        await ops.detectChangedPolicies();
        break;
      case 'validate':
        await ops.validatePolicy();
        break;
      case 'check-status':
        await ops.checkDeliveryStatus();
        break;
      case 'check-api-existence':
        await ops.checkApiExistence();
        break;
      case 'publish':
        await ops.publishPolicy();
        break;
      case 'update-state':
        await ops.updateDeliveryState();
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    core.info(`✅ Operation ${operation} completed successfully`);
    
  } catch (error) {
    core.setFailed(`❌ Operation failed: ${error.message}`);
  }
}

run();