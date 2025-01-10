import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

async function getRegistryVersions(packageName) {
  const response = await fetch(`https://registry.npmjs.org/${packageName}`);
  if (!response.ok || response.status > 399) {
    return "";
  }

  const data = await response.json();
  return Object.keys(data.versions);
}

async function main() {
  try {
    const projectRoot = process.argv.slice(2)[0];
    const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
    const { name, version } = packageJson;

    if (!version) {
      return;
    }

    const registryVersions = await getRegistryVersions(name);

    if (registryVersions.includes(version)) {
      console.log(`Version ${version} is already published.`);
      return;
    }

    console.log(`Publishing new version: ${version}`);
    execSync(`cp .npmignore ${projectRoot}/`);
    execSync("pnpm publish --git-checks false --access public", { stdio: "inherit", cwd: projectRoot });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
