/**
 * pg-mem factory for unit tests.
 *
 * Provides a single `createTestDb()` function that:
 *  1. Creates a new in-memory pg-mem instance.
 *  2. Creates a "northwind" search schema (via SET search_path).
 *  3. Applies a representative subset of the Northwind schema (tables, columns,
 *     foreign keys) so that the full TypeORM / query-runner surface area can be
 *     exercised without a real Postgres server.
 *  4. Seeds the tables with a small, predictable dataset.
 *  5. Takes a restore-point so individual tests can call `backup.restore()`
 *     to roll back to a clean state without re-running DDL.
 *  6. Returns both the raw pg-mem IMemoryDb and a TypeORM DataSource wired to
 *     it via pg-mem's built-in TypeORM adapter.
 *
 * Usage in a test file:
 *
 *   import { createTestDb } from '../helpers/pg-mem-factory';
 *
 *   let db: IMemoryDb;
 *   let backup: IBackup;
 *   let dataSource: DataSource;
 *
 *   beforeAll(async () => {
 *     ({ db, backup, dataSource } = await createTestDb());
 *   });
 *
 *   beforeEach(() => backup.restore());
 *
 *   afterAll(async () => dataSource.destroy());
 */

import { newDb, IMemoryDb, IBackup, DataType } from 'pg-mem';
import { DataSource } from 'typeorm';

export interface TestDb {
    /** The pg-mem in-memory database instance. Use this to run raw SQL or inspect tables. */
    db: IMemoryDb;
    /**
     * A restore point taken after schema creation and seeding.
     * Call `backup.restore()` in `beforeEach` to reset data between tests.
     */
    backup: IBackup;
    /**
     * A TypeORM DataSource already initialised against the in-memory database.
     * Use this wherever production code accepts a DataSource.
     */
    dataSource: DataSource;
}

// ---------------------------------------------------------------------------
// DDL — representative Northwind schema
// ---------------------------------------------------------------------------

const DDL = /* sql */ `
-- pg-mem works with the "public" schema by default.
-- We model the "northwind" schema by using a separate schema.
CREATE SCHEMA IF NOT EXISTS northwind;
SET search_path TO northwind, public;

CREATE TABLE northwind.categories (
    category_id   SERIAL PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL,
    description   TEXT
);

CREATE TABLE northwind.suppliers (
    supplier_id   SERIAL PRIMARY KEY,
    company_name  VARCHAR(100) NOT NULL,
    country       VARCHAR(50)
);

CREATE TABLE northwind.products (
    product_id        SERIAL PRIMARY KEY,
    product_name      VARCHAR(100) NOT NULL,
    supplier_id       INTEGER REFERENCES northwind.suppliers(supplier_id),
    category_id       INTEGER REFERENCES northwind.categories(category_id),
    unit_price        NUMERIC(10, 2),
    units_in_stock    INTEGER,
    discontinued      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE northwind.region (
    region_id          SERIAL PRIMARY KEY,
    region_description VARCHAR(50) NOT NULL
);

CREATE TABLE northwind.territories (
    territory_id          VARCHAR(20) PRIMARY KEY,
    territory_description VARCHAR(50) NOT NULL,
    region_id             INTEGER NOT NULL REFERENCES northwind.region(region_id)
);

CREATE TABLE northwind.employees (
    employee_id  SERIAL PRIMARY KEY,
    last_name    VARCHAR(50) NOT NULL,
    first_name   VARCHAR(50) NOT NULL,
    title        VARCHAR(50),
    reports_to   INTEGER REFERENCES northwind.employees(employee_id),
    region       VARCHAR(50),
    postal_code  VARCHAR(10)
);

CREATE TABLE northwind.employee_territories (
    employee_id  INTEGER NOT NULL REFERENCES northwind.employees(employee_id),
    territory_id VARCHAR(20) NOT NULL REFERENCES northwind.territories(territory_id),
    PRIMARY KEY (employee_id, territory_id)
);

CREATE TABLE northwind.customers (
    customer_id   VARCHAR(10) PRIMARY KEY,
    company_name  VARCHAR(100) NOT NULL,
    country       VARCHAR(50)
);

CREATE TABLE northwind.orders (
    order_id     SERIAL PRIMARY KEY,
    customer_id  VARCHAR(10) REFERENCES northwind.customers(customer_id),
    employee_id  INTEGER REFERENCES northwind.employees(employee_id),
    order_date   DATE,
    freight      NUMERIC(10, 2)
);

CREATE TABLE northwind.order_details (
    order_id    INTEGER NOT NULL REFERENCES northwind.orders(order_id),
    product_id  INTEGER NOT NULL REFERENCES northwind.products(product_id),
    unit_price  NUMERIC(10, 2) NOT NULL,
    quantity    SMALLINT NOT NULL,
    discount    REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (order_id, product_id)
);
`;

// ---------------------------------------------------------------------------
// DML — small predictable seed dataset
// ---------------------------------------------------------------------------

const SEED = /* sql */ `
INSERT INTO northwind.categories (category_id, category_name, description) VALUES
    (1, 'Beverages',   'Soft drinks, coffees, teas'),
    (2, 'Condiments',  'Sweet and savory sauces'),
    (3, 'Confections', 'Desserts, candies, breads');

INSERT INTO northwind.suppliers (supplier_id, company_name, country) VALUES
    (1, 'Exotic Liquids',         'UK'),
    (2, 'New Orleans Cajun',      'USA'),
    (3, 'Grandma Kellys Homestead', 'USA');

INSERT INTO northwind.products (product_id, product_name, supplier_id, category_id, unit_price, units_in_stock, discontinued) VALUES
    (1, 'Chai',            1, 1, 18.00,  39, FALSE),
    (2, 'Chang',           1, 1, 19.00,  17, FALSE),
    (3, 'Aniseed Syrup',   1, 2,  10.00, 13, FALSE),
    (4, 'Chef Anton Mix',  2, 2, 22.00,  53, TRUE),
    (5, 'Grandma Boysenberry', 3, 2, 25.00, 120, FALSE);

INSERT INTO northwind.region (region_id, region_description) VALUES
    (1, 'Eastern'),
    (2, 'Western'),
    (3, 'Northern'),
    (4, 'Southern');

INSERT INTO northwind.territories (territory_id, territory_description, region_id) VALUES
    ('01581', 'Westboro',      1),
    ('01730', 'Bedford',       1),
    ('01833', 'Georgetown',    3),
    ('02116', 'Boston',        1),
    ('02139', 'Cambridge',     1);

INSERT INTO northwind.employees (employee_id, last_name, first_name, title, reports_to, region, postal_code) VALUES
    (1, 'Davolio',  'Nancy',  'Sales Representative',  NULL, 'WA',   '98122'),
    (2, 'Fuller',   'Andrew', 'Vice President Sales',  NULL, 'WA',   '98401'),
    (3, 'Leverling','Janet',  'Sales Representative',  2,    'WA',   '98033'),
    (4, 'Peacock',  'Margaret','Sales Representative', 2,    'WA',   '98052');

INSERT INTO northwind.employee_territories (employee_id, territory_id) VALUES
    (1, '01581'),
    (1, '01730'),
    (2, '02116'),
    (3, '01833'),
    (4, '02139');

INSERT INTO northwind.customers (customer_id, company_name, country) VALUES
    ('ALFKI', 'Alfreds Futterkiste',  'Germany'),
    ('ANATR', 'Ana Trujillo',         'Mexico'),
    ('BONAP', 'Bon app',              'France');

INSERT INTO northwind.orders (order_id, customer_id, employee_id, order_date, freight) VALUES
    (10248, 'ALFKI', 1, '1996-07-04', 32.38),
    (10249, 'ANATR', 3, '1996-07-05', 11.61),
    (10250, 'BONAP', 4, '1996-07-08', 65.83);

INSERT INTO northwind.order_details (order_id, product_id, unit_price, quantity, discount) VALUES
    (10248, 1, 14.00, 12, 0),
    (10248, 2, 9.80,  10, 0),
    (10249, 3, 34.80,  9, 0),
    (10250, 4, 42.40, 35, 0.15),
    (10250, 5, 7.70,  15, 0.15);
`;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a fully initialised in-memory Postgres database with the Northwind
 * schema and a small seed dataset. Returns the pg-mem instance, a restore
 * point, and a TypeORM DataSource already connected to it.
 *
 * @example
 * const { db, backup, dataSource } = await createTestDb();
 * // run raw SQL:
 * const rows = db.public.many('SELECT * FROM northwind.products');
 * // or use TypeORM:
 * const result = await dataSource.query('SELECT * FROM northwind.products');
 */
export async function createTestDb(): Promise<TestDb> {
    const db = newDb();

    // Register the uuid-ossp extension so queries using uuid_generate_v4() don't fail.
    db.registerExtension('uuid-ossp', (schema) => {
        schema.registerFunction({
            name: 'uuid_generate_v4',
            returns: { type: 'text' } as any,
            implementation: () => crypto.randomUUID(),
            impure: true,
        });
    });

    // TypeORM calls current_database() and version() during DataSource.initialize().
    // pg-mem does not implement these by default — register stubs so the adapter works.
    db.public.registerFunction({
        name: 'current_database',
        returns: DataType.text,
        implementation: () => 'pg_mem',
    });
    db.public.registerFunction({
        name: 'version',
        returns: DataType.text,
        implementation: () => 'PostgreSQL 14.0 (pg-mem)',
    });

    // Apply schema and seed data directly on the pg-mem public schema object.
    // DDL + DML are executed as a single batch to avoid inter-statement ordering issues.
    db.public.none(DDL);
    db.public.none(SEED);

    // Take a restore point AFTER schema + seed so every test starts from a
    // known, consistent state without re-running expensive DDL.
    const backup = db.backup();

    // Create a TypeORM DataSource using pg-mem's built-in adapter.
    // The adapter returns an already-initialised DataSource; no need to call
    // .initialize() on it again.
    const dataSource: DataSource = await db.adapters.createTypeormDataSource({
        type: 'postgres',
        // No entities are registered — we rely on raw SQL queries, mirroring
        // how the production code uses TypeORM (query runners, not repositories).
    });
    await dataSource.initialize();

    return { db, backup, dataSource };
}
