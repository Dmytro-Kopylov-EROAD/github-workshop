import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories } from '../../db/schema';
import type { Database } from './db';
import { getAllCategories } from './categories';

describe('getAllCategories', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all categories ordered by name', async () => {
        await db.insert(categories).values([
            { name: 'Strategy', description: 'cat' },
            { name: 'Adventure', description: 'cat' },
        ]);
        const all = await getAllCategories(db);
        expect(all.map((c) => c.name)).toEqual(['Adventure', 'Strategy']);
    });

    it('returns an empty array when there are no categories', async () => {
        expect(await getAllCategories(db)).toEqual([]);
    });
});
