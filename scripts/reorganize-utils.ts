/**
 * Reorganize src/utils/ directory structure.
 *
 * Moves related utility files into thematic subdirectories and updates all
 * import paths across the codebase. Uses git mv to preserve history.
 *
 * Usage: bun run scripts/reorganize-utils.ts [--phase 1|2|3|4]
 *   Without --phase, runs all phases.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';

const ROOT = path.resolve(import.meta.dir, '..');
const SRC = path.join(ROOT, 'src');
const UTILS = path.join(SRC, 'utils');

// ─── Manifest ───────────────────────────────────────────────────────────────
// Map: old path relative to project root (.ts) → new path relative to project root (.ts)
type Manifest = Record<string, string>;

function buildManifest(): Manifest {
  const m: Manifest = {};

  const add = (files: string[], dir: string) => {
    for (const f of files) {
      m[`src/utils/${f}`] = `src/utils/${dir}/${f}`;
    }
  };

  // Phase 1: Move into existing subdirectories
  add(['hooks.ts'], 'hooks');
  add(['messages.ts'], 'messages');
  add(['git.ts', 'gitDiff.ts', 'gitSettings.ts'], 'git');
  add(['githubRepoPathMapping.ts', 'ghPrStatus.ts'], 'github');
  add(['tasks.ts'], 'task');
  add([
    'mcpInstructionsDelta.ts',
    'mcpOutputStorage.ts',
    'mcpValidation.ts',
    'mcpWebSocketTransport.ts',
  ], 'mcp');
  add([
    'teammate.ts',
    'teammateContext.ts',
    'teammateMailbox.ts',
    'teamDiscovery.ts',
    'teamMemoryOps.ts',
    'directMemberMessage.ts',
  ], 'swarm');
  add(['classifierApprovals.ts', 'classifierApprovalsHook.ts'], 'permissions');
  add(['stats.ts', 'statsCache.ts', 'telemetryAttributes.ts'], 'telemetry');
  add(['collapseBackgroundBashNotifications.ts'], 'bash');

  // Phase 2: New directories — lower-churn
  add([
    'auth.ts', 'authFileDescriptor.ts', 'authPortable.ts',
    'aws.ts', 'awsAuthStatusManager.ts', 'crypto.ts',
    'mtls.ts', 'caCerts.ts', 'caCertsConfig.ts',
    'proxy.ts',
  ], 'auth');

  add([
    'cleanup.ts', 'cleanupRegistry.ts', 'gracefulShutdown.ts',
    'commandLifecycle.ts', 'idleTimeout.ts', 'timeouts.ts',
    'backgroundHousekeeping.ts', 'autoUpdater.ts', 'earlyInput.ts',
    'warningHandler.ts',
  ], 'lifecycle');

  add([
    'ansiToPng.ts', 'ansiToSvg.ts', 'imagePaste.ts',
    'imageResizer.ts', 'imageStore.ts', 'imageValidation.ts',
    'screenshotClipboard.ts', 'attachments.ts', 'asciicast.ts',
    'pasteStore.ts', 'pdf.ts', 'pdfUtils.ts',
  ], 'media');

  add([
    'ink.ts', 'theme.ts', 'systemTheme.ts',
    'status.tsx', 'statusNoticeDefinitions.tsx', 'statusNoticeHelpers.ts',
    'terminal.ts', 'terminalPanel.ts', 'autoRunIssue.tsx',
    'exportRenderer.tsx', 'preflightChecks.tsx', 'staticRender.tsx',
    'fullscreen.ts', 'horizontalScroll.ts', 'displayTags.ts',
    'highlightMatch.tsx', 'renderOptions.ts',
  ], 'rendering');

  add([
    'cron.ts', 'cronJitterConfig.ts', 'cronScheduler.ts',
    'cronTasks.ts', 'cronTasksLock.ts',
  ], 'cron');

  add([
    'abortController.ts', 'combinedAbortSignal.ts', 'sequential.ts',
    'withResolvers.ts', 'memoize.ts', 'sleep.ts',
    'queueProcessor.ts', 'stream.ts',
  ], 'concurrency');

  add([
    'file.ts', 'fileHistory.ts', 'fileRead.ts',
    'fileReadCache.ts', 'fileStateCache.ts', 'fsOperations.ts',
    'glob.ts', 'readFileInRange.ts', 'tempfile.ts',
    'lockfile.ts',
  ], 'files');

  // Phase 3: New directories — medium-churn
  add([
    'format.ts', 'formatBriefTimestamp.ts', 'json.ts',
    'yaml.ts', 'xml.ts', 'markdown.ts',
    'frontmatterParser.ts', 'cliHighlight.ts', 'semver.ts',
    'semanticBoolean.ts', 'semanticNumber.ts', 'treeify.ts',
    'truncate.ts', 'sliceAnsi.ts', 'words.ts',
    'stringUtils.ts', 'array.ts', 'set.ts',
    'objectGroupBy.ts', 'uuid.ts', 'hash.ts',
    'intl.ts', 'taggedId.ts',
  ], 'text');

  add([
    'platform.ts', 'env.ts', 'envDynamic.ts',
    'envUtils.ts', 'envValidation.ts', 'genericProcessUtils.ts',
    'process.ts', 'cwd.ts', 'path.ts',
    'systemDirectories.ts', 'xdg.ts', 'windowsPaths.ts',
    'userAgent.ts', 'signal.ts',
  ], 'platform');

  add([
    'agentContext.ts', 'agentId.ts', 'agentSwarmsEnabled.ts',
    'agenticSessionSearch.ts', 'forkedAgent.ts', 'standaloneAgent.ts',
    'inProcessTeammateHelpers.ts', 'systemPrompt.ts', 'systemPromptType.ts',
    'embeddedTools.ts', 'toolPool.ts', 'toolSchemaCache.ts',
    'toolSearch.ts', 'sideQuery.ts', 'sideQuestion.ts',
  ], 'agent');

  add([
    'config.ts', 'configConstants.ts', 'claudemd.ts',
    'markdownConfigLoader.ts', 'envFile.ts', 'managedEnv.ts',
    'managedEnvConstants.ts', 'betas.ts', 'bundledMode.ts',
    'cliArgs.ts', 'privacyLevel.ts', 'fastMode.ts',
    'effort.ts',
  ], 'config');

  add([
    'api.ts', 'apiBaseUrl.ts', 'apiPreconnect.ts',
    'http.ts', 'modelCost.ts', 'billing.ts',
    'extraUsage.ts', 'tokenBudget.ts',
  ], 'api');

  add([
    'editor.ts', 'ide.ts', 'idePathConversion.ts',
    'jetbrains.ts', 'readEditContext.ts', 'promptEditor.ts',
    'textHighlighting.ts', 'keyboardShortcuts.ts', 'desktopDeepLink.ts',
    'codeIndexing.ts',
  ], 'ide');

  // Phase 4: Highest-churn directories
  add([
    'sessionActivity.ts', 'sessionEnvVars.ts', 'sessionEnvironment.ts',
    'sessionFileAccessHooks.ts', 'sessionIngressAuth.ts', 'sessionRestore.ts',
    'sessionStart.ts', 'sessionState.ts', 'sessionStorage.ts',
    'sessionStoragePortable.ts', 'sessionTitle.ts', 'sessionUrl.ts',
    'concurrentSessions.ts', 'listSessionsImpl.ts', 'crossProjectResume.ts',
    'conversationRecovery.ts',
  ], 'session');

  add([
    'log.ts', 'debug.ts', 'debugFilter.ts',
    'diagLogs.ts', 'errorLogSink.ts', 'sinks.ts',
  ], 'debug');

  return m;
}

const MANIFEST = buildManifest();

// ─── Phase Grouping ─────────────────────────────────────────────────────────

const PHASE_DIRS: Record<number, string[]> = {
  1: ['hooks', 'messages', 'git', 'github', 'task', 'mcp', 'swarm', 'permissions', 'telemetry', 'bash'],
  2: ['auth', 'lifecycle', 'media', 'rendering', 'cron', 'concurrency', 'files'],
  3: ['text', 'platform', 'agent', 'config', 'api', 'ide'],
  4: ['session', 'debug'],
};

function getManifestForPhase(phase: number): Manifest {
  const dirs = PHASE_DIRS[phase];
  if (!dirs) return {};
  const result: Manifest = {};
  for (const [oldPath, newPath] of Object.entries(MANIFEST)) {
    const targetDir = newPath.split('/')[2]; // src/utils/<dir>/...
    if (dirs.includes(targetDir)) {
      result[oldPath] = newPath;
    }
  }
  return result;
}

// ─── File Discovery ─────────────────────────────────────────────────────────

async function* allSourceFiles(): AsyncGenerator<string> {
  const dirs = [SRC];
  while (dirs.length > 0) {
    const dir = dirs.pop()!;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const             entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, dist, .git
        if (!['node_modules', 'dist', '.git'].includes(entry.name)) {
          dirs.push(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        yield fullPath;
      }
    }
  }
}

// ─── Import Path Rewriting ──────────────────────────────────────────────────

/**
 * Match all import/require specifiers that end in .js.
 * Handles: import ... from '...', import('...'), require('...'), export ... from '...'
 * Group 1: the full specifier string (e.g., 'src/utils/auth.js', '../../utils/auth.js', './auth.js')
 */
const IMPORT_SPECIFIER_RE = /(?:from\s+['"]|import\s+['"]|import\s*\(\s*['"]|require\s*\(\s*['"])([^'"]+\.js)['"]/g;

interface Replacement {
  index: number;
  oldStr: string;
  newStr: string;
}

function findReplacements(
  content: string,
  filePath: string,
  manifest: Manifest,
): Replacement[] {
  const replacements: Replacement[] = [];
  const fileDir = path.dirname(filePath);

  // Build reverse map: new → old, for files that were themselves moved
  const currentFileRel = path.relative(ROOT, filePath);
  const reverseManifest: Record<string, string> = {};
  for (const [old, neu] of Object.entries(manifest)) {
    reverseManifest[neu] = old;
  }

  // Determine if the current file was moved, and its old directory
  const currentFileOldPath = reverseManifest[currentFileRel] ?? null;
  const oldFileDir = currentFileOldPath
    ? path.dirname(path.resolve(ROOT, currentFileOldPath))
    : null;

  // Helper to try resolving a path against the manifest
  function tryResolveManifest(p: string): string | null {
    const tsRel = path.relative(ROOT, p + '.ts');
    if (manifest[tsRel]) return manifest[tsRel];
    const tsxRel = path.relative(ROOT, p + '.tsx');
    if (manifest[tsxRel]) return manifest[tsxRel];
    return null;
  }

  IMPORT_SPECIFIER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMPORT_SPECIFIER_RE.exec(content)) !== null) {
    const importSpecifier = match[1]; // e.g., 'src/utils/auth.js', '../../utils/auth.js', './auth.js'

    if (importSpecifier.startsWith('src/')) {
      // ── Path alias import ──────────────────────────────────────────
      const basePath = importSpecifier.replace(/\.js$/, '');
      const resolvedPath = path.resolve(ROOT, basePath);
      const newRelativePath = tryResolveManifest(resolvedPath);
      if (!newRelativePath) continue; // Target not in manifest

      let newSpecifier = newRelativePath.replace(/\.tsx?$/, '.js');
      if (!newSpecifier.startsWith('src/')) {
        newSpecifier = 'src/' + newSpecifier;
      }
      if (importSpecifier !== newSpecifier) {
        replacements.push({
          index: match.index + match[0].indexOf(importSpecifier),
          oldStr: importSpecifier,
          newStr: newSpecifier,
        });
      }
    } else {
      // ── Relative import ────────────────────────────────────────────
      const basePath = importSpecifier.replace(/\.js$/, '');

      // Case 1: Importer moved → need to re-express relative path from new location
      if (currentFileOldPath) {
        // Resolve from OLD location to find the actual target file
        const oldTarget = path.resolve(oldFileDir!, basePath);
        // Try with .ts and .tsx extensions
        let targetRel = path.relative(ROOT, oldTarget + '.ts');
        let targetExists = existsSync(path.resolve(ROOT, targetRel));
        if (!targetExists) {
          targetRel = path.relative(ROOT, oldTarget + '.tsx');
          targetExists = existsSync(path.resolve(ROOT, targetRel));
        }
        // If target doesn't exist at old path, it might have been moved
        // in an earlier phase — check the FULL manifest (not just current phase)
        if (!targetExists) {
          const tsKey = path.relative(ROOT, oldTarget + '.ts');
          const tsxKey = path.relative(ROOT, oldTarget + '.tsx');
          // Check current-phase manifest first, then full manifest
          const fullManifestEntry = manifest[tsKey] ?? manifest[tsxKey]
            ?? MANIFEST[tsKey] ?? MANIFEST[tsxKey];
          if (fullManifestEntry) {
            // Use the new location from the manifest (not the old key)
            targetRel = fullManifestEntry;
            targetExists = true;
          }
        }

        if (targetExists) {
          // Check if the target also moved
          const newTargetRel = manifest[targetRel] ?? targetRel;
          // Compute new relative path from NEW location to (possibly moved) target
          const newTarget = path.resolve(ROOT, newTargetRel);
          let rel = path.relative(fileDir, newTarget);
          rel = rel.replace(/\.tsx?$/, '.js');
          if (!rel.startsWith('.')) rel = './' + rel;

          if (importSpecifier !== rel) {
            replacements.push({
              index: match.index + match[0].indexOf(importSpecifier),
              oldStr: importSpecifier,
              newStr: rel,
            });
          }
        }
        continue;
      }

      // Case 2: Importer not moved, but target moved
      const resolvedPath = path.resolve(fileDir, basePath);
      const newRelativePath = tryResolveManifest(resolvedPath);
      if (!newRelativePath) continue;

      const newTarget = path.resolve(ROOT, newRelativePath);
      let rel = path.relative(fileDir, newTarget);
      rel = rel.replace(/\.tsx?$/, '.js');
      if (!rel.startsWith('.')) rel = './' + rel;

      if (importSpecifier !== rel) {
        replacements.push({
          index: match.index + match[0].indexOf(importSpecifier),
          oldStr: importSpecifier,
          newStr: rel,
        });
      }
    }
  }

  // Sort replacements by index (descending) so we can apply them without offset issues
  replacements.sort((a, b) => b.index - a.index);
  return replacements;
}

function applyReplacements(content: string, replacements: Replacement[]): string {
  for (const r of replacements) {
    content = content.slice(0, r.index) + r.newStr + content.slice(r.index + r.oldStr.length);
  }
  return content;
}

// ─── File Moving ────────────────────────────────────────────────────────────

async function moveFiles(manifest: Manifest): Promise<number> {
  let moved = 0;
  for (const [oldPath] of Object.entries(manifest)) {
    const oldFull = path.join(ROOT, oldPath);
    const newFull = path.join(ROOT, manifest[oldPath]);

    // Skip if already at destination
    if (oldFull === newFull) continue;

    // Ensure target directory exists
    const targetDir = path.dirname(newFull);
    await $`mkdir -p ${targetDir}`.quiet();

    // Check if source exists
    const sourceExists = await Bun.file(oldFull).exists();
    if (!sourceExists) {
      console.warn(`  ⚠ Source file does not exist: ${oldFull}`);
      continue;
    }

    // git mv
    try {
      await $`cd ${ROOT} && git mv ${oldPath} ${manifest[oldPath]}`.quiet();
      console.log(`  ✓ ${oldPath} → ${manifest[oldPath]}`);
      moved++;
    } catch (err: any) {
      // Fallback: regular mv
      console.warn(`  ⚠ git mv failed for ${oldPath}, trying regular mv: ${err.message}`);
      await $`mv ${oldFull} ${newFull}`.quiet();
      moved++;
    }
  }
  return moved;
}

// ─── Import Updating ────────────────────────────────────────────────────────

async function updateImports(manifest: Manifest): Promise<{ filesScanned: number; filesModified: number; replacements: number }> {
  let filesScanned = 0;
  let filesModified = 0;
  let totalReplacements = 0;

  for await (const filePath of allSourceFiles()) {
    filesScanned++;
    const content = readFileSync(filePath, 'utf-8');
    const replacements = findReplacements(content, filePath, manifest);

    if (replacements.length > 0) {
      const newContent = applyReplacements(content, replacements);
      writeFileSync(filePath, newContent, 'utf-8');
      filesModified++;
      totalReplacements += replacements.length;

      if (filesModified <= 30 || filesModified % 50 === 0) {
        const relPath = path.relative(ROOT, filePath);
        console.log(`  ${relPath}: ${replacements.length} import(s) updated`);
      }
    }
  }

  return { filesScanned, filesModified, replacements: totalReplacements };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const phaseArg = args.indexOf('--phase');
  const phase = phaseArg >= 0 ? parseInt(args[phaseArg + 1], 10) : 0;

  const phases = phase ? [phase] : [1, 2, 3, 4];

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  src/utils/ Directory Reorganization        ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log();

  let totalMoved = 0;
  let totalFilesModified = 0;
  let totalReplacements = 0;

  for (const p of phases) {
    const manifest = getManifestForPhase(p);
    const count = Object.keys(manifest).length;

    if (count === 0) {
      console.log(`Phase ${p}: No files to move. Skipping.`);
      continue;
    }

    console.log(`\n─── Phase ${p} ───`);
    console.log(`  ${count} files to move into ${PHASE_DIRS[p].length} directories`);
    console.log(`  Directories: ${PHASE_DIRS[p].join(', ')}`);

    // Step 1: Move files
    console.log('\n  Moving files...');
    const moved = await moveFiles(manifest);
    totalMoved += moved;

    // Step 2: Update imports
    console.log(`\n  Updating imports across codebase...`);
    const { filesScanned, filesModified, replacements } = await updateImports(manifest);
    totalFilesModified += filesModified;
    totalReplacements += replacements;

    console.log(`\n  Phase ${p} complete:`);
    console.log(`    Files moved: ${moved}`);
    console.log(`    Files scanned: ${filesScanned}`);
    console.log(`    Files modified: ${filesModified}`);
    console.log(`    Import replacements: ${replacements}`);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('  Reorganization complete!');
  console.log(`  Total files moved: ${totalMoved}`);
  console.log(`  Total files modified: ${totalFilesModified}`);
  console.log(`  Total import replacements: ${totalReplacements}`);
  console.log('═══════════════════════════════════════════════');
  console.log('\n  Next steps:');
  console.log('    1. Run: bun run typecheck');
  console.log('    2. Review: git diff --stat');
  console.log('    3. If OK, commit each phase');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
