type ParsedVersion = {
  numbers: number[];
  prerelease: string[];
};

/**
 * Zerlegt "1.2.3-beta.4" in Nummern [1, 2, 3] und Vorab-Kennzeichen
 * ["beta", "4"]. Ein führendes "v" wird ignoriert, nicht-numerische
 * Nummernteile zählen als 0.
 */
const parseVersion = (version: string): ParsedVersion => {
  const [core = "", prerelease = ""] = version
    .trim()
    .replace(/^v/u, "")
    .split("-", 2);
  return {
    numbers: core.split(".").map((part) => Number.parseInt(part, 10) || 0),
    prerelease: prerelease ? prerelease.split(".") : [],
  };
};

/**
 * Vergleich zweier Vorab-Kennzeichen nach Semver: je Stelle numerisch,
 * wenn beide Zahlen sind, sonst alphabetisch (damit alpha < beta < rc);
 * Zahlen vor Text; die kürzere Liste ist kleiner.
 */
const comparePrerelease = (a: string[], b: string[]): number => {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) {
    const left = a[index];
    const right = b[index];

    if (left === undefined) {
      return -1;
    }

    if (right === undefined) {
      return 1;
    }

    const leftNumber = /^\d+$/u.test(left) ? Number(left) : null;
    const rightNumber = /^\d+$/u.test(right) ? Number(right) : null;

    if (leftNumber !== null && rightNumber !== null) {
      if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }
    } else if (leftNumber !== null) {
      return -1;
    } else if (rightNumber !== null) {
      return 1;
    } else if (left !== right) {
      return left < right ? -1 : 1;
    }
  }

  return 0;
};

/**
 * Semver-Vergleich: < 0 wenn a kleiner, 0 gleich, > 0 wenn a größer.
 * Fehlende Nummernstellen gelten als 0; eine Vorabversion ist kleiner als
 * die gleiche Nummer ohne Kennzeichen ("1.0.0-beta.1" < "1.0.0").
 */
export const compareVersions = (a: string, b: string): number => {
  const left = parseVersion(a);
  const right = parseVersion(b);

  const length = Math.max(left.numbers.length, right.numbers.length);

  for (let index = 0; index < length; index++) {
    const difference = (left.numbers[index] ?? 0) - (right.numbers[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return right.prerelease.length - left.prerelease.length;
  }

  return comparePrerelease(left.prerelease, right.prerelease);
};

/**
 * True, wenn die Version ein Vorab-Kennzeichen trägt ("2026.1.0-beta.1").
 * Daran hängt der Kanal der Versionsprüfung: wer eine Vorabversion nutzt,
 * bekommt auch die nächste angeboten.
 */
export const isPrerelease = (version: string): boolean =>
  parseVersion(version).prerelease.length > 0;

/**
 * True, wenn `candidate` eine höhere Version als `current` ist.
 */
export const isNewerVersion = (candidate: string, current: string): boolean =>
  compareVersions(candidate, current) > 0;
