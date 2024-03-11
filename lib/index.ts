import axios from 'axios';
import * as fs from 'fs';

interface IndexPolygonGeometry {
	rings: GeoJSON.Position[][];
}
interface IndexPolygon {
	features: {
		geometry: IndexPolygonGeometry;
	}[];
}

type EncodedIndexPolygonGeometry = string;

type BuildingsCollection = GeoJSON.FeatureCollection;

type Buildings = GeoJSON.Feature[];

async function getIndexPolygons(): Promise<EncodedIndexPolygonGeometry[]> {
	return fs.promises.readFile('index.query.json').then((buffer) => {
		const { features } = JSON.parse(buffer.toString()) as IndexPolygon;
		return features.map(({ geometry }) => JSON.stringify(geometry));
	});
}

async function fetchBuildingsFeatures(
	url: string,
	body: Record<string, string>
): Promise<Buildings> {
	return (
		axios
			.get<BuildingsCollection>(url, {
				params: new URLSearchParams(body),
			})
			// .post<BuildingsCollection>(url, new URLSearchParams(body), {
			// 	headers: {
			// 		'Content-Type': 'application/x-www-form-urlencoded',
			// 	},
			// })
			.then(({ data }) => data)
			.then((buildings) => {
				if (!buildings.features || !buildings.features.length)
					throw new Error('not valid');

				return buildings.features;
			})
	);
}

async function getAllBuildings(): Promise<Buildings> {
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
	} as const;
	const baseUrl =
		'https://gisserver-stage.kyivcity.gov.ua/mayno/rest/services/address/ADDRESS_OBJECTS/MapServer/2/query';

	return Promise.allSettled(
		geometries.map((geometry) =>
			fetchBuildingsFeatures(baseUrl, { ...body, geometry })
		)
	)
		.then((results) => {
			const errors = results.filter((result) => result.status !== 'fulfilled');
			console.log('Errors', errors, errors.length);
			const fulfilled = results.filter(
				(result) => result.status === 'fulfilled' && result.value
			) as PromiseFulfilledResult<Buildings>[];
			console.log(fulfilled.length);
			return fulfilled;
		})
		.then((filteredResults) => filteredResults.flatMap(({ value }) => value));
}

async function proceed(): Promise<void> {
	const buildings = await getAllBuildings();
	const filteredBuildings = filterBuildingsByProperty(buildings, 'buildcode');
	await saveFeaturesAsGeoJSONld(filteredBuildings, 'buildings.geojson');
}

// Function to filter duplicates from GeoJSON based on 'buildcode' field
function filterBuildingsByProperty(
	buildings: Buildings,
	field: string
): Buildings {
	const featuresDict = {};

	for (const feature of buildings) {
		if (feature.properties && feature.properties[field]) {
			const fieldValue = feature.properties[field];
			// Add the feature to the dictionary if buildcode is not already present
			if (!featuresDict[fieldValue]) {
				featuresDict[fieldValue] = feature;
			}
		}
	}

	return Object.values(featuresDict);
}

async function saveFeaturesAsGeoJSONld(
	buildings: Buildings,
	outputFile: string
): Promise<void> {
	await fs.promises.writeFile(
		outputFile,
		buildings.map((feature) => JSON.stringify(feature)).join('\n')
	);
	console.log('Filtered GeoJSON Lines file saved successfully!');
}

proceed();
