import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGamesByFilters,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

/** Seeds two categories, two publishers, and one game for each category/publisher pair. */
async function seedFilterFixture(db: Database): Promise<{
    strategyId: number;
    puzzleId: number;
    pubOneId: number;
    pubTwoId: number;
}> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id });
    const [pubOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });
    const [pubTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'pub' })
        .returning({ id: publishers.id });

    const combos = [
        { title: 'Strategy Pub One', categoryId: strategy.id, publisherId: pubOne.id },
        { title: 'Strategy Pub Two', categoryId: strategy.id, publisherId: pubTwo.id },
        { title: 'Puzzle Pub One', categoryId: puzzle.id, publisherId: pubOne.id },
        { title: 'Puzzle Pub Two', categoryId: puzzle.id, publisherId: pubTwo.id },
    ];
    for (const combo of combos) {
        await db.insert(games).values({
            title: combo.title,
            description: `Description for ${combo.title}`,
            starRating: 4.0,
            categoryId: combo.categoryId,
            publisherId: combo.publisherId,
        });
    }

    return {
        strategyId: strategy.id,
        puzzleId: puzzle.id,
        pubOneId: pubOne.id,
        pubTwoId: pubTwo.id,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});

describe('getGamesByFilters', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title when no filters are given', async () => {
        await seedFilterFixture(db);
        const all = await getGamesByFilters(db, {});
        expect(all.map((g) => g.title)).toEqual([
            'Puzzle Pub One',
            'Puzzle Pub Two',
            'Strategy Pub One',
            'Strategy Pub Two',
        ]);
    });

    it('filters by a single category', async () => {
        const { strategyId } = await seedFilterFixture(db);
        const filtered = await getGamesByFilters(db, { categoryIds: [strategyId] });
        expect(filtered.map((g) => g.title)).toEqual(['Strategy Pub One', 'Strategy Pub Two']);
    });

    it('filters by a single publisher', async () => {
        const { pubOneId } = await seedFilterFixture(db);
        const filtered = await getGamesByFilters(db, { publisherIds: [pubOneId] });
        expect(filtered.map((g) => g.title)).toEqual(['Puzzle Pub One', 'Strategy Pub One']);
    });

    it('combines category and publisher filters with AND', async () => {
        const { strategyId, pubOneId } = await seedFilterFixture(db);
        const filtered = await getGamesByFilters(db, {
            categoryIds: [strategyId],
            publisherIds: [pubOneId],
        });
        expect(filtered.map((g) => g.title)).toEqual(['Strategy Pub One']);
    });

    it('applies OR logic across multiple ids within the same filter group', async () => {
        const { strategyId, puzzleId } = await seedFilterFixture(db);
        const filtered = await getGamesByFilters(db, { categoryIds: [strategyId, puzzleId] });
        expect(filtered).toHaveLength(4);
    });

    it('returns an empty array when no games match the filters', async () => {
        const { strategyId } = await seedFilterFixture(db);
        const otherPublisher = await db
            .insert(publishers)
            .values({ name: 'Unused Publisher', description: 'pub' })
            .returning({ id: publishers.id });
        const filtered = await getGamesByFilters(db, {
            categoryIds: [strategyId],
            publisherIds: [otherPublisher[0].id],
        });
        expect(filtered).toEqual([]);
    });

    it('treats empty filter arrays the same as omitted filters', async () => {
        await seedFilterFixture(db);
        const filtered = await getGamesByFilters(db, { categoryIds: [], publisherIds: [] });
        expect(filtered).toHaveLength(4);
    });
});
