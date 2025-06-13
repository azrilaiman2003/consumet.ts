import { MANGA } from '../../src/providers';

jest.setTimeout(120000);

const mangahere = new MANGA.MangaHere();

test('returns a filled array of manga', async () => {
  const data = await mangahere.search('slime');
  expect(data.results).not.toEqual([]);
});

test('fetchHome: returns home page data with latest updates', async () => {
  const data = await mangahere.fetchHome();
  expect(data).toBeDefined();
  expect(data.latestUpdates).toBeDefined();
  expect(data.latestUpdates?.results).toBeDefined();

  // Check that latest updates contains valid manga entries
  if (data.latestUpdates?.results && data.latestUpdates.results.length > 0) {
    const firstResult = data.latestUpdates.results[0];
    expect(firstResult.id).toBeDefined();
    expect(firstResult.title).toBeDefined();
    expect(firstResult.headerForImage).toBeDefined();

    // Ensure title is not just a chapter reference like "Ch.032"
    expect(firstResult.title).not.toMatch(/^Ch\.\d+$/);

    // Ensure ID is not a chapter URL
    expect(firstResult.id).not.toMatch(/c\d+\/\d+\.html$/);

    console.log('Sample latest update entry:', {
      id: firstResult.id,
      title: firstResult.title,
      latestChapter: firstResult.latestChapter,
      updateTime: firstResult.updateTime,
      newChapterCount: firstResult.newChapterCount,
    });
  }
});
