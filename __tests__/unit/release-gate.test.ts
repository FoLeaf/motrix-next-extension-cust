import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname ?? '.', '..', '..');

describe('release tooling', () => {
  it('runs production builds and zip packaging before tagging', () => {
    const script = readFileSync(resolve(root, 'scripts', 'release.sh'), 'utf-8');

    expect(script).toContain('pnpm build ||');
    expect(script).toContain('pnpm build:firefox ||');
    expect(script).toContain('pnpm zip ||');
    expect(script).toContain('pnpm zip:firefox ||');
  });

  it('declares the Vitest coverage provider dependency', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8')) as {
      devDependencies?: Record<string, string>;
    };

    expect(pkg.devDependencies).toHaveProperty('@vitest/coverage-v8');
  });
});
