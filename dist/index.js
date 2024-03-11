"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const fs = require("fs");
async function getIndexPolygons() {
    return fs.promises.readFile('index.query.json').then((buffer) => {
        const { features } = JSON.parse(buffer.toString());
        return features.map(({ geometry }) => JSON.stringify(geometry));
    });
}
async function fetchBuildingsFeatures(url, body) {
    return (axios_1.default
        .get(url, {
        params: new URLSearchParams(body),
    })
        .then(({ data }) => data)
        .then((buildings) => {
        if (!buildings.features || !buildings.features.length)
            throw new Error('not valid');
        return buildings.features;
    }));
}
async function getAllBuildings() {
    const geometries = await getIndexPolygons();
    const body = {
        outFields: [
            'objectid',
            'addrcode',
            'floors',
            'buildcode',
            'render_height',
        ].join(', '),
        geometryType: 'esriGeometryPolygon',
        spatialRel: 'esriSpatialRelContains',
        outSR: '4326',
        f: 'geojson',
    };
    const baseUrl = 'https://gisserver-stage.kyivcity.gov.ua/mayno/rest/services/address/ADDRESS_OBJECTS/MapServer/2/query';
    return Promise.allSettled(geometries.map((geometry) => fetchBuildingsFeatures(baseUrl, { ...body, geometry })))
        .then((results) => {
        const errors = results.filter((result) => result.status !== 'fulfilled');
        console.log('Errors', errors, errors.length);
        const fulfilled = results.filter((result) => result.status === 'fulfilled' && result.value);
        console.log(fulfilled.length);
        return fulfilled;
    })
        .then((filteredResults) => filteredResults.flatMap(({ value }) => value));
}
async function proceed() {
    const buildings = await getAllBuildings();
    const filteredBuildings = filterBuildingsByProperty(buildings, 'buildcode');
    await saveFeaturesAsGeoJSONld(filteredBuildings, 'buildings.geojson');
}
function filterBuildingsByProperty(buildings, field) {
    const featuresDict = {};
    for (const feature of buildings) {
        if (feature.properties && feature.properties[field]) {
            const fieldValue = feature.properties[field];
            if (!featuresDict[fieldValue]) {
                featuresDict[fieldValue] = feature;
            }
        }
    }
    return Object.values(featuresDict);
}
async function saveFeaturesAsGeoJSONld(buildings, outputFile) {
    await fs.promises.writeFile(outputFile, buildings.map((feature) => JSON.stringify(feature)).join('\n'));
    console.log('Filtered GeoJSON Lines file saved successfully!');
}
proceed();
//# sourceMappingURL=index.js.map