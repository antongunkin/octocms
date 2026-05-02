import * as React from 'react';
import { cn } from '../../lib/utils';

type Person = {
  name?: string;
  initials: string;
  color: string;
};

type AvatarStackProps = {
  people: Person[];
  size?: number;
  className?: string;
};

export function AvatarStack({ people, size = 24, className }: AvatarStackProps) {
  return (
    <div className={cn('inline-flex items-center', className)}>
      {people.map((p, i) => (
        <div key={`${p.initials}-${i}`} style={{ marginLeft: i ? -7 : 0 }} title={p.name ?? p.initials}>
          <span
            className="inline-flex items-center justify-center rounded-full font-semibold text-white"
            style={{
              width: size,
              height: size,
              background: p.color,
              fontSize: size <= 22 ? 10 : size <= 28 ? 11.5 : 13,
              border: '2px solid var(--surface-1)',
              boxShadow: 'var(--shadow-1)',
            }}
          >
            {p.initials}
          </span>
        </div>
      ))}
    </div>
  );
}
