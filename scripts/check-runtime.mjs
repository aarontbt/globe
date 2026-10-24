// The October 2026 security fixes require patched Node.js and Bun runtimes.
function isAtLeast(version, minimum) {
  const parts = version.split(".").map(Number);
  for (let i = 0; i < minimum.length; i++) {
    if (parts[i] !== minimum[i]) return parts[i] > minimum[i];
  }
  return true;
}

const bunVersion = process.versions.bun;
if (bunVersion) {
  if (!isAtLeast(bunVersion, [1, 4, 4])) {
    throw new Error(`Bun ${bunVersion} is vulnerable. Upgrade to Bun 1.4.4 or newer.`);
  }
} else if (Number(process.versions.node.split(".")[0]) !== 24 ||
           !isAtLeast(process.versions.node, [24, 22, 1])) {
  throw new Error(`Node.js ${process.versions.node} is unsupported. Run nvm install && nvm use (Node.js 24.22.1 or newer 24.x required).`);
}
