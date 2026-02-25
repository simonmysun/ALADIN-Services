import { describe, it, expect, beforeEach } from 'vitest';
import { Parser } from 'node-sql-parser';
import { TemplateTaskDescriptionGenerationEngine } from '../../../src/generation/description/template-task-description-generation-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parser = new Parser();

/** Parse a SQL string and return a single AST node (never an array). */
function parse(sql: string) {
    const ast = parser.astify(sql, { database: 'PostgreSQL' });
    return Array.isArray(ast) ? ast[0] : ast;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TemplateTaskDescriptionGenerationEngine', () => {
    let engine: TemplateTaskDescriptionGenerationEngine;

    beforeEach(() => {
        engine = new TemplateTaskDescriptionGenerationEngine();
    });

    describe('generateTaskFromQuery', () => {

        it('returns a description for a simple SELECT * query', () => {
            const ast = parse('SELECT * FROM northwind.employees');
            const result = engine.generateTaskFromQuery(ast as any, 'northwind');
            expect(result).toBe(
                'Retrieve all information about the employees in the northwind database.'
            );
        });

        it('returns a description for a SELECT with named columns', () => {
            const ast = parse(
                'SELECT employees.first_name, employees.last_name FROM northwind.employees'
            );
            const result = engine.generateTaskFromQuery(ast as any, 'northwind');
            expect(result).toBe(
                'Retrieve the employees first name and the employees last name in the northwind database.'
            );
        });

        it('returns a description for a query with a WHERE clause', () => {
            const ast = parse(
                'SELECT * FROM northwind.products WHERE products.unit_price > 20'
            );
            const result = engine.generateTaskFromQuery(ast as any, 'northwind');
            expect(result).toBe(
                'Retrieve all information about the products in the northwind database.' +
                ' Filter the results where the products unit price is greater than 20.'
            );
        });

        it('returns a description for a query with GROUP BY and HAVING', () => {
            const ast = parse(
                'SELECT employees.region, COUNT(employees.employee_id)' +
                ' FROM northwind.employees' +
                ' GROUP BY employees.region' +
                ' HAVING COUNT(employees.employee_id) > 1'
            );
            const result = engine.generateTaskFromQuery(ast as any, 'northwind');
            expect(result).toBe(
                'Retrieve the employees region and the number of employee ids in the northwind database.' +
                ' Group the results based on the employees region.' +
                ' Filter the grouped results where the number of employee ids is greater than 1.'
            );
        });

        it('returns a description for a query with an INNER JOIN', () => {
            const ast = parse(
                'SELECT * FROM northwind.orders' +
                ' INNER JOIN northwind.order_details ON orders.order_id = order_details.order_id'
            );
            const result = engine.generateTaskFromQuery(ast as any, 'northwind');
            expect(result).toBe(
                'Retrieve all information about the following data combination in the northwind database.' +
                ' Combine the data from the orders table and the order details table.'
            );
        });

        it('returns a description for a query with a SELF JOIN', () => {
            // Both sides of the join reference the same table (employees).
            // The alias map (e1 → employees, e2 → employees) ensures column
            // references are rendered with the real table name, not the alias.
            const ast = parse(
                'SELECT e1.first_name, e2.first_name' +
                ' FROM northwind.employees e1' +
                ' INNER JOIN northwind.employees e2 ON e1.reports_to = e2.employee_id'
            );
            const result = engine.generateTaskFromQuery(ast as any, 'northwind');
            expect(result).toBe(
                'Retrieve the employees first name and the employees first name from the following data combination in the northwind database.' +
                ' Match records within the employees table where the employees reports to equals the employees employee id.'
            );
        });

        it('returns a description for a query with aggregate functions', () => {
            const ast = parse(
                'SELECT AVG(products.unit_price), MAX(products.units_in_stock)' +
                ' FROM northwind.products'
            );
            const result = engine.generateTaskFromQuery(ast as any, 'northwind');
            expect(result).toBe(
                'Retrieve the average of unit prices and the maximum units in stock in the northwind database.'
            );
        });

        it('returns a description for a query with ORDER BY', () => {
            const ast = parse(
                'SELECT * FROM northwind.products ORDER BY products.unit_price ASC'
            );
            const result = engine.generateTaskFromQuery(ast as any, 'northwind');
            expect(result).toBe(
                'Retrieve all information about the products in the northwind database.' +
                ' Sort the results by the products unit price in ascending order.'
            );
        });

    });
});
