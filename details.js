// If there is any change on either the price or details --> check the url to get more details

import { JSDOM } from 'jsdom';
import fs from 'fs';
import { fetchAndCacheHTML, getTimestamp } from './functions.js';
import { resolve } from 'path';

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

const time = 10 * 1000; // 10 seconds delay
const step = 10;
const entries = Object.entries(hash); // Get first 10 entries
const newData = [];

let safeSave = false;

for (let i = 0; i < entries.length; i++) {
    const [key, values] = entries[i];

    const sorted = values.sort((a, b) => new Date(b.fetchDate) - new Date(a.fetchDate)).slice(0, 2);
    const last = sorted[0];
    const prev = sorted[1];

    if (!!last.pageDetails) {

        newData.push({
            id: key,
            date: last.fetchDate,
            ...last.pageDetails
        });

    } else if (
        !prev ||
        last.price !== prev.price ||
        JSON.stringify(last.details) !== JSON.stringify(prev.details)
    ) {

        safeSave = true;

        if (i % step === 0 && i != 0) {
            console.log(`\n${i} Wait for ${time / 1000} second(s)...`);
            await new Promise(resolve => setTimeout(resolve, time));
        }

        const timestamp = getTimestamp(new Date(last.fetchDate));
        const cacheFile = `./cache/${key}_${timestamp.slice(0, -4)}.html`;

        const html = await fetchAndCacheHTML(cacheFile, last.fullUrl);
        const dom = new JSDOM(html);
        const document = dom.window.document;

        const locationMatch = html.match("latLng:\\[(\\d+\\.\\d+),(\\d+\\.\\d+)\\]");

        const obj = {};
        if (document.querySelector('.caracs div')) {
            Array.from(document.querySelector('.caracs div').querySelectorAll('p')).forEach(x => {
                switch (x.innerHTML.split('<span>')[0].toLowerCase().trim()) {
                    case "prix de vente":
                        obj.price = parseFloat(x.querySelector('span').innerHTML);
                        break;
                    case "type de bien":
                        obj.type = x.querySelector('span').innerHTML.toLowerCase();
                        break;
                    case "nb de pièces":
                        obj.rooms = parseFloat(x.querySelector('span').innerHTML);
                        break;
                    case "salle(s) de bain":
                        obj.bathrooms = parseFloat(x.querySelector('span').innerHTML);
                        break;
                    case "superf. totale":
                        obj.totalSurface = parseFloat(x.querySelector('span').innerHTML);
                        break;
                    case "superf. terrasse":
                        obj.terraceSurface = parseFloat(x.querySelector('span').innerHTML);
                        break;
                    case "étage":
                        obj.floors = parseFloat(x.querySelector('span').innerHTML);
                        break;
                }
            });
        }

        newData.push({
            id: key,
            date: last.fetchDate,
            agency: document.querySelector('.c_agence')
                ? document.querySelector('.c_agence').innerHTML.split('<i class="co-envolope">')[0].split('\t').slice(-1)[0]
                : null,
            ...obj,
            description: {
                head: document.querySelector('.descr h3') ? document.querySelector('.descr h3').innerHTML : null,
                body: document.querySelector('.descr p') ? document.querySelector('.descr p').innerHTML.replaceAll("<br> &nbsp;<br>", '').replaceAll('<br>', '') : null
            },
            images: document.querySelector('div.galerie_hor')
                ? Array.from(document.querySelector('div.galerie_hor').querySelectorAll('a')).map(x => x.href)
                : null,
            location: {
                latitude: locationMatch ? locationMatch[1] : null,
                longitude: locationMatch ? locationMatch[2] : null
            }
        });

    } else {

        newData.push({
            id: key,
            date: last.fetchDate,
            ...prev.pageDetails
        });

    };

    if (safeSave) {
        if (i % step == 0 && i != 0) {
            newData.slice(i - step, i).forEach(x => {
                const { id, date, ...rest } = x;
                const obj = data.find(obj => obj.fetchDate == date && obj.dataId == id);
                if (obj) {
                    obj.pageDetails = rest;
                };
            });
            json.data = data;
            console.log(`(Safe save) Saving to data.json data between ${i - step} and ${i}: ${newData.slice(i - step, i)}`);
            fs.writeFileSync(DATA_PATH, JSON.stringify(json));
        };
    };

};

newData.forEach(x => {
    const { id, date, ...rest } = x;
    const obj = data.find(obj => obj.fetchDate == date && obj.dataId == id);
    if (obj) {
        obj.pageDetails = rest;
    };
});
json.data = data;
console.log(`Saving all data to data.json`);
fs.writeFileSync(DATA_PATH, JSON.stringify(json));

// console.log(Object.entries(hash).length)
// const newData = await Promise.all(Object.entries(hash).slice(0, 10).map(async ([key, values], i) => {

//     const time = 10 * 1000;
//     const delay = i % 5 == 0 ? time : 0;
//     await new Promise(resolve => setTimeout(() => {
//         console.log(i, `Wait for ${delay / 1000} second(s)...`);
//         resolve()
//     }, delay));

//     const sorted = values.sort((a, b) => new Date(b.fetchDate) - new Date(a.fetchDate)).slice(0, 2);
//     const last = sorted[0];
//     const prev = sorted[1];

//     if (!last) return;

//     if (
//         !prev ||
//         last.price !== prev.price ||
//         JSON.stringify(last.details) !== JSON.stringify(prev.details)
//     ) {
//         const timestamp = getTimestamp(new Date(last.fetchDate))
//         const cacheFile = `./cache/${key}_${timestamp.slice(0, -4)}.html`;

//         const html = await fetchAndCacheHTML(cacheFile, last.fullUrl);

//         const dom = new JSDOM(html);

//         const document = dom.window.document;

//         const locationMatch = html.match("latLng:\\[(\\d+\\.\\d+),(\\d+\\.\\d+)\\]");

//         const obj = {}
//         if (document.querySelector('.caracs div')) {
//             Array.from(document.querySelector('.caracs div').querySelectorAll('p')).map(x => {
//                 switch (x.innerHTML.split('<span>')[0].toLowerCase().trim()) {
//                     case "prix de vente":
//                         obj.price = parseFloat(x.querySelector('span').innerHTML)
//                     case "type de bien":
//                         obj.type = x.querySelector('span').innerHTML.toLowerCase()
//                     case "nb de pièces":
//                         obj.rooms = parseFloat(x.querySelector('span').innerHTML)
//                     case "salle(s) de bain":
//                         obj.bathrooms = parseFloat(x.querySelector('span').innerHTML)
//                     case "superf. totale":
//                         obj.totalSurface = parseFloat(x.querySelector('span').innerHTML)
//                     case "superf. terrasse":
//                         obj.terraceSurface = parseFloat(x.querySelector('span').innerHTML)
//                     case "étage":
//                         obj.floors = parseFloat(x.querySelector('span').innerHTML)
//                     default:
//                         break;
//                 };
//             });
//         }

//         return (
//             {
//                 id: key,
//                 date: last.fetchDate,
//                 agency: document.querySelector('.c_agence') ? document.querySelector('.c_agence').innerHTML.split('<i class="co-envolope">')[0].split('\t').slice(-1)[0] : null,
//                 ...obj,
//                 description: {
//                     head: document.querySelector('.descr h3') ? document.querySelector('.descr h3').innerHTML : null,
//                     body: document.querySelector('.descr p') ? document.querySelector('.descr p').innerHTML.replaceAll("<br> &nbsp;<br>", '').replaceAll('<br>', '') : null
//                 },
//                 images: document.querySelector('div.galerie_hor') ? Array.from(document.querySelector('div.galerie_hor').querySelectorAll('a')).map(x => x.href) : null,
//                 location: {
//                     latitude: locationMatch ? locationMatch[1] : null,
//                     longitude: locationMatch ? locationMatch[2] : null
//                 }
//             }
//         );

//     } else {
//         return {
//             id: key,
//             date: last.fetchDate,
//             ...prev.pageDetails
//         };
//     };

// }));









// newData.forEach(x => {
//     const { id, date, ...rest } = x;
//     const obj = data.find(obj => obj.fetchDate == date && obj.dataId == id);
//     if (obj) {
//         obj.pageDetails = rest;

//     };
// });

// json.data = data;

// fs.writeFileSync(DATA_PATH, JSON.stringify(json));