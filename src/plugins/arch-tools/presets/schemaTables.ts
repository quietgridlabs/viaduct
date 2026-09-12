import type { TableColumn } from '@/types/c4Extensions';

export type SchemaTablePreset = {
  id: string;
  label: string;
  description: string;
  name: string;
  columns: Omit<TableColumn, 'id'>[];
};

export const SCHEMA_TABLE_PRESETS: SchemaTablePreset[] = [
  {
    id: 'users-table',
    label: 'users',
    description: 'id, email, created_at',
    name: 'users',
    columns: [
      { name: 'id', dataType: 'uuid', primaryKey: true, nullable: false },
      { name: 'email', dataType: 'text', nullable: false },
      { name: 'created_at', dataType: 'timestamptz', nullable: false },
    ],
  },
  {
    id: 'orders-table',
    label: 'orders',
    description: 'id, user_id, total, created_at',
    name: 'orders',
    columns: [
      { name: 'id', dataType: 'uuid', primaryKey: true, nullable: false },
      { name: 'user_id', dataType: 'uuid', nullable: false },
      { name: 'total', dataType: 'numeric', nullable: false },
      { name: 'created_at', dataType: 'timestamptz', nullable: false },
    ],
  },
];

export function columnsWithIds(
  cols: Omit<TableColumn, 'id'>[]
): TableColumn[] {
  return cols.map((c) => ({ ...c, id: crypto.randomUUID() }));
}

export function defaultIdColumn(): TableColumn {
  return {
    id: crypto.randomUUID(),
    name: 'id',
    dataType: 'uuid',
    primaryKey: true,
    nullable: false,
  };
}
