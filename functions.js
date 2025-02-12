import fs from 'fs';
import { JSDOM } from 'jsdom';

const BASE_URL = process.env.BASE_URL;

export async function fetchAndCacheHTML(cacheFile, url) {

    // Check if cached file exists
    if (fs.existsSync(cacheFile)) {
        console.log("\nLoading from cache...");
        return fs.readFileSync(cacheFile, 'utf8');
    }

    console.log("\nFetching from the internet...");
    const response = await fetch(url);
    const html = await response.text();

    fs.mkdirSync(cacheFile.split('/').slice(0, -1).join('/'), { recursive: true });

    fs.writeFileSync(cacheFile, html); // Save HTML to cache file
    return html;
}

export async function parseHomePage(cacheFile) {

    const html = await fetchAndCacheHTML(cacheFile, BASE_URL);

    const dom = new JSDOM(html);

    const document = dom.window.document;

    const areas = Array.from(document.querySelector(".hquartier .table_flex").querySelectorAll("[data-id]"));

    const urls = areas.map(x => {
        return x.querySelector('p:nth-child(2) a').href;
    });

    return urls;
};