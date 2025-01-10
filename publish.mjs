import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

async function getRegistryVersion(packageName) {
  const response = await fetch(`https://registry.npmjs.org/${packageName}`);
  if (!response.ok || response.status > 399) {
    return "";
  }

  const data = await response.json();
  return data["dist-tags"].latest;
}

async function main() {
  try {
    const projectRoot = process.argv.slice(2)[0];
    const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
    const { name, version } = packageJson;
    const registryVersion = await getRegistryVersion(name);

    if (!version) {
      return;
    }

    if (version !== registryVersion) {
      console.log(`Publishing new version: ${version}`);
      execSync("npm publish", { stdio: "inherit", cwd: projectRoot });
    } else {
      console.log(`Version ${version} is already published.`);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
