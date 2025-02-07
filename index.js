import { JSDOM } from 'jsdom';
import fs from 'fs';

const BASE_URL = 'https://www.chambre-immobiliere-monaco.mc/';

const year = new Date().getFullYear();        // Get full year (e.g., 2025)
const month = String(new Date().getMonth() + 1).padStart(2, '0'); // Get month, padded with 0 if needed
const day = String(new Date().getDate()).padStart(2, '0');
const TIMESTAMP = `${year}${month}${day}`

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

    const cacheFile = `./cache/cache_${TIMESTAMP}.html`;

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

    const cacheFile = `./cache/${url.split('/').slice(-2)[0]}_${TIMESTAMP}.html`;

    // console.log(cacheFile);

    const html = await fetchAndCacheHTML(cacheFile, url)

    const dom = new JSDOM(html);

    const document = dom.window.document;

    const arr = Array.from(document.querySelector(".results.grid").querySelectorAll("article"));

    const details = arr.map(x => {
        // console.log()
        return {
            dataId: parseFloat(x.getAttribute('data-id')),
            mainImage: x.querySelector("div.head img").href,
            shortDescription: x.querySelector("div.head img").alt,
            url: x.querySelector("a").href,
            location: {
                neighborhood: x.querySelector("div.descr p.lieu") ? x.querySelector("div.descr p.lieu").innerHTML.split(' - <span>').slice(0, 1) : null,
                residence: x.querySelector("div.descr p.lieu span") ? x.querySelector("div.descr p.lieu span").innerHTML : null,
            },
        }
    })

    fs.writeFileSync('data.json', JSON.stringify(details));
})