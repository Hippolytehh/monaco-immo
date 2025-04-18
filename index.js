import { JSDOM } from 'jsdom';
import fs from 'fs';
import { parseHomePage, fetchAndCacheHTML, getTimestamp } from './functions.js';

const DATA_PATH = process.env.DATA_PATH;
const BASE_URL = process.env.BASE_URL;
const CURRENT_DATE = new Date();
const year = CURRENT_DATE.getFullYear();        // Get full year (e.g., 2025)
const month = String(CURRENT_DATE.getMonth() + 1).padStart(2, '0'); // Get month, padded with 0 if needed
const day = String(CURRENT_DATE.getDate()).padStart(2, '0');
const TIMESTAMP = getTimestamp(CURRENT_DATE);

const homePage = `./cache/cache_${TIMESTAMP.slice(0, -2)}.html`;

await parseHomePage(homePage).then(async (urls) => {

    const data = await Promise.all(urls.map(async (x) => {

        const url = `${BASE_URL.slice(0, -1)}${x}`;

        const cacheFile = `./cache/${url.split('/').slice(-2)[0]}_${TIMESTAMP.slice(0, -4)}.html`;

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
                    price: x.querySelector('div.descr p.prix').innerHTML.toLowerCase().replace(/\s+/g, "") == "prixsurdemande" ? null : parseFloat(x.querySelector('div.descr p.prix').innerHTML.toLowerCase().replace(/&nbsp;/g, '').replace(' €', '')) + 1000000, // TEST
                    dataId: parseFloat(x.getAttribute('data-id')),
                    shortDescription: x.querySelector("div.head img").alt,
                    fullUrl: `${BASE_URL.split('/').slice(0, -1).join('/')}/${x.querySelector("a").href.split('/').slice(1).join('/')}`,
                    location: {
                        neighborhood: x.querySelector("div.descr p.lieu") ? x.querySelector("div.descr p.lieu").innerHTML.split(' - <span>').slice(0, 1)[0] : null,
                        residence: x.querySelector("div.descr p.lieu span") ? x.querySelector("div.descr p.lieu span").innerHTML : null,
                    },
                    details: Array.from(x.querySelector('.carac').querySelectorAll('span')).map(item => {
                        const src = item.querySelector('img').src;
                        const srcBase = src.split('/').slice(-1)[0];
                        switch (srcBase) {
                            case 'surface.svg':
                                return { "surface": parseFloat(item.innerHTML.split('>').slice(-1)[0]) }
                            case 'chambres.svg':
                                return { "bedrooms": parseFloat(item.innerHTML.split('>').slice(-1)[0]) }
                            case 'bain.svg':
                                return { "bathrooms": parseFloat(item.innerHTML.split('>').slice(-1)[0]) }
                            default:
                                break
                        };
                    }).reduce((acc, obj) => {
                        return { ...acc, ...obj }
                    }, {}),
                    images: {
                        preview: x.querySelector("div.head img").src
                    },
                    pageDetails: null
                }
            })];

        };

        return details;

    }));

    let existingData = { lastUpdate: null, data: [] };

    if (fs.existsSync(DATA_PATH)) {
        try {
            const fileContent = fs.readFileSync(DATA_PATH, 'utf-8');
            existingData = JSON.parse(fileContent);
        } catch (error) {
            console.error("Error reading existing JSON file:", error);
        }
    };

    // if (
    //     !existingData.lastUpdate || !(
    //         new Date(CURRENT_DATE).getDate() == new Date(existingData.lastUpdate).getDate() &&
    //         new Date(CURRENT_DATE).getMonth() == new Date(existingData.lastUpdate).getMonth() &&
    //         new Date(CURRENT_DATE).getFullYear() == new Date(existingData.lastUpdate).getFullYear()
    //     )
    // ) {
    existingData.lastUpdate = CURRENT_DATE;

    existingData.data = [...existingData.data, ...data.flat()];

    console.log("\nWriting data to .json file...");

    fs.mkdirSync('./data', { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(existingData));
    // };

});