import { v7 as uuidv7 } from 'uuid';

/** Time-ordered UUIDv7 for every primary key (docs/D1 §5). */
export function newId(): string {
  return uuidv7();
}
