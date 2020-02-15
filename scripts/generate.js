/**
 * The purpose of this script is to create 2 file, index.json and patch.json
 *
 * index.json: Indexing everything in /content, might be quite large after a while
 *
 * patch.json: List of route that need update or remove to be up to date with the current master
 *                the information necessary to do this is store in firebase firestore at utils/netlify
 *
 *
 * Then push the resulting change to github with the `[travis-ci skip]` commit message
 * After pushing the commit successfully, trigger the Netlify build via the build hook URL
 *
 *
 * Environment Variable:
 *
 * TEST:
 *       - 1: Generate files,
 *            along with the updated time (commit time) from github,
 *            then pushing the changes to Github
 *            WITHOUT triggering a Netlify build
 *
 *       - 2: Generate files,
 *            WITHOUT querying updated time (commit time) from github,
 * 	          pushing the changes or triggering a Netlify build
 *
 * GITHUB_TOKEN: Github Token used to make API call
 *
 * BUILD_URL: Netlify build hook url
 */

const fs = require('fs-extra');
const path = require('path');
const yaml = require('yaml');
const {
	execute,
	triggerBuild,
	getLastModifyDate,
	contentDiff,
} = require('./utils');

const FRONT_MATTER_REG = /^\s*---\n\s*([\s\S]*?)\s*\n---\n/i;

const rootDir = path.join(__dirname, '..');
const genDir = path.join(rootDir, './generated');
const contentDir = path.join(rootDir, './content/en/');
fs.ensureDirSync(genDir);
process.chdir(rootDir);

const isDefaultContent = p => p.startsWith('content/en');
const strJson = j => JSON.stringify(j, null, 2);
const trimUrl = u => u.replace(/\.md$/, '').replace(/\/index/, '/');

function getLangAndContent(filePath) {
	const result = /content\/(\w+)\/(.+)/.exec(filePath);
	if (!result || result.length !== 3) {
		throw new Error(`Invalid content path: ${filePath}`);
	}

	return {
		lang: result[1],
		content: trimUrl('/' + result[2]),
	};
}

async function generate() {

	// patch.json
	await genPatch();

	// index.json
	await genIndex();

	// Push to github
	if (!process.env.TEST || process.env.TEST === 1) {
		await execute(`sh ./scripts/push.sh`).then(console.log);
	}

	// Trigger Netlify build
	if (!process.env.TEST) {
		console.log(`Trigger Netlify build...`);
		await triggerBuild(process.env.BUILD_URL);
	}
}

async function genPatch() {

	const head$commit = (await execute(`git rev-parse HEAD`)).replace(/[^\w]/g, '');
	const published$commit = (await fs.readFile(path.join(genDir, './published_commit'), 'utf8')).replace(/[^\w]/g, '');

	console.group(`Generating patch.json with diff from ${published$commit.slice(0, 7)} to ${head$commit.slice(0, 7)}`);

	const { updatedFiles, removedFiles } = await contentDiff(published$commit);

	const getUrlFromContent = p => trimUrl('/' + path.relative(contentDir, p));

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
	console.groupEnd();
}

const uidFromDoc = doc => `${doc.lang}\\\\${doc.content}`;
const uidFromPath = p => uidFromDoc(getLangAndContent(p));

async function genIndex() {

	console.group('Generating index.json');

	const head$commit = (await execute(`git rev-parse HEAD`)).replace(/[^\w]/g, '');
	const tail$commit = (await execute(`git rev-list --max-parents=0 master`)).replace(/[^\w]/g, '');

	const db = {
		$commit: tail$commit,
		documents: [],
	};

	const blogIndexPath = path.join(genDir, './index.json');
	if (fs.existsSync(blogIndexPath)) {
		Object.assign(db, require(blogIndexPath));
	}

	let len;
	console.log(`Updating index.json from ${db.$commit.slice(0, 7)} to ${head$commit.slice(0, 7)}`);
	if (db.$commit === head$commit) {
		console.log(`index.json is already up-to-date`);
		console.groupEnd();
		return;
	}

	const { updatedFiles, removedFiles } = await contentDiff(db.$commit);
	db.$commit = head$commit;

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

	// Filter out removed file
	{
		const uidDocList = db.documents.map(uidFromDoc);
		const blacklist = removedFiles.map(uidFromPath);

		len = db.documents.length;
		db.documents = db.documents.filter((_, i) => blacklist.indexOf(uidDocList[i]) === -1);
		console.log(`Update database, ${len - db.documents.length}/${removedFiles.length} document removed`);
	}

	// Create/Update the document
	{
		const uidDocList = db.documents.map(uidFromDoc);
		const whitelist = updatedFiles.map(uidFromPath);

		let updateCount = 0;
		for (let i = 0; i < updatedFiles.length; i++) {

			const j = uidDocList.indexOf(whitelist[i]);

			if (j >= 0) {
				db.documents[i] = await updateDBDoc(updatedFiles[i], db.documents[j]);
				updateCount++;
			} else {
				const doc = await updateDBDoc(updatedFiles[i]);
				db.documents.push(doc);
			}
		}

		console.log(`Update database, ${updateCount} document updated`);
		console.log(`Update database, ${updatedFiles.length - updateCount} document created`);
	}

	// Sort the document descending by created time
	db.documents.sort((a, b) => a.created > b.created ? -1 : 1);
	await fs.writeFile(blogIndexPath, strJson(db));

	console.log(`Generated index.json with ${db.documents.length} document`);
	console.groupEnd();

	async function updateDBDoc(filePath, oldDoc) {

		const { content, lang } = getLangAndContent(filePath);
		const id = path.parse(filePath).name;
		const queryResult = queryResultMap.get(filePath);
		if (!queryResult) console.log(filePath);

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
					created: oldDoc.created,
				},
				{
					id,
					lang,
					content,
				}
			);
		}

		return doc;
	}
}

(function() {
	console.log("Generating files ...");
	generate()
		.then(() => console.log(`Everything finishing successfully!`))
		.catch(console.log);
})();
