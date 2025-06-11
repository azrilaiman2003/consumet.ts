import { load } from 'cheerio';

import { MangaParser, ISearch, IMangaInfo, IMangaResult, MediaStatus, IMangaChapterPage } from '../../models';

interface IMangaHereEnhancedResult extends IMangaResult {
  rank?: number;
  views?: string;
  genres?: string[];
  author?: string;
  mangaRank?: string;
  summary?: string;
  updateTime?: string; // e.g., "8 hour ago"
  newChapterCount?: string; // e.g., "18 New Chapter"
}

interface IMangaHereHomeSection {
  results: IMangaHereEnhancedResult[];
  moreUrl?: string;
}

interface IMangaHereHome {
  hotMangaReleases: IMangaHereHomeSection;
  popularMangaRanking: IMangaHereHomeSection;
  beingReadRightNow: IMangaHereHomeSection;
  recommended?: IMangaHereHomeSection;
  newMangaRelease?: IMangaHereHomeSection;
  trendingManga?: IMangaHereHomeSection;
  latestUpdates?: IMangaHereHomeSection;
}

class MangaHere extends MangaParser {
  override readonly name = 'MangaHere';
  protected override baseUrl = 'http://www.mangahere.cc';
  protected override logo = 'https://i.pinimg.com/564x/51/08/62/51086247ed16ff8abae2df0bb06448e4.jpg';
  protected override classPath = 'MANGA.MangaHere';

  override fetchMangaInfo = async (mangaId: string): Promise<IMangaInfo> => {
    const mangaInfo: IMangaInfo = {
      id: mangaId,
      title: '',
    };
    try {
      const { data } = await this.client.get(`${this.baseUrl}/manga/${mangaId}`, {
        headers: {
          cookie: 'isAdult=1',
        },
      });

      const $ = load(data);

      mangaInfo.title = $('span.detail-info-right-title-font').text();
      mangaInfo.description = $('div.detail-info-right > p.fullcontent').text();
      mangaInfo.headers = { Referer: this.baseUrl };
      mangaInfo.image = $('div.detail-info-cover > img').attr('src');
      mangaInfo.genres = $('p.detail-info-right-tag-list > a')
        .map((i, el) => $(el).attr('title')?.trim())
        .get();
      switch ($('span.detail-info-right-title-tip').text()) {
        case 'Ongoing':
          mangaInfo.status = MediaStatus.ONGOING;
          break;
        case 'Completed':
          mangaInfo.status = MediaStatus.COMPLETED;
          break;
        default:
          mangaInfo.status = MediaStatus.UNKNOWN;
          break;
      }
      mangaInfo.rating = parseFloat($('span.detail-info-right-title-star > span').last().text());
      mangaInfo.authors = $('p.detail-info-right-say > a')
        .map((i, el) => $(el).attr('title'))
        .get();
      mangaInfo.chapters = $('ul.detail-main-list > li')
        .map((i, el) => ({
          id: $(el).find('a').attr('href')?.split('/manga/')[1].slice(0, -7)!,
          title: $(el).find('a > div > p.title3').text(),
          releasedDate: $(el).find('a > div > p.title2').text().trim(),
        }))
        .get();

      return mangaInfo;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override fetchChapterPages = async (chapterId: string): Promise<IMangaChapterPage[]> => {
    const chapterPages: IMangaChapterPage[] = [];
    const url = `${this.baseUrl}/manga/${chapterId}/1.html`;

    try {
      const { data } = await this.client.get(url, {
        headers: {
          cookie: 'isAdult=1',
        },
      });

      const $ = load(data);

      const copyrightHandle =
        $('p.detail-block-content').text().match('Dear user') ||
        $('p.detail-block-content').text().match('blocked');
      if (copyrightHandle) {
        throw Error(copyrightHandle.input?.trim());
      }

      const bar = $('script[src*=chapter_bar]').data();
      const html = $.html();
      if (typeof bar !== 'undefined') {
        const ss = html.indexOf('eval(function(p,a,c,k,e,d)');
        const se = html.indexOf('</script>', ss);
        const s = html.substring(ss, se).replace('eval', '');
        const ds = eval(s) as string;

        const urls = ds.split("['")[1].split("']")[0].split("','");

        urls.map((url, i) =>
          chapterPages.push({
            page: i,
            img: `https:${url}`,
            headerForImage: { Referer: url },
          })
        );
      } else {
        let sKey = this.extractKey(html);
        const chapterIdsl = html.indexOf('chapterid');
        const chapterId = html.substring(chapterIdsl + 11, html.indexOf(';', chapterIdsl)).trim();

        const chapterPagesElmnt = $('body > div:nth-child(6) > div > span').children('a');

        const pages = parseInt(chapterPagesElmnt.last().prev().attr('data-page') ?? '0');

        const pageBase = url.substring(0, url.lastIndexOf('/'));

        let resText = '';
        for (let i = 1; i <= pages; i++) {
          const pageLink = `${pageBase}/chapterfun.ashx?cid=${chapterId}&page=${i}&key=${sKey}`;

          for (let j = 1; j <= 3; j++) {
            const { data } = await this.client.get(pageLink, {
              headers: {
                Referer: url,
                'X-Requested-With': 'XMLHttpRequest',
                cookie: 'isAdult=1',
              },
            });

            resText = data as string;

            if (resText) break;
            else sKey = '';
          }

          const ds = eval(resText.replace('eval', ''));

          const baseLinksp = ds.indexOf('pix=') + 5;
          const baseLinkes = ds.indexOf(';', baseLinksp) - 1;
          const baseLink = ds.substring(baseLinksp, baseLinkes);

          const imageLinksp = ds.indexOf('pvalue=') + 9;
          const imageLinkes = ds.indexOf('"', imageLinksp);
          const imageLink = ds.substring(imageLinksp, imageLinkes);

          chapterPages.push({
            page: i - 1,
            img: `https:${baseLink}${imageLink}`,
            headerForImage: { Referer: url },
          });
        }
      }
      return chapterPages;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override search = async (query: string, page: number = 1): Promise<ISearch<IMangaResult>> => {
    const searchRes: ISearch<IMangaResult> = {
      currentPage: page,
      results: [],
    };
    try {
      const { data } = await this.client.get(`${this.baseUrl}/search?title=${query}&page=${page}`);
      const $ = load(data);

      searchRes.hasNextPage = $('div.pager-list-left > a.active').next().text() !== '>';

      searchRes.results = $('div.container > div > div > ul > li')
        .map(
          (i, el): IMangaResult => ({
            id: $(el).find('a').attr('href')?.split('/')[2]!,
            title: $(el).find('p.manga-list-4-item-title > a').text(),
            headerForImage: { Referer: this.baseUrl },
            image: $(el).find('a > img').attr('src'),
            description: $(el).find('p').last().text(),
            status:
              $(el).find('p.manga-list-4-show-tag-list-2 > a').text() === 'Ongoing'
                ? MediaStatus.ONGOING
                : $(el).find('p.manga-list-4-show-tag-list-2 > a').text() === 'Completed'
                ? MediaStatus.COMPLETED
                : MediaStatus.UNKNOWN,
          })
        )
        .get();
      return searchRes;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  fetchHotManga = async (page: number = 1): Promise<ISearch<IMangaHereEnhancedResult>> => {
    const searchRes: ISearch<IMangaHereEnhancedResult> = {
      currentPage: page,
      results: [],
    };

    try {
      const { data } = await this.client.get(`${this.baseUrl}/hot/${page > 1 ? `${page}/` : ''}`, {
        headers: {
          cookie: 'isAdult=1',
        },
      });

      const $ = load(data);

      // Check for pagination
      const paginationLinks = $('a[href*="/hot/"]').filter((_, el) => {
        const href = $(el).attr('href');
        return !!(href && /\/hot\/\d+\//.test(href));
      });

      searchRes.hasNextPage =
        paginationLinks.length > 0 &&
        paginationLinks.toArray().some(el => {
          const href = $(el).attr('href');
          const pageMatch = href?.match(/\/hot\/(\d+)\//);
          return pageMatch && parseInt(pageMatch[1]) > page;
        });

      // Extract manga list
      searchRes.results = $('li')
        .map((_, el): IMangaHereEnhancedResult | null => {
          const $el = $(el);
          const href = $el.find('a').first().attr('href');

          if (!href || !href.includes('/manga/')) return null;

          const id = href.split('/manga/')[1]?.replace('/', '') || '';
          const title = $el.find('a').first().attr('title') || $el.find('a').first().text().trim();
          const image = $el.find('img').attr('src');
          const latestChapter = $el.find('a').last().text().trim();

          // Extract rating from star images
          const starImages = $el.find('img[src*="star"]');
          let rating = 0;
          if (starImages.length > 0) {
            const ratingText = $el.text().match(/(\d+\.?\d*)\s*$/);
            rating = ratingText ? parseFloat(ratingText[1]) : 0;
          }

          if (id && title) {
            return {
              id,
              title,
              image,
              rating,
              latestChapter: latestChapter !== title ? latestChapter : undefined,
              headerForImage: { Referer: this.baseUrl },
            };
          }
          return null;
        })
        .get()
        .filter((item): item is IMangaHereEnhancedResult => item !== null);

      return searchRes;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  fetchNewMangaRelease = async (page: number = 1): Promise<ISearch<IMangaHereEnhancedResult>> => {
    const searchRes: ISearch<IMangaHereEnhancedResult> = {
      currentPage: page,
      results: [],
    };

    try {
      const { data } = await this.client.get(
        `${this.baseUrl}/directory/${page > 1 ? `${page}.htm` : ''}?news`,
        {
          headers: {
            cookie: 'isAdult=1',
          },
        }
      );

      const $ = load(data);

      // Check for pagination
      const paginationLinks = $('a[href*="directory"]').filter((_, el) => {
        const href = $(el).attr('href');
        return !!(href && /directory\/\d+\.htm\?news/.test(href));
      });

      searchRes.hasNextPage =
        paginationLinks.length > 0 &&
        paginationLinks.toArray().some(el => {
          const href = $(el).attr('href');
          const pageMatch = href?.match(/directory\/(\d+)\.htm\?news/);
          return pageMatch && parseInt(pageMatch[1]) > page;
        });

      // Extract manga list
      searchRes.results = $('li')
        .map((_, el): IMangaHereEnhancedResult | null => {
          const $el = $(el);
          const href = $el.find('a').first().attr('href');

          if (!href || !href.includes('/manga/')) return null;

          const id = href.split('/manga/')[1]?.replace('/', '') || '';
          const title = $el.find('a').first().attr('title') || $el.find('a').first().text().trim();
          const image = $el.find('img').attr('src');
          const latestChapter = $el.find('a').last().text().trim();

          // Extract rating from star images
          const starImages = $el.find('img[src*="star"]');
          let rating = 0;
          if (starImages.length > 0) {
            const ratingText = $el.text().match(/(\d+\.?\d*)\s*$/);
            rating = ratingText ? parseFloat(ratingText[1]) : 0;
          }

          if (id && title) {
            return {
              id,
              title,
              image,
              rating,
              latestChapter: latestChapter !== title ? latestChapter : undefined,
              headerForImage: { Referer: this.baseUrl },
            };
          }
          return null;
        })
        .get()
        .filter((item): item is IMangaHereEnhancedResult => item !== null);

      return searchRes;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  fetchTrendingManga = async (page: number = 1): Promise<ISearch<IMangaHereEnhancedResult>> => {
    const searchRes: ISearch<IMangaHereEnhancedResult> = {
      currentPage: page,
      results: [],
    };

    try {
      const { data } = await this.client.get(`${this.baseUrl}/trending/${page > 1 ? `${page}/` : ''}`, {
        headers: {
          cookie: 'isAdult=1',
        },
      });

      const $ = load(data);

      // Check for pagination
      const paginationLinks = $('a[href*="/trending/"]').filter((_, el) => {
        const href = $(el).attr('href');
        return !!(href && /\/trending\/\d+\//.test(href));
      });

      searchRes.hasNextPage =
        paginationLinks.length > 0 &&
        paginationLinks.toArray().some(el => {
          const href = $(el).attr('href');
          const pageMatch = href?.match(/\/trending\/(\d+)\//);
          return pageMatch && parseInt(pageMatch[1]) > page;
        });

      // Extract manga list
      searchRes.results = $('li')
        .map((_, el): IMangaHereEnhancedResult | null => {
          const $el = $(el);
          const href = $el.find('a').first().attr('href');

          if (!href || !href.includes('/manga/')) return null;

          const id = href.split('/manga/')[1]?.replace('/', '') || '';
          const title = $el.find('a').first().attr('title') || $el.find('a').first().text().trim();
          const image = $el.find('img').attr('src');
          const latestChapter = $el.find('a').last().text().trim();

          // Extract rating from star images
          const starImages = $el.find('img[src*="star"]');
          let rating = 0;
          if (starImages.length > 0) {
            const ratingText = $el.text().match(/(\d+\.?\d*)\s*$/);
            rating = ratingText ? parseFloat(ratingText[1]) : 0;
          }

          if (id && title) {
            return {
              id,
              title,
              image,
              rating,
              latestChapter: latestChapter !== title ? latestChapter : undefined,
              headerForImage: { Referer: this.baseUrl },
            };
          }
          return null;
        })
        .get()
        .filter((item): item is IMangaHereEnhancedResult => item !== null);

      return searchRes;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  fetchLatestUpdates = async (page: number = 1): Promise<ISearch<IMangaHereEnhancedResult>> => {
    const searchRes: ISearch<IMangaHereEnhancedResult> = {
      currentPage: page,
      results: [],
    };

    try {
      const { data } = await this.client.get(`${this.baseUrl}/latest/${page > 1 ? `${page}/` : ''}`, {
        headers: {
          cookie: 'isAdult=1',
        },
      });

      const $ = load(data);

      // Check for pagination
      const paginationLinks = $('a[href*="/latest/"]').filter((_, el) => {
        const href = $(el).attr('href');
        return !!(href && /\/latest\/\d+\//.test(href));
      });

      searchRes.hasNextPage =
        paginationLinks.length > 0 &&
        paginationLinks.toArray().some(el => {
          const href = $(el).attr('href');
          const pageMatch = href?.match(/\/latest\/(\d+)\//);
          return pageMatch && parseInt(pageMatch[1]) > page;
        });

      // Extract manga list - Latest updates has a different structure
      searchRes.results = $('li')
        .map((_, el): IMangaHereEnhancedResult | null => {
          const $el = $(el);
          const href = $el.find('a').first().attr('href');

          if (!href || !href.includes('/manga/')) return null;

          const id = href.split('/manga/')[1]?.replace('/', '') || '';
          const title = $el.find('a').first().attr('title') || $el.find('a').first().text().trim();
          const image = $el.find('img').attr('src');

          // Extract latest chapter info and update time
          const chapterLinks = $el.find('a[href*="/manga/"]').slice(1); // Skip the main manga link
          const latestChapter = chapterLinks.first().text().trim();

          // Extract time information (e.g., "8 hour ago")
          const fullText = $el.text();
          const timeMatch = fullText.match(/(\d+\s+(?:hour|minute|day|week|month|year)s?\s+ago)/i);
          const updateTime = timeMatch ? timeMatch[1] : undefined;

          // Extract new chapter count (e.g., "18 New Chapter")
          const chapterCountMatch = fullText.match(/(\d+\s+New\s+Chapter)/i);
          const newChapterCount = chapterCountMatch ? chapterCountMatch[1] : undefined;

          // Extract genres from the text
          const genreLinks = $el.find('a[href*="/directory/"]');
          const genres: string[] = [];
          genreLinks.each((_, genreEl) => {
            const genre = $(genreEl).text().trim();
            if (genre) genres.push(genre);
          });

          if (id && title) {
            return {
              id,
              title,
              image,
              latestChapter: latestChapter !== title ? latestChapter : undefined,
              genres: genres.length > 0 ? genres : undefined,
              updateTime,
              newChapterCount,
              headerForImage: { Referer: this.baseUrl },
            };
          }
          return null;
        })
        .get()
        .filter((item): item is IMangaHereEnhancedResult => item !== null);

      return searchRes;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  fetchHome = async (): Promise<IMangaHereHome> => {
    try {
      const { data } = await this.client.get(`${this.baseUrl}/`, {
        headers: {
          cookie: 'isAdult=1',
        },
      });

      const $ = load(data);

      // Hot Manga Releases - using the correct structure from the HTML
      const hotMangaReleasesResults: IMangaHereEnhancedResult[] = [];
      $('div.manga-list-1-title:contains("Hot Manga Releases")')
        .next('ul.manga-list-1-list')
        .find('li')
        .each((_, el) => {
          const $el = $(el);
          const href = $el.find('a').first().attr('href');
          const id = href?.split('/manga/')[1]?.replace('/', '') || '';
          const title = $el.find('p.manga-list-1-item-title > a').text().trim();
          const image = $el.find('img.manga-list-1-cover').attr('src');
          const latestChapter = $el.find('p.manga-list-1-item-subtitle > a').text().trim();
          const rating = parseFloat($el.find('span.item-score').text()) || 0;

          // Extract additional information from hover element
          const hoverInfo = $el.find('div.manga-list-hover-info-new');
          const views = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Views:") .manga-list-hover-info-content')
            .text()
            .trim();
          const author = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Author:") .manga-list-hover-info-blue')
            .text()
            .trim();
          const mangaRank = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Rank:") .manga-list-hover-info-content')
            .text()
            .trim();
          const summary = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Summary:") .manga-list-hover-info-content')
            .text()
            .trim();

          // Extract genres
          const genres: string[] = [];
          hoverInfo
            .find('p.manga-list-hover-info-tag .manga-list-hover-info-block .item-tag')
            .each((_, genreEl) => {
              const genre = $(genreEl).text().trim();
              if (genre) genres.push(genre);
            });

          if (id && title) {
            hotMangaReleasesResults.push({
              id,
              title,
              image,
              rating,
              latestChapter,
              views: views || undefined,
              genres: genres.length > 0 ? genres : undefined,
              author: author || undefined,
              mangaRank: mangaRank || undefined,
              summary: summary || undefined,
              headerForImage: { Referer: this.baseUrl },
            });
          }
        });

      // Get the "more" URL for Hot Manga Releases
      const hotMangaReleasesMoreUrl = $(
        'div.manga-list-1-title:contains("Hot Manga Releases") a.manga-list-1-more'
      ).attr('href');

      // Popular Manga Ranking - using the correct structure
      const popularMangaRankingResults: IMangaHereEnhancedResult[] = [];
      $('div.manga-list-2-title:contains("Popular Manga Ranking")')
        .next('ul.manga-list-2-list')
        .find('li')
        .each((_, el) => {
          const $el = $(el);
          const href = $el.find('p.manga-list-2-item-title > a').attr('href');
          const id = href?.split('/manga/')[1]?.replace('/', '') || '';
          const title = $el.find('p.manga-list-2-item-title > a').text().trim();
          const latestChapter = $el.find('p.manga-list-2-item-subtitle > a').text().trim();

          // Extract rank from the span element (1, 2, 3, etc.)
          const rankText = $el.find('span[class*="manga-list-2-logo"]').text().trim();
          const rank = parseInt(rankText) || undefined;

          if (id && title) {
            popularMangaRankingResults.push({
              id,
              title,
              latestChapter,
              rank,
              headerForImage: { Referer: this.baseUrl },
            });
          }
        });

      // Get the "more" URL for Popular Manga Ranking
      const popularMangaRankingMoreUrl = $(
        'div.manga-list-2-title:contains("Popular Manga Ranking") a.manga-list-2-more'
      ).attr('href');

      // Being Read Right Now
      const beingReadRightNowResults: IMangaHereEnhancedResult[] = [];
      $('div.manga-list-1-title:contains("Being Read Right Now")')
        .next('ul.manga-list-1-list')
        .find('li')
        .each((_, el) => {
          const $el = $(el);
          const href = $el.find('a').first().attr('href');
          const id = href?.split('/manga/')[1]?.replace('/', '') || '';
          const title = $el.find('p.manga-list-1-item-title > a').text().trim();
          const image = $el.find('img.manga-list-1-cover').attr('src');
          const latestChapter = $el.find('p.manga-list-1-item-subtitle > a').text().trim();

          // Extract additional information from hover element
          const hoverInfo = $el.find('div.manga-list-hover-info-new');
          const views = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Views:") .manga-list-hover-info-content')
            .text()
            .trim();
          const author = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Author:") .manga-list-hover-info-blue')
            .text()
            .trim();
          const mangaRank = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Rank:") .manga-list-hover-info-content')
            .text()
            .trim();
          const summary = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Summary:") .manga-list-hover-info-content')
            .text()
            .trim();

          // Extract genres
          const genres: string[] = [];
          hoverInfo
            .find('p.manga-list-hover-info-tag .manga-list-hover-info-block .item-tag')
            .each((_, genreEl) => {
              const genre = $(genreEl).text().trim();
              if (genre) genres.push(genre);
            });

          if (id && title) {
            beingReadRightNowResults.push({
              id,
              title,
              image,
              latestChapter,
              views: views || undefined,
              genres: genres.length > 0 ? genres : undefined,
              author: author || undefined,
              mangaRank: mangaRank || undefined,
              summary: summary || undefined,
              headerForImage: { Referer: this.baseUrl },
            });
          }
        });

      // Recommended section
      const recommendedResults: IMangaHereEnhancedResult[] = [];
      $('div:contains("Recommended")')
        .next()
        .find('li')
        .each((_, el) => {
          const $el = $(el);
          const href = $el.find('a').first().attr('href');
          const id = href?.split('/manga/')[1]?.replace('/', '') || '';
          const title = $el.find('p.manga-list-1-item-title > a').text().trim();
          const image = $el.find('img.manga-list-1-cover').attr('src');
          const latestChapter = $el.find('p.manga-list-1-item-subtitle > a').text().trim();
          const rating = parseFloat($el.find('span.item-score').text()) || 0;

          // Extract additional information from hover element
          const hoverInfo = $el.find('div.manga-list-hover-info-new');
          const views = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Views:") .manga-list-hover-info-content')
            .text()
            .trim();
          const author = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Author:") .manga-list-hover-info-blue')
            .text()
            .trim();
          const mangaRank = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Rank:") .manga-list-hover-info-content')
            .text()
            .trim();
          const summary = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Summary:") .manga-list-hover-info-content')
            .text()
            .trim();

          // Extract genres
          const genres: string[] = [];
          hoverInfo
            .find('p.manga-list-hover-info-tag .manga-list-hover-info-block .item-tag')
            .each((_, genreEl) => {
              const genre = $(genreEl).text().trim();
              if (genre) genres.push(genre);
            });

          if (id && title) {
            recommendedResults.push({
              id,
              title,
              image,
              rating,
              latestChapter,
              views: views || undefined,
              genres: genres.length > 0 ? genres : undefined,
              author: author || undefined,
              mangaRank: mangaRank || undefined,
              summary: summary || undefined,
              headerForImage: { Referer: this.baseUrl },
            });
          }
        });

      // Trending Manga
      const trendingMangaResults: IMangaHereEnhancedResult[] = [];
      $('div:contains("Trending Manga")')
        .next('ul')
        .find('li')
        .each((_, el) => {
          const $el = $(el);
          const href = $el.find('a').attr('href');
          const id = href?.split('/manga/')[1]?.replace('/', '') || '';
          const title = $el.find('a').text().trim();
          const latestChapter = $el.find('a').last().text().trim();

          // Extract rank from the position
          const rankText = $el.text().match(/^\d+/)?.[0];
          const rank = rankText ? parseInt(rankText) : undefined;

          if (id && title) {
            trendingMangaResults.push({
              id,
              title,
              latestChapter,
              rank,
              headerForImage: { Referer: this.baseUrl },
            });
          }
        });

      // Get the "more" URL for Trending Manga
      const trendingMangaMoreUrl = $('div:contains("Trending Manga") a:contains("more")').attr('href');

      // New Manga Release
      const newMangaReleaseResults: IMangaHereEnhancedResult[] = [];
      $('div:contains("New Manga Release")')
        .next('ul')
        .find('li')
        .each((_, el) => {
          const $el = $(el);
          const href = $el.find('a').first().attr('href');
          const id = href?.split('/manga/')[1]?.replace('/', '') || '';
          const title = $el.find('p.manga-list-1-item-title > a').text().trim();
          const image = $el.find('img.manga-list-1-cover').attr('src');
          const latestChapter = $el.find('p.manga-list-1-item-subtitle > a').text().trim();
          const rating = parseFloat($el.find('span.item-score').text()) || 0;

          // Extract additional information from hover element
          const hoverInfo = $el.find('div.manga-list-hover-info-new');
          const views = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Views:") .manga-list-hover-info-content')
            .text()
            .trim();
          const author = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Author:") .manga-list-hover-info-blue')
            .text()
            .trim();
          const mangaRank = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Rank:") .manga-list-hover-info-content')
            .text()
            .trim();
          const summary = hoverInfo
            .find('p.manga-list-hover-info-line:contains("Summary:") .manga-list-hover-info-content')
            .text()
            .trim();

          // Extract genres
          const genres: string[] = [];
          hoverInfo
            .find('p.manga-list-hover-info-tag .manga-list-hover-info-block .item-tag')
            .each((_, genreEl) => {
              const genre = $(genreEl).text().trim();
              if (genre) genres.push(genre);
            });

          if (id && title) {
            newMangaReleaseResults.push({
              id,
              title,
              image,
              rating,
              latestChapter,
              views: views || undefined,
              genres: genres.length > 0 ? genres : undefined,
              author: author || undefined,
              mangaRank: mangaRank || undefined,
              summary: summary || undefined,
              headerForImage: { Referer: this.baseUrl },
            });
          }
        });

      // Get the "more" URL for New Manga Release
      const newMangaReleaseMoreUrl = $('div:contains("New Manga Release") a:contains("more")').attr('href');

      // Latest Updates
      const latestUpdatesResults: IMangaHereEnhancedResult[] = [];
      $('div:contains("Latest Updates")')
        .next('ul')
        .find('li')
        .each((_, el) => {
          const $el = $(el);
          const href = $el.find('a').first().attr('href');
          const id = href?.split('/manga/')[1]?.replace('/', '') || '';
          const title = $el.find('a').text().trim();
          const image = $el.find('img').attr('src');

          // Extract full text for parsing
          const fullText = $el.text();

          // Extract latest chapter info
          const chapterInfo = fullText.match(/(\d+)\s+New Chapter/)?.[0] || '';

          // Extract time information (e.g., "8 hour ago")
          const timeMatch = fullText.match(/(\d+\s+(?:hour|minute|day|week|month|year)s?\s+ago)/i);
          const updateTime = timeMatch ? timeMatch[1] : undefined;

          // Extract new chapter count (e.g., "18 New Chapter")
          const chapterCountMatch = fullText.match(/(\d+\s+New\s+Chapter)/i);
          const newChapterCount = chapterCountMatch ? chapterCountMatch[1] : undefined;

          if (id && title) {
            latestUpdatesResults.push({
              id,
              title,
              image,
              latestChapter: chapterInfo,
              updateTime,
              newChapterCount,
              headerForImage: { Referer: this.baseUrl },
            });
          }
        });

      // Get the "more" URL for Latest Updates
      const latestUpdatesMoreUrl = $('div:contains("Latest Updates") a:contains("more")').attr('href');

      return {
        hotMangaReleases: {
          results: hotMangaReleasesResults,
          moreUrl: hotMangaReleasesMoreUrl ? `${this.baseUrl}${hotMangaReleasesMoreUrl}` : undefined,
        },
        popularMangaRanking: {
          results: popularMangaRankingResults,
          moreUrl: popularMangaRankingMoreUrl ? `${this.baseUrl}${popularMangaRankingMoreUrl}` : undefined,
        },
        beingReadRightNow: {
          results: beingReadRightNowResults,
        },
        recommended: {
          results: recommendedResults,
        },
        trendingManga: {
          results: trendingMangaResults,
          moreUrl: trendingMangaMoreUrl ? `${this.baseUrl}${trendingMangaMoreUrl}` : undefined,
        },
        newMangaRelease: {
          results: newMangaReleaseResults,
          moreUrl: newMangaReleaseMoreUrl ? `${this.baseUrl}${newMangaReleaseMoreUrl}` : undefined,
        },
        latestUpdates: {
          results: latestUpdatesResults,
          moreUrl: latestUpdatesMoreUrl ? `${this.baseUrl}${latestUpdatesMoreUrl}` : undefined,
        },
      };
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  /**
   *  credit: [tachiyomi-extensions](https://github.com/tachiyomiorg/tachiyomi-extensions/blob/master/src/en/mangahere/src/eu/kanade/tachiyomi/extension/en/mangahere/Mangahere.kt)
   */
  private extractKey = (html: string) => {
    const skss = html.indexOf('eval(function(p,a,c,k,e,d)');
    const skse = html.indexOf('</script>', skss);
    const sks = html.substring(skss, skse).replace('eval', '');

    const skds = eval(sks);

    const sksl = skds.indexOf("'");
    const skel = skds.indexOf(';');

    const skrs = skds.substring(sksl, skel);

    return eval(skrs) as string;
  };
}

export default MangaHere;
