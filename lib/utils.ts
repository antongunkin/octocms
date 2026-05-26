type ClassDictionary = Record<string, unknown>;
type ClassArray = ClassValue[];

export type ClassValue = string | number | boolean | null | undefined | ClassDictionary | ClassArray;

function collectClassNames(value: ClassValue, target: string[]): void {
  if (!value) {
    return;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    target.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectClassNames(item, target);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const key in value) {
      if (value[key]) {
        target.push(key);
      }
    }
  }
}

export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  for (const input of inputs) {
    collectClassNames(input, classes);
  }
  return classes.join(' ');
}
