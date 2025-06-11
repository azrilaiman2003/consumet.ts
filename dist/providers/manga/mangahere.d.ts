import { MangaParser, ISearch, IMangaInfo, IMangaResult, IMangaChapterPage } from '../../models';
interface IMangaHereEnhancedResult extends IMangaResult {
    rank?: number;
    views?: string;
    genres?: string[];
    author?: string;
    mangaRank?: string;
    summary?: string;
    updateTime?: string;
    newChapterCount?: string;
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
declare class MangaHere extends MangaParser {
    readonly name = "MangaHere";
    protected baseUrl: string;
    protected logo: string;
    protected classPath: string;
    fetchMangaInfo: (mangaId: string) => Promise<IMangaInfo>;
    fetchChapterPages: (chapterId: string) => Promise<IMangaChapterPage[]>;
    search: (query: string, page?: number) => Promise<ISearch<IMangaResult>>;
    fetchHotManga: (page?: number) => Promise<ISearch<IMangaHereEnhancedResult>>;
    fetchNewMangaRelease: (page?: number) => Promise<ISearch<IMangaHereEnhancedResult>>;
    fetchTrendingManga: (page?: number) => Promise<ISearch<IMangaHereEnhancedResult>>;
    fetchLatestUpdates: (page?: number) => Promise<ISearch<IMangaHereEnhancedResult>>;
    fetchHome: () => Promise<IMangaHereHome>;
    /**
     *  credit: [tachiyomi-extensions](https://github.com/tachiyomiorg/tachiyomi-extensions/blob/master/src/en/mangahere/src/eu/kanade/tachiyomi/extension/en/mangahere/Mangahere.kt)
     */
    private extractKey;
}
export default MangaHere;
