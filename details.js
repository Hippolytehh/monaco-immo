// If there is any change on either the price or details --> check the url to get more details

import { JSDOM } from 'jsdom';
import fs from 'fs';
import { fetchAndCacheHTML, getTimestamp } from './functions.js';

const DATA_PATH = process.env.DATA_PATH;

if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`File not found: ${DATA_PATH}\nMake sure you first run index.js\n`);
}
const fileContent = fs.readFileSync(DATA_PATH, 'utf-8');

const json = JSON.parse(fileContent);
const data = json.data;

const hash = data.reduce((acc, obj) => {
    const { dataId, ...rest } = obj;
    if (!acc[dataId]) acc[dataId] = [];
    acc[dataId].push(rest);
    return acc;
}, {});

console.log(Object.entries(hash).length)
const newData = await Promise.all(Object.entries(hash).slice(300, 400).map(async ([key, values]) => {
    const sorted = values.sort((a, b) => new Date(b.fetchDate) - new Date(a.fetchDate)).slice(0, 2);
    const last = sorted[0];
    const prev = sorted[1];

    if (!last) return;

    if (
        !prev ||
        last.price !== prev.price ||
        JSON.stringify(last.details) !== JSON.stringify(prev.details)
    ) {
        const timestamp = getTimestamp(new Date(last.fetchDate))
        const cacheFile = `./cache/${key}_${timestamp.slice(0, -4)}.html`;

        const html = await fetchAndCacheHTML(cacheFile, last.fullUrl);

        const dom = new JSDOM(html);

        const document = dom.window.document;

        const locationMatch = html.match("latLng:\\[(\\d+\\.\\d+),(\\d+\\.\\d+)\\]");

        const obj = {}
        if (document.querySelector('.caracs div')) {
            Array.from(document.querySelector('.caracs div').querySelectorAll('p')).map(x => {
                switch (x.innerHTML.split('<span>')[0].toLowerCase().trim()) {
                    case "prix de vente":
                        obj.price = parseFloat(x.querySelector('span').innerHTML)
                    case "type de bien":
                        obj.type = x.querySelector('span').innerHTML.toLowerCase()
                    case "nb de pièces":
                        obj.rooms = parseFloat(x.querySelector('span').innerHTML)
                    case "salle(s) de bain":
                        obj.bathrooms = parseFloat(x.querySelector('span').innerHTML)
                    case "superf. totale":
                        obj.totalSurface = parseFloat(x.querySelector('span').innerHTML)
                    case "superf. terrasse":
                        obj.terraceSurface = parseFloat(x.querySelector('span').innerHTML)
                    case "étage":
                        obj.floors = parseFloat(x.querySelector('span').innerHTML)
                    default:
                        break;
                };
            });
        }

        return (
            {
                id: key,
                date: last.fetchDate,
                agency: document.querySelector('.c_agence') ? document.querySelector('.c_agence').innerHTML.split('<i class="co-envolope">')[0].split('\t').slice(-1)[0] : null,
                ...obj,
                description: {
                    head: document.querySelector('.descr h3') ? document.querySelector('.descr h3').innerHTML : null,
                    body: document.querySelector('.descr p') ? document.querySelector('.descr p').innerHTML.replaceAll("<br> &nbsp;<br>", '').replaceAll('<br>', '') : null
                },
                images: document.querySelector('div.galerie_hor') ? Array.from(document.querySelector('div.galerie_hor').querySelectorAll('a')).map(x => x.href) : null,
                location: {
                    latitude: locationMatch ? locationMatch[1] : null,
                    longitude: locationMatch ? locationMatch[2] : null
                }
            }
        );

    } else {
        return {
            id: key,
            date: last.fetchDate,
            ...prev.pageDetails
        };
    };

}));

newData.forEach(x => {
    const { id, date, ...rest } = x;
    const obj = data.find(obj => obj.fetchDate == date && obj.dataId == id);
    if (obj) {
        obj.pageDetails = rest;

    };
});

json.data = data;

fs.writeFileSync(DATA_PATH, JSON.stringify(json));