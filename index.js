import { JSDOM } from 'jsdom';
import fs from 'fs';

const BASE_URL = 'https://www.chambre-immobiliere-monaco.mc/'

async function fetchAndCacheHTML(cacheFile, url) {

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

async function parseHTML() {

    const cacheFile = './cache/cache.html';

    const html = await fetchAndCacheHTML(cacheFile, BASE_URL);

    const dom = new JSDOM(html);

    const document = dom.window.document;

    const areas = Array.from(document.querySelector(".hquartier .table_flex").querySelectorAll("[data-id]"));

    const urls = areas.map(x => {
        return x.querySelector('p:nth-child(2) a').href;
    });

    return urls
};

const urls = await parseHTML();

urls.forEach(async (x) => {

    const url = `${BASE_URL.slice(0, -1)}${x}`;

    const cacheFile = `./cache/${url.split('/').slice(-2)[0]}.html`;

    console.log(cacheFile);

    const html = await fetchAndCacheHTML(cacheFile, url)
})