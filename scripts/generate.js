const fs = require('fs-extra');
const walker = require('walker');
const path = require('path');
const yaml = require('yaml');
const crypto = require('crypto');
const {
	execute,
	triggerBuild,
	getBuildData,
	getLastModifyDate,
} = require('./utils');

const FRONT_MATTER_REG = /^\s*---\n\s*([\s\S]*?)\s*\n---\n/i;

console.log("Generating files ...");

const rootDir = path.join(__dirname, '..');
const genDir = path.join(rootDir, './generated');
const contentDir = path.join(rootDir, './content/en/');
fs.ensureDirSync(genDir);
process.chdir(rootDir);

const isDefaultContent = p => p.startsWith('content/en');
const docToPath = d => `content/${d.lang}/${d.content}`;

const strJson = j => JSON.stringify(j, null, 2);

function getLangAndContent(filePath) {
	const result = /content\/(\w+)\/(.+)/.exec(filePath);
	if (!result || result.length !== 3) {
		throw new Error(`Invalid content path: ${filePath}`);
	}

	return {
		lang: result[1],
		content: '/' + result[2].replace(/\.md$/, ''),
	};
}

function getUrlFromContent(filePath) {
	return ('/' + path.relative(contentDir, filePath)).replace(/(index|\.md)/g, '');
}

(async function() {

	// List of promise that do not need to complete in a particular order
	const asyncWork = [];

	// Get build information
	// build_url: Netlify build url, used to trigger a Netlify build
	// generated_commit: The commit that Netlify last build upon

	console.log('Getting build data');
	const { build_url, generated_commit, updateTime } = await getBuildData();
	console.log(`Build data last updated at: ${new Date(updateTime).toGMTString()}`)

	console.group(`Diff of current master with ${generated_commit}:`);
	const diff = await execute(`git diff --name-status ${generated_commit}`);

	// List of all the "content" that has changed
	const updatedFiles = [];
	const removedFiles = [];
	diff.split('\n')
		.filter(
			s => /^[AMD]\tcontent\/(\w+)\//.test(s)
		)
		.forEach(p => {
			(p[0] !== 'D' ? updatedFiles : removedFiles).push(p.slice(2));
		});

	console.group(`Modified / Updated files:`);
	console.log(updatedFiles.join('\n'));
	console.groupEnd();

	console.group(`Removed files:`);
	console.log(removedFiles.join('\n'));
	console.groupEnd();

	console.groupEnd();

	if (updatedFiles.length + removedFiles.length === 0) {
		console.log('No content changed, exiting');
		return;
	}

	// routes.json
	asyncWork.push(genAllRoutes());

	// patch.json
	asyncWork.push(genPatch(updatedFiles, removedFiles));

	// index.json
	asyncWork.push(genIndexData(updatedFiles, removedFiles));

	await Promise.all(asyncWork);

	// Push to github
	!process.env.TEST && console.log(await execute(`sh ./scripts/push.sh`));

	// Trigger Netlify build
	!process.env.TEST && await triggerBuild(build_url);
})();

async function genAllRoutes() {
	const paths = [];
	await new Promise(resolve => {
		walker(contentDir)
			.on('file', p =>
				paths.push(getUrlFromContent(p))
			)
			.on('end', () => resolve(paths));
	});

	fs.writeFile(path.join(genDir, 'routes.json'), strJson(paths));
	console.log(`Generated routes.json`);
}

async function genPatch(updatedFiles, removedFiles) {
	const updatePaths = updatedFiles
		.filter(isDefaultContent)
		.map(getUrlFromContent);

	const removePaths = removedFiles
		.filter(isDefaultContent)
		.map(getUrlFromContent);

	await fs.writeFile(
		path.join(genDir, 'patch.json'),
		strJson({
			update: updatePaths,
			remove: removePaths,
		})
	);

	console.log(`Generated patch.json`);
}

async function genIndexData(updatedFiles, removedFiles) {

	let db = [];
	const blogIndexPath = path.join(genDir, './index.json');
	console.group('Generating index.json');
	if (fs.existsSync(blogIndexPath)) {
		db = require(blogIndexPath);

		const len = db.length;
		db = db.filter(o => !removedFiles.includes(docToPath(o)));
		console.log(`Update database, ${len - db.length} document removed`);
	}

	console.log('Getting last modified time of all changed content.');

	const queryResultMap = await Promise.all(
		updatedFiles.map(
			p => (
				process.env.TEST > 1 ?
				{
					committedDate: new Date().toISOString(),
					authorName: 'Remtori',
				}
				: getLastModifyDate(p)
			)
		)
	).then(result => {
		const out = new Map();
		for (let i = 0; i < result.length; i++)
			out.set(updatedFiles[i], result[i]);

		return out;
	});

	let statFileUpdateCount = 0;
	for (let i = 0; i < db.length; i++) {

		const j = updatedFiles.indexOf(docToPath(db[i]));

		if (j >= 0) {
			// update metadata and remove its from the list
			db[i] = await updateDBDoc(updatedFiles[j], db[i]);
			updatedFiles.splice(j, 1);
			statFileUpdateCount++;
		}
	}

	console.log(`Update database, ${statFileUpdateCount} document updated`);

	// the remaining item in 'updatedFiles' is newly created file
	for (const filePath of updatedFiles) {
		const doc = await updateDBDoc(filePath);
		db.push(doc);
	}

	console.log(`Update database, ${updatedFiles.length} document created`);

	db.sort((a, b) => a.created > b.created ? -1 : 1);

	await fs.writeFile(blogIndexPath, strJson(db));

	console.log(`Generated index.json`);
	console.groupEnd();

	async function updateDBDoc(filePath, oldDoc) {

		const { content, lang } = getLangAndContent(filePath);
		const id = path.parse(content).name;
		const queryResult = queryResultMap.get(filePath);

		let doc = {
			id,
			lang,
			content,
			title: id,
			description: '',
			tags: '',
			author: queryResult.authorName,
			created: queryResult.committedDate,
			modified: queryResult.committedDate,
		};

		const sourceData = await fs.readFile(path.join(rootDir, filePath), 'utf8');
		const docSource = (FRONT_MATTER_REG.exec(sourceData) || [])[1];

		if (docSource) {
			doc = Object.assign(
				{},
				doc,
				yaml.parse('---\n' + docSource.replace(/^/gm, '  ') + '\n'),
				// These value can't be update
				oldDoc && {
					id: oldDoc.id,
					lang: oldDoc.lang,
					content: oldDoc.content,
					created: oldDoc.created,
				}
			);
		}

		return doc;
	}
}
