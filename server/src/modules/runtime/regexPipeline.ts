import { getDb } from '../../db';

export type RegexPlacement = 'input' | 'output' | 'both';

export type RegexRule = {
  name: string;
  regex: string;
  substitute: string | Record<string, string>;
  placement: RegexPlacement;
  enabled: boolean;
  order: number;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function normalizeSubstituteObject(substitute: Record<string, unknown>): Record<string, string> {
  return Object.entries(substitute).reduce<Record<string, string>>((acc, [key, val]) => {
    if (typeof val === 'string') {
      acc[key] = val;
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      acc[key] = String(val);
    }
    return acc;
  }, {});
}

/**
 * Regex substitute 策略：
 * - 字符串：整段作为 RegExp.replace 的替换串（支持 $1 等反向引用）。
 * - 对象：按「完整匹配」查表；若无则试小写键；再否则用 __default；皆无则保留原匹配文本。
 */
export async function loadRegexRules(regexRulesetId: number | null): Promise<RegexRule[]> {
  if (!regexRulesetId) return [];
  const database = await getDb();
  const stmt = database.prepare('SELECT data FROM regex_rulesets WHERE id = ? LIMIT 1');
  stmt.bind([regexRulesetId]);

  let row: Record<string, unknown> | null = null;
  if (stmt.step()) {
    row = stmt.getAsObject() as Record<string, unknown>;
  }
  stmt.free();

  if (!row?.data) return [];

  try {
    const parsed = JSON.parse(String(row.data)) as Record<string, unknown>;
    const list = Array.isArray(parsed.rules) ? parsed.rules : [];
    return list
      .map((item, idx) => {
        const raw = asObject(item) ?? {};
        const substituteRaw = raw.substitute;
        let substitute: string | Record<string, string> = '';
        if (typeof substituteRaw === 'string') {
          substitute = substituteRaw;
        } else if (asObject(substituteRaw)) {
          substitute = normalizeSubstituteObject(asObject(substituteRaw)!);
        }

        const placementRaw = String(raw.placement ?? 'both');
        const placement: RegexPlacement =
          placementRaw === 'input' || placementRaw === 'output' || placementRaw === 'both'
            ? placementRaw
            : 'both';

        return {
          name: asString(raw.name) || `rule_${idx + 1}`,
          regex: asString(raw.regex),
          substitute,
          placement,
          enabled: raw.enabled !== false,
          order: Number(raw.order ?? idx),
        } as RegexRule;
      })
      .filter((r) => r.regex.trim().length > 0)
      .sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

export function applyRegexRules(options: {
  text: string;
  rules: RegexRule[];
  placement: 'input' | 'output';
}): { text: string; appliedRules: string[] } {
  const appliedNames: string[] = [];
  let currentText = options.text;

  for (const rule of options.rules) {
    if (!rule.enabled) continue;
    if (!(rule.placement === options.placement || rule.placement === 'both')) continue;

    let regex: RegExp;
    try {
      regex = new RegExp(rule.regex, 'g');
    } catch {
      continue;
    }

    if (typeof rule.substitute === 'string') {
      const next = currentText.replace(regex, rule.substitute);
      if (next !== currentText) {
        appliedNames.push(rule.name);
        currentText = next;
      }
      continue;
    }

    const mapping = rule.substitute;
    const fallback = mapping.__default ?? '';
    const next = currentText.replace(regex, (match) => {
      if (Object.prototype.hasOwnProperty.call(mapping, match)) {
        return mapping[match];
      }
      if (Object.prototype.hasOwnProperty.call(mapping, match.toLowerCase())) {
        return mapping[match.toLowerCase()];
      }
      return fallback || match;
    });

    if (next !== currentText) {
      appliedNames.push(rule.name);
      currentText = next;
    }
  }

  return {
    text: currentText,
    appliedRules: appliedNames,
  };
}
