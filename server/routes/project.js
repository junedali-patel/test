// server/routes/project.js
// Express route handler for multi-file repository project analysis

const express = require('express');
const router = express.Router();
const { analyzeRepository } = require('../projectAnalyzer');

/**
 * POST /api/project/analyze
 * Analyzes an entire repository of source files to determine file, module, function, and call relationships
 *
 * Request Body:
 * {
 *   "repositoryName": "my-project",
 *   "files": [
 *     { "path": "main.py", "content": "from auth import login\nlogin()" },
 *     { "path": "auth.py", "content": "from database import check_user\ndef login():\n    check_user()" },
 *     { "path": "database.py", "content": "def check_user():\n    print('Checking user')" }
 *   ],
 *   "level": "combined" // Optional: "file" | "function" | "combined"
 * }
 */
router.post('/analyze', async (req, res) => {
  const {
    repositoryName = 'repository',
    files = [],
    level = 'combined'
  } = req.body;

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request: "files" array is required and must not be empty.',
      suggestion: 'Provide repository source files with { path, content }'
    });
  }

  // Validate level parameter if provided
  const validLevels = ['file', 'function', 'combined', 'module'];
  const sanitizedLevel = validLevels.includes(level) ? (level === 'module' ? 'file' : level) : 'combined';

  try {
    console.log(`[Project Analyzer] Starting analysis for "${repositoryName}" (${files.length} input files, level: ${sanitizedLevel})`);

    const result = analyzeRepository({
      repositoryName,
      files,
      level: sanitizedLevel
    });

    console.log(`[Project Analyzer] Analysis completed for "${repositoryName}" in ${result.statistics.analysisTimeMs}ms:`, {
      sourceFiles: result.statistics.totalFiles,
      functions: result.statistics.totalFunctions,
      dependencies: result.statistics.totalDependencies,
      calls: result.statistics.totalCalls,
      cycles: result.statistics.circularDependencies
    });

    return res.json(result);
  } catch (error) {
    console.error('[Project Analyzer Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Unable to analyze project repository.',
      details: error.message
    });
  }
});

module.exports = router;
