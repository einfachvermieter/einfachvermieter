"use strict";

const { execSync } = require("node:child_process");
const { join } = require("node:path");

/**
 * Ad-hoc-Signatur für unsignierte Builds (@TODO: ersetzen durch echte
 * Developer-ID-Signierung + Notarisierung). Ohne diese Signatur deckt die
 * Linker-Signatur des Electron-Binärs das modifizierte Bundle nicht mehr ab.
 */
module.exports = (context) => {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  const appPath = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  execSync(`codesign --force --deep --sign - "${appPath}"`, {
    stdio: "inherit",
  });
};
