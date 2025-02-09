import { JSDOM } from 'jsdom';
import fs from 'fs';

const DATA_PATH = process.env.DATA_PATH;
const BASE_URL = process.env.BASE_URL;
const CURRENT_DATE = new Date();
const year = CURRENT_DATE.getFullYear();        // Get full year (e.g., 2025)
const month = String(CURRENT_DATE.getMonth() + 1).padStart(2, '0'); // Get month, padded with 0 if needed
const day = String(CURRENT_DATE.getDate()).padStart(2, '0');
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

    return urls;
};

await parseHTML().then(async (urls) => {

    const data = await Promise.all(urls.map(async (x) => {

        const url = `${BASE_URL.slice(0, -1)}${x}`;

        const cacheFile = `./cache/${url.split('/').slice(-2)[0]}_${TIMESTAMP}.html`;

        let details = [];

        let i = 1;
        while (true) {
            const indexedUrl = i == 1 ? url : `${url}/${i}`;
            const indexedCacheFile = `${cacheFile.split('.html')[0]}_page_${i}.html`;
            const html = await fetchAndCacheHTML(indexedCacheFile, indexedUrl);

            const dom = new JSDOM(html);

            const document = dom.window.document;

            i += 1;

            if (document.querySelector(".noresults") || i >= 20) {
                break;
            }

            const arr = Array.from(document.querySelector(".results.grid").querySelectorAll("article"));

            details = [...details, ...arr.map(x => {
                return {
                    fetchDate: CURRENT_DATE,
                    title: x.querySelector('div.descr h3').innerHTML,
                    price: x.querySelector('div.descr p.prix').innerHTML.toLowerCase().replace(/\s+/g, "") == "prixsurdemande" ? null : parseFloat(x.querySelector('div.descr p.prix').innerHTML.toLowerCase().replace(/&nbsp;/g, '').replace(' €', '')),
                    dataId: parseFloat(x.getAttribute('data-id')),
                    mainImage: x.querySelector("div.head img").href,
                    shortDescription: x.querySelector("div.head img").alt,
                    url: x.querySelector("a").href,
                    location: {
                        neighborhood: x.querySelector("div.descr p.lieu") ? x.querySelector("div.descr p.lieu").innerHTML.split(' - <span>').slice(0, 1)[0] : null,
                        residence: x.querySelector("div.descr p.lieu span") ? x.querySelector("div.descr p.lieu span").innerHTML : null,
                    },
                }
            })];

        };

        return details;

    }));

    console.log("\nWriting data to .json file...");

    fs.writeFileSync(`./data/data_${TIMESTAMP}.json`, JSON.stringify({
        data: data.flat()
    }));

});