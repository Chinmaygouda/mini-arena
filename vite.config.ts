import { defineConfig } from 'vite';
import { execSync } from 'child_process';

function getGitStamp() {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    // Check for uncommitted changes (index or working tree)
    let dirty = false;
    try {
      const status = execSync('git status --porcelain').toString().trim();
      dirty = status.length > 0;
    } catch { /* ignore */ }
    return { branch, hash, dirty };
  } catch {
    return { branch: 'main', hash: 'unknown', dirty: false };
  }
}

export default defineConfig(({ mode }) => {
  const { branch, hash, dirty } = getGitStamp();
  const dirtyStr = dirty ? '-dirty' : '';
  const time = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const stamp = `${branch}@${hash}${dirtyStr} | ${time} | ${mode}`;

  return {
    define: {
      __BUILD_STAMP__: JSON.stringify(stamp),
      __BUILD_BRANCH__: JSON.stringify(branch),
      __BUILD_HASH__: JSON.stringify(hash),
      __BUILD_DIRTY__: JSON.stringify(dirty),
      __BUILD_TIME__: JSON.stringify(time),
      __BUILD_MODE__: JSON.stringify(mode),
    },
  };
});
