"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cheerio_1 = require("cheerio");
const models_1 = require("../../models");
class MangaHere extends models_1.MangaParser {
    constructor() {
        super(...arguments);
        this.name = 'MangaHere';
        this.baseUrl = 'http://www.mangahere.cc';
        this.logo = 'https://i.pinimg.com/564x/51/08/62/51086247ed16ff8abae2df0bb06448e4.jpg';
        this.classPath = 'MANGA.MangaHere';
        this.fetchMangaInfo = async (mangaId) => {
            const mangaInfo = {
                id: mangaId,
                title: '',
            };
            try {
                const { data } = await this.client.get(`${this.baseUrl}/manga/${mangaId}`, {
                    headers: {
                        cookie: 'isAdult=1',
                    },
                });
                const $ = (0, cheerio_1.load)(data);
                mangaInfo.title = $('span.detail-info-right-title-font').text();
                mangaInfo.description = $('div.detail-info-right > p.fullcontent').text();
                mangaInfo.headers = { Referer: this.baseUrl };
                mangaInfo.image = $('div.detail-info-cover > img').attr('src');
                mangaInfo.genres = $('p.detail-info-right-tag-list > a')
                    .map((i, el) => { var _a; return (_a = $(el).attr('title')) === null || _a === void 0 ? void 0 : _a.trim(); })
                    .get();
                switch ($('span.detail-info-right-title-tip').text()) {
                    case 'Ongoing':
                        mangaInfo.status = models_1.MediaStatus.ONGOING;
                        break;
                    case 'Completed':
                        mangaInfo.status = models_1.MediaStatus.COMPLETED;
                        break;
                    default:
                        mangaInfo.status = models_1.MediaStatus.UNKNOWN;
                        break;
                }
                mangaInfo.rating = parseFloat($('span.detail-info-right-title-star > span').last().text());
                mangaInfo.authors = $('p.detail-info-right-say > a')
                    .map((i, el) => $(el).attr('title'))
                    .get();
                mangaInfo.chapters = $('ul.detail-main-list > li')
                    .map((i, el) => {
                    var _a;
                    return ({
                        id: (_a = $(el).find('a').attr('href')) === null || _a === void 0 ? void 0 : _a.split('/manga/')[1].slice(0, -7),
                        title: $(el).find('a > div > p.title3').text(),
                        releasedDate: $(el).find('a > div > p.title2').text().trim(),
                    });
                })
                    .get();
                return mangaInfo;
            }
            catch (err) {
                throw new Error(err.message);
            }
        };
        this.fetchChapterPages = async (chapterId) => {
            var _a, _b;
            const chapterPages = [];
            const url = `${this.baseUrl}/manga/${chapterId}/1.html`;
            try {
                const { data } = await this.client.get(url, {
                    headers: {
                        cookie: 'isAdult=1',
                    },
                });
                const $ = (0, cheerio_1.load)(data);
                const copyrightHandle = $('p.detail-block-content').text().match('Dear user') ||
                    $('p.detail-block-content').text().match('blocked');
                if (copyrightHandle) {
                    throw Error((_a = copyrightHandle.input) === null || _a === void 0 ? void 0 : _a.trim());
                }
                const bar = $('script[src*=chapter_bar]').data();
                const html = $.html();
                if (typeof bar !== 'undefined') {
                    const ss = html.indexOf('eval(function(p,a,c,k,e,d)');
                    const se = html.indexOf('</script>', ss);
                    const s = html.substring(ss, se).replace('eval', '');
                    const ds = eval(s);
                    const urls = ds.split("['")[1].split("']")[0].split("','");
                    urls.map((url, i) => chapterPages.push({
                        page: i,
                        img: `https:${url}`,
                        headerForImage: { Referer: url },
                    }));
                }
                else {
                    let sKey = this.extractKey(html);
                    const chapterIdsl = html.indexOf('chapterid');
                    const chapterId = html.substring(chapterIdsl + 11, html.indexOf(';', chapterIdsl)).trim();
                    const chapterPagesElmnt = $('body > div:nth-child(6) > div > span').children('a');
                    const pages = parseInt((_b = chapterPagesElmnt.last().prev().attr('data-page')) !== null && _b !== void 0 ? _b : '0');
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
                            resText = data;
                            if (resText)
                                break;
                            else
                                sKey = '';
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
            }
            catch (err) {
                throw new Error(err.message);
            }
        };
        this.search = async (query, page = 1) => {
            const searchRes = {
                currentPage: page,
                results: [],
            };
            try {
                const { data } = await this.client.get(`${this.baseUrl}/search?title=${query}&page=${page}`);
                const $ = (0, cheerio_1.load)(data);
                searchRes.hasNextPage = $('div.pager-list-left > a.active').next().text() !== '>';
                searchRes.results = $('div.container > div > div > ul > li')
                    .map((i, el) => {
                    var _a;
                    return ({
                        id: (_a = $(el).find('a').attr('href')) === null || _a === void 0 ? void 0 : _a.split('/')[2],
                        title: $(el).find('p.manga-list-4-item-title > a').text(),
                        headerForImage: { Referer: this.baseUrl },
                        image: $(el).find('a > img').attr('src'),
                        description: $(el).find('p').last().text(),
                        status: $(el).find('p.manga-list-4-show-tag-list-2 > a').text() === 'Ongoing'
                            ? models_1.MediaStatus.ONGOING
                            : $(el).find('p.manga-list-4-show-tag-list-2 > a').text() === 'Completed'
                                ? models_1.MediaStatus.COMPLETED
                                : models_1.MediaStatus.UNKNOWN,
                    });
                })
                    .get();
                return searchRes;
            }
            catch (err) {
                throw new Error(err.message);
            }
        };
        this.fetchHotManga = async (page = 1) => {
            const searchRes = {
                currentPage: page,
                results: [],
            };
            try {
                const { data } = await this.client.get(`${this.baseUrl}/hot/${page > 1 ? `${page}/` : ''}`, {
                    headers: {
                        cookie: 'isAdult=1',
                    },
                });
                const $ = (0, cheerio_1.load)(data);
                // Check for pagination
                const paginationLinks = $('a[href*="/hot/"]').filter((_, el) => {
                    const href = $(el).attr('href');
                    return !!(href && /\/hot\/\d+\//.test(href));
                });
                searchRes.hasNextPage =
                    paginationLinks.length > 0 &&
                        paginationLinks.toArray().some(el => {
                            const href = $(el).attr('href');
                            const pageMatch = href === null || href === void 0 ? void 0 : href.match(/\/hot\/(\d+)\//);
                            return pageMatch && parseInt(pageMatch[1]) > page;
                        });
                // Extract manga list
                searchRes.results = $('li')
                    .map((_, el) => {
                    var _a;
                    const $el = $(el);
                    const href = $el.find('a').first().attr('href');
                    if (!href || !href.includes('/manga/'))
                        return null;
                    const id = ((_a = href.split('/manga/')[1]) === null || _a === void 0 ? void 0 : _a.replace('/', '')) || '';
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
                    .filter((item) => item !== null);
                return searchRes;
            }
            catch (err) {
                throw new Error(err.message);
            }
        };
        this.fetchNewMangaRelease = async (page = 1) => {
            const searchRes = {
                currentPage: page,
                results: [],
            };
            try {
                const { data } = await this.client.get(`${this.baseUrl}/directory/${page > 1 ? `${page}.htm` : ''}?news`, {
                    headers: {
                        cookie: 'isAdult=1',
                    },
                });
                const $ = (0, cheerio_1.load)(data);
                // Check for pagination
                const paginationLinks = $('a[href*="directory"]').filter((_, el) => {
                    const href = $(el).attr('href');
                    return !!(href && /directory\/\d+\.htm\?news/.test(href));
                });
                searchRes.hasNextPage =
                    paginationLinks.length > 0 &&
                        paginationLinks.toArray().some(el => {
                            const href = $(el).attr('href');
                            const pageMatch = href === null || href === void 0 ? void 0 : href.match(/directory\/(\d+)\.htm\?news/);
                            return pageMatch && parseInt(pageMatch[1]) > page;
                        });
                // Extract manga list
                searchRes.results = $('li')
                    .map((_, el) => {
                    var _a;
                    const $el = $(el);
                    const href = $el.find('a').first().attr('href');
                    if (!href || !href.includes('/manga/'))
                        return null;
                    const id = ((_a = href.split('/manga/')[1]) === null || _a === void 0 ? void 0 : _a.replace('/', '')) || '';
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
                    .filter((item) => item !== null);
                return searchRes;
            }
            catch (err) {
                throw new Error(err.message);
            }
        };
        this.fetchTrendingManga = async (page = 1) => {
            const searchRes = {
                currentPage: page,
                results: [],
            };
            try {
                const { data } = await this.client.get(`${this.baseUrl}/trending/${page > 1 ? `${page}/` : ''}`, {
                    headers: {
                        cookie: 'isAdult=1',
                    },
                });
                const $ = (0, cheerio_1.load)(data);
                // Check for pagination
                const paginationLinks = $('a[href*="/trending/"]').filter((_, el) => {
                    const href = $(el).attr('href');
                    return !!(href && /\/trending\/\d+\//.test(href));
                });
                searchRes.hasNextPage =
                    paginationLinks.length > 0 &&
                        paginationLinks.toArray().some(el => {
                            const href = $(el).attr('href');
                            const pageMatch = href === null || href === void 0 ? void 0 : href.match(/\/trending\/(\d+)\//);
                            return pageMatch && parseInt(pageMatch[1]) > page;
                        });
                // Extract manga list
                searchRes.results = $('li')
                    .map((_, el) => {
                    var _a;
                    const $el = $(el);
                    const href = $el.find('a').first().attr('href');
                    if (!href || !href.includes('/manga/'))
                        return null;
                    const id = ((_a = href.split('/manga/')[1]) === null || _a === void 0 ? void 0 : _a.replace('/', '')) || '';
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
                    .filter((item) => item !== null);
                return searchRes;
            }
            catch (err) {
                throw new Error(err.message);
            }
        };
        this.fetchLatestUpdates = async (page = 1) => {
            const searchRes = {
                currentPage: page,
                results: [],
            };
            try {
                const { data } = await this.client.get(`${this.baseUrl}/latest/${page > 1 ? `${page}/` : ''}`, {
                    headers: {
                        cookie: 'isAdult=1',
                    },
                });
                const $ = (0, cheerio_1.load)(data);
                // Check for pagination
                const paginationLinks = $('a[href*="/latest/"]').filter((_, el) => {
                    const href = $(el).attr('href');
                    return !!(href && /\/latest\/\d+\//.test(href));
                });
                searchRes.hasNextPage =
                    paginationLinks.length > 0 &&
                        paginationLinks.toArray().some(el => {
                            const href = $(el).attr('href');
                            const pageMatch = href === null || href === void 0 ? void 0 : href.match(/\/latest\/(\d+)\//);
                            return pageMatch && parseInt(pageMatch[1]) > page;
                        });
                // Extract manga list - Latest updates has a different structure
                searchRes.results = $('li')
                    .map((_, el) => {
                    var _a;
                    const $el = $(el);
                    const href = $el.find('a').first().attr('href');
                    if (!href || !href.includes('/manga/'))
                        return null;
                    const id = ((_a = href.split('/manga/')[1]) === null || _a === void 0 ? void 0 : _a.replace('/', '')) || '';
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
                    const genres = [];
                    genreLinks.each((_, genreEl) => {
                        const genre = $(genreEl).text().trim();
                        if (genre)
                            genres.push(genre);
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
                    .filter((item) => item !== null);
                return searchRes;
            }
            catch (err) {
                throw new Error(err.message);
            }
        };
        this.fetchHome = async () => {
            try {
                const { data } = await this.client.get(`${this.baseUrl}/`, {
                    headers: {
                        cookie: 'isAdult=1',
                    },
                });
                const $ = (0, cheerio_1.load)(data);
                // Hot Manga Releases - using the correct structure from the HTML
                const hotMangaReleasesResults = [];
                $('div.manga-list-1-title:contains("Hot Manga Releases")')
                    .next('ul.manga-list-1-list')
                    .find('li')
                    .each((_, el) => {
                    var _a;
                    const $el = $(el);
                    const href = $el.find('a').first().attr('href');
                    const id = ((_a = href === null || href === void 0 ? void 0 : href.split('/manga/')[1]) === null || _a === void 0 ? void 0 : _a.replace('/', '')) || '';
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
                    const genres = [];
                    hoverInfo
                        .find('p.manga-list-hover-info-tag .manga-list-hover-info-block .item-tag')
                        .each((_, genreEl) => {
                        const genre = $(genreEl).text().trim();
                        if (genre)
                            genres.push(genre);
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
                const hotMangaReleasesMoreUrl = $('div.manga-list-1-title:contains("Hot Manga Releases") a.manga-list-1-more').attr('href');
                // Popular Manga Ranking - using the correct structure
                const popularMangaRankingResults = [];
                $('div.manga-list-2-title:contains("Popular Manga Ranking")')
                    .next('ul.manga-list-2-list')
                    .find('li')
                    .each((_, el) => {
                    var _a;
                    const $el = $(el);
                    const href = $el.find('p.manga-list-2-item-title > a').attr('href');
                    const id = ((_a = href === null || href === void 0 ? void 0 : href.split('/manga/')[1]) === null || _a === void 0 ? void 0 : _a.replace('/', '')) || '';
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
                const popularMangaRankingMoreUrl = $('div.manga-list-2-title:contains("Popular Manga Ranking") a.manga-list-2-more').attr('href');
                // Being Read Right Now
                const beingReadRightNowResults = [];
                $('div.manga-list-1-title:contains("Being Read Right Now")')
                    .next('ul.manga-list-1-list')
                    .find('li')
                    .each((_, el) => {
                    var _a;
                    const $el = $(el);
                    const href = $el.find('a').first().attr('href');
                    const id = ((_a = href === null || href === void 0 ? void 0 : href.split('/manga/')[1]) === null || _a === void 0 ? void 0 : _a.replace('/', '')) || '';
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
                    const genres = [];
                    hoverInfo
                        .find('p.manga-list-hover-info-tag .manga-list-hover-info-block .item-tag')
                        .each((_, genreEl) => {
                        const genre = $(genreEl).text().trim();
                        if (genre)
                            genres.push(genre);
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
                const recommendedResults = [];
                $('div:contains("Recommended")')
                    .next()
                    .find('li')
                    .each((_, el) => {
                    var _a;
                    const $el = $(el);
                    const href = $el.find('a').first().attr('href');
                    const id = ((_a = href === null || href === void 0 ? void 0 : href.split('/manga/')[1]) === null || _a === void 0 ? void 0 : _a.replace('/', '')) || '';
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
                    const genres = [];
                    hoverInfo
                        .find('p.manga-list-hover-info-tag .manga-list-hover-info-block .item-tag')
                        .each((_, genreEl) => {
                        const genre = $(genreEl).text().trim();
                        if (genre)
                            genres.push(genre);
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
                const trendingMangaResults = [];
                $('div:contains("Trending Manga")')
                    .next('ul')
                    .find('li')
                    .each((_, el) => {
                    var _a, _b;
                    const $el = $(el);
                    const href = $el.find('a').attr('href');
                    const id = ((_a = href === null || href === void 0 ? void 0 : href.split('/manga/')[1]) === null || _a === void 0 ? void 0 : _a.replace('/', '')) || '';
                    const title = $el.find('a').text().trim();
                    const latestChapter = $el.find('a').last().text().trim();
                    // Extract rank from the position
                    const rankText = (_b = $el.text().match(/^\d+/)) === null || _b === void 0 ? void 0 : _b[0];
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
                const newMangaReleaseResults = [];
                $('div:contains("New Manga Release")')
                    .next('ul')
                    .find('li')
                    .each((_, el) => {
                    var _a;
                    const $el = $(el);
                    const href = $el.find('a').first().attr('href');
                    const id = ((_a = href === null || href === void 0 ? void 0 : href.split('/manga/')[1]) === null || _a === void 0 ? void 0 : _a.replace('/', '')) || '';
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
                    const genres = [];
                    hoverInfo
                        .find('p.manga-list-hover-info-tag .manga-list-hover-info-block .item-tag')
                        .each((_, genreEl) => {
                        const genre = $(genreEl).text().trim();
                        if (genre)
                            genres.push(genre);
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
                const latestUpdatesResults = [];
                $('div:contains("Latest Updates")')
                    .next('ul')
                    .children('li') // Only get direct children, not nested chapter links
                    .each((_, el) => {
                    var _a, _b;
                    const $el = $(el);
                    const href = $el.find('a').first().attr('href');
                    // Skip if this is not a manga link or if it doesn't have an image (indicating it's a chapter link)
                    if (!href || !href.includes('/manga/') || !$el.find('img').length)
                        return;
                    const id = ((_a = href.split('/manga/')[1]) === null || _a === void 0 ? void 0 : _a.replace('/', '')) || '';
                    // Get the main manga title from the first link with title attribute or text
                    const titleElement = $el.find('a').first();
                    let title = titleElement.attr('title') || titleElement.text().trim();
                    // Skip if title looks like a chapter (e.g., "Ch.032")
                    if (/^Ch\.\d+$/.test(title))
                        return;
                    const image = $el.find('img').attr('src');
                    // Extract full text for parsing, but only from the direct content, not nested lists
                    const fullText = $el.clone().children('ul').remove().end().text();
                    // Extract latest chapter info
                    const chapterInfo = ((_b = fullText.match(/(\d+)\s+New Chapter/)) === null || _b === void 0 ? void 0 : _b[0]) || '';
                    // Extract time information (e.g., "8 hour ago")
                    const timeMatch = fullText.match(/(\d+\s+(?:hour|minute|day|week|month|year)s?\s+ago)/i);
                    const updateTime = timeMatch ? timeMatch[1] : undefined;
                    // Extract new chapter count (e.g., "18 New Chapter")
                    const chapterCountMatch = fullText.match(/(\d+\s+New\s+Chapter)/i);
                    const newChapterCount = chapterCountMatch ? chapterCountMatch[1] : undefined;
                    // Extract genres from the text
                    const genrePattern = /(Fantasy|Historical|Martial Arts|Seinen|Webtoons|Action|Adventure|Comedy|Romance|Drama|Josei|Ecchi|Harem|Shounen|Shoujo|Slice of Life|Supernatural|Horror|Mystery|Psychological|Sci-fi|Sports|Tragedy|Yaoi|Yuri)/g;
                    const genreMatches = fullText.match(genrePattern) || [];
                    const genres = [...new Set(genreMatches)]; // Remove duplicates
                    // Clean up title by removing chapter info and genre tags that might be concatenated
                    // Remove chapter references like "Ch.032Ch.031Ch.030"
                    title = title.replace(/Ch\.\d+/g, '');
                    // Remove "And More Updates..." text
                    title = title.replace(/And More Updates\.\.\./, '');
                    // Remove genre tags from title (they're now extracted separately)
                    title = title.replace(genrePattern, '');
                    // Clean up extra dots and spaces
                    title = title.replace(/\.{3,}/g, '').trim();
                    if (id && title) {
                        latestUpdatesResults.push({
                            id,
                            title,
                            image,
                            latestChapter: chapterInfo,
                            updateTime,
                            newChapterCount,
                            genres: genres.length > 0 ? genres : undefined,
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
            }
            catch (err) {
                throw new Error(err.message);
            }
        };
        /**
         *  credit: [tachiyomi-extensions](https://github.com/tachiyomiorg/tachiyomi-extensions/blob/master/src/en/mangahere/src/eu/kanade/tachiyomi/extension/en/mangahere/Mangahere.kt)
         */
        this.extractKey = (html) => {
            const skss = html.indexOf('eval(function(p,a,c,k,e,d)');
            const skse = html.indexOf('</script>', skss);
            const sks = html.substring(skss, skse).replace('eval', '');
            const skds = eval(sks);
            const sksl = skds.indexOf("'");
            const skel = skds.indexOf(';');
            const skrs = skds.substring(sksl, skel);
            return eval(skrs);
        };
    }
}
exports.default = MangaHere;
//# sourceMappingURL=mangahere.js.map