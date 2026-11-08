export interface AppDb {
  prepare(sql: string): Stmt;
  exec(sql: string): void;
  all<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]>;
  get<T = unknown>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  run(sql: string, ...params: unknown[]): Promise<{ changes: number; lastInsertRowid: number | bigint }>;
  first<T = unknown>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  values<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]>;
  raw<T = unknown>(sql: string, ...params: unknown[]): Promise<T>;
}

export interface Stmt {
  all<T = unknown>(...params: unknown[]): Promise<T[]>;
  get<T = unknown>(...params: unknown[]): Promise<T | undefined>;
  run(...params: unknown[]): Promise<{ changes: number; lastInsertRowid: number | bigint }>;
  first<T = unknown>(...params: unknown[]): Promise<T | undefined>;
  values<T = unknown>(...params: unknown[]): Promise<T[]>;
  raw<T = unknown>(...params: unknown[]): Promise<T>;
}
