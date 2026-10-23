/** @jest-environment node */
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => require('../test-utils/dbState').state.current,
}));

import { setupFreshDb } from '../test-utils/setupDb';
import { addCategory, getAllCategories, renameCategory } from '../db/categories';

beforeEach(async () => {
  await setupFreshDb();
});

describe('renameCategory', () => {
  it('renames a custom category', async () => {
    const id = await addCategory('Gym', 'barbell');
    await renameCategory(id, '  Fitness  ');
    expect((await getAllCategories()).map((c) => c.name)).toContain('Fitness');
  });

  it('refuses empty names, duplicates (any letter case) and default categories', async () => {
    const id = await addCategory('Gym', 'barbell');
    await expect(renameCategory(id, '   ')).rejects.toThrow('empty');
    await expect(renameCategory(id, 'food')).rejects.toThrow('already exists'); // "Food" is a default
    await expect(renameCategory(1, 'Meals')).rejects.toThrow('Default categories cannot be renamed');
    await expect(renameCategory(999, 'x')).rejects.toThrow('not found');
  });

  it('allows keeping the same name with different letter case', async () => {
    const id = await addCategory('Gym', 'barbell');
    await expect(renameCategory(id, 'GYM')).resolves.toBeUndefined();
  });
});
