#!/usr/bin/env node

// Entry point for npx and global repo-audit execution
import('../dist/cli.mjs').catch((err) => {
  console.error('Failed to run repo-audit:', err.message);
  process.exit(1);
});
