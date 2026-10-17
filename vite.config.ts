import { defineConfig } from 'vite';
import { execSync } from 'child_process';

function getGitStamp() {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    return { branch, hash };
  } catch {
    return { branch: 'main', hash: 'ca97ff0' };
  }
}

export default defineConfig(({ mode }) => {
  const { branch, hash } = getGitStamp();
  const time = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const stamp = `${branch}@${hash} | ${time} | ${mode}`;

  return {
    define: {
      __BUILD_STAMP__: JSON.stringify(stamp),
      __BUILD_BRANCH__: JSON.stringify(branch),
      __BUILD_HASH__: JSON.stringify(hash),
      __BUILD_TIME__: JSON.stringify(time),
      __BUILD_MODE__: JSON.stringify(mode),
    },
  };
});
