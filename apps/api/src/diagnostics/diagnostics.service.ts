import { detectDialect } from "@einfachvermieter/db";
import {
  createTranslate,
  type I18nInstance,
  type TranslateFn,
} from "@einfachvermieter/i18n";
import {
  reportFileStamp,
  reportSection,
} from "@einfachvermieter/shared/diagnostics";
import { Inject, Injectable } from "@nestjs/common";
import { I18N } from "../i18n/i18n.module.js";
import { appPlatform, currentAppVersion } from "../updates/app-version.js";
import { readApiLogTails } from "./api-log.js";

/**
 * Fehlerbericht als Klartext
 */
@Injectable()
export class DiagnosticsService {
  private readonly t: TranslateFn;

  constructor(@Inject(I18N) i18n: I18nInstance) {
    this.t = createTranslate(i18n);
  }

  fileName(): string {
    return this.t("report.fileName", { stamp: reportFileStamp(new Date()) });
  }

  buildReport(): string {
    const startedAt = new Date(Date.now() - process.uptime() * 1000);
    const logs = readApiLogTails();

    const lines = [
      this.t("report.heading"),
      this.t("report.createdAt", {
        value: new Date().toLocaleString("de-DE"),
      }),
      this.t("report.version", { value: currentAppVersion }),
      this.t("report.platform", { value: appPlatform }),
      this.t("report.system", {
        os: process.platform,
        arch: process.arch,
        runtime: `Node ${process.versions.node}`,
      }),
      this.t("report.database", { value: detectDialect() }),
      this.t("report.startedAt", { value: startedAt.toLocaleString("de-DE") }),
      ...reportSection(
        this.t("report.logSection"),
        logs.current ?? this.t("report.logMissing"),
      ),
    ];

    if (logs.previous) {
      lines.push(
        ...reportSection(this.t("report.previousLogSection"), logs.previous),
      );
    }

    return `${lines.join("\n")}\n`;
  }
}
