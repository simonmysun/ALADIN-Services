export type aggregateType = typeof aggregateTypes[number];
export const aggregateTypes = [
    'MAX',
    'MIN',
    'AVG',
    'COUNT',
    'SUM',
] as const;

export const invalidAggregationPatterns = /(_ID$|^ID_|-ID$|^ID-|_KEY$|^KEY_|-KEY$|^KEY-|_IMAGE$|^IMAGE_|-IMAGE$|^IMAGE-|_FILE$|^FILE_|-FILE$|^FILE-|_BLOB$|^BLOB_|-BLOB$|^BLOB-|_DATA$|^DATA_|-DATA$|^DATA-|_AT$|^AT_|-AT$|^AT-|_SYSTEM_|-SYSTEM-|^SYSTEM_|_META_|-META-|^META_|_LOG$|^LOG_|-LOG$|^LOG-|_FLAG$|^FLAG_|-FLAG$|^FLAG-|_STATUS$|^STATUS_|-STATUS$|^STATUS-|_IS_|-IS-|TEMP|TEST|DEBUG|(?<![a-zA-Z])Id(?![a-zA-Z])|(?<![a-zA-Z])Key(?![a-zA-Z])|(?<![a-zA-Z])Flag(?![a-zA-Z])|(?<![a-zA-Z])Status(?![a-zA-Z])|(?<![a-zA-Z])At(?![a-zA-Z])|\b[a-zA-Z]+(id|key)\b)/i;

export type joinType = typeof joinTypes[number];
export const joinTypes = [
    'LEFT JOIN',
    'FULL JOIN',
    'RIGHT JOIN',
    'CROSS JOIN',
    'INNER JOIN',
    'SELF JOIN'
] as const;

export const randomJoinTypes = [
    'LEFT JOIN',
    'FULL JOIN',
    'RIGHT JOIN',
    'INNER JOIN',
];

export const numericTypes = [
    'smallint',
    'integer',
    'bigint',
    'real',
    'double precision',
    'numeric',
    'decimal',
];

export const textTypes = [
    'char',
    'varchar',
    'text',
    'citext',
    'character varying',
    'character',
];

export const dateTypes = [
    'date',
    'time',
    'timetz',
    'timestamp',
    'timestamptz',
    'interval',
    'time without time zone',
    'time with time zone',
    'timestamp without time zone',
    'timestamp with time zone',
];

export const booleanTypes = ['boolean', 'bool'];

export const orderableTypes = [
    'bigint',
    'int8',
    'bigserial',
    'serial8',
    'bit',
    'bit varying',
    'varbit',
    'boolean',
    'bool',
    'box',
    'bytea',
    'character',
    'char',
    'character varying',
    'varchar',
    'cidr',
    'circle',
    'date',
    'double precision',
    'float8',
    'inet',
    'integer',
    'int',
    'int4',
    'interval',
    'json',
    'jsonb',
    'line',
    'lseg',
    'macaddr',
    'money',
    'numeric',
    'decimal',
    'path',
    'pg_lsn',
    'point',
    'polygon',
    'real',
    'float4',
    'smallint',
    'int2',
    'smallserial',
    'serial2',
    'serial',
    'serial4',
    'text',
    'time',
    'time without time zone',
    'time with time zone',
    'timestamp',
    'timestamp without time zone',
    'timestamp with time zone',
    'tsquery',
    'tsvector',
    'txid_snapshot',
    'uuid',
    'xml',
];

export const operationTypes = {
    "EQUAL": [...textTypes, ...numericTypes, ...dateTypes],
    "COMPARISON": [...textTypes, ...numericTypes, ...dateTypes],
    "IN": [...textTypes, ...numericTypes, ...dateTypes],
    "IS_NULL": [],
    "LIKE": [...textTypes],
    "BETWEEN": [...textTypes, ...numericTypes, ...dateTypes],
    "IS_BOOLEAN": [...booleanTypes],
};

export const operationColumnTypes = [
    ...textTypes,
    ...numericTypes,
    ...dateTypes,
    ...booleanTypes
];

export type operationType = keyof typeof operationTypes;

export const aggregateColumnType = [...numericTypes, ...textTypes, ...dateTypes];

export const aggregateByColumnTypes: Record<'numericTypes' | 'textTypes' | 'dateTypes', aggregateType[]> = {
    numericTypes: ['MAX', 'MIN', 'AVG', 'COUNT', 'SUM'],
    textTypes: ['MAX', 'MIN', 'COUNT'],
    dateTypes: ['MAX', 'MIN', 'COUNT'],
};
