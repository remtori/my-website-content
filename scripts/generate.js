const fs = require('fs-extra');
const path = require('path');
const fetch = require('cross-fetch');
const { exec } = require('child_process');
const yaml = require('yaml');

const FRONT_MATTER_REG = /^\s*---\n\s*([\s\S]*?)\s*\n---\n/i;
const LANG_PATH_GETTER_REG = /content\/([^/]+)\/(.+).md/;

console.log("Generating files ...");

const genDir = path.join(__dirname, '../generated');
(async function() {

	const { build_url, generated_commit } = await
		fetch(
			'https://firestore.googleapis.com/v1/projects/remtori/databases/(default)/documents/utils/netlify'
		).then(r => r.json())
		.then(r => ({
			build_url: r.fields.build_url.stringValue,
			generated_commit: r.fields.generated_commit.stringValue,
		}));

	const diff = await execute(`git diff --name-only ${generated_commit}`);
	console.log(`Diff of current master with ${generated_commit} :`);
	console.log(diff);

	const changedFiles = diff.split('\n').filter(s => s.startsWith('content/'));

	await fs.writeFile(
		path.join(genDir, 're-render.json'),
		JSON.stringify(changedFiles, null, 2)
	);

	console.log(`Generated ./generated/re-render.json`);

	let db = [];
	const blogIndexPath = path.join(genDir, './index.json');
	if (fs.existsSync(blogIndexPath)) db = require(blogIndexPath);

	console.log('Getting last modified time of all changed content.');

	const queryResultMap = await Promise.all(
		changedFiles.map(path => getLastModifyDate(path))
	).then(result => {
		const out = new Map();
		for (let i = 0; i < result.length; i++)
			out.set(changedFiles[i], result[i]);

		return out;
	});

	for (let i = 0; i < db.length; i++) {
		const j = changedFiles.indexOf(`content/${doc.lang}/${doc.content}.md`);
		if (j >= 0) {
			// update metadata and remove its from the list
			db[i] = updateDBDoc(changedFiles[j], db[i]);
			changedFiles.splice(j, 1);
		}
	}

	// the remaining item in 'changedFiles' is newly created file
	for (const filePath of changedFiles) {
		const doc = updateDBDoc(filePath);
		db.push(doc);
	}

	console.log(`Generated ./generated/index.json`);

	function updateDBDoc(filePath, oldDoc) {

		// get lang and contentPath from filePath
		const result = LANG_PATH_GETTER_REG.exec(filePath);
		const lang = result[1];
		const contentPath = result[2];
		const id = path.basename(contentPath);
		const queryResult = queryResultMap.get(filePath);

		let doc = {
			id,
			lang,
			content: contentPath,
			title: id,
			description: '',
			tags: '',
			author: queryResult.authorName,
			created: queryResult.committedDate,
			modified: queryResult.committedDate,
		};

		const sourceData = fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
		const docSource = FRONT_MATTER_REG.exec(sourceData)[1];

		if (docSource) {
			doc = Object.assign(
				{},
				doc,
				yaml.parse('---\n' + docSource.replace(/^/gm, '  ') + '\n'),
				// These value can't be update
				oldDoc && {
					id: oldDoc.id,
					lang,
					content: contentPath,
					author: oldDoc.author,
					created: oldDoc.created,
				}
			);
		}

		return doc;
	}
})();

function execute(script) {
	return new Promise((resolve, reject) => {
		exec(script, (err, stdout, stderr) => {
			if (err || stderr) return reject(err || stderr);
			resolve(stdout);
		})
	});
}

function getLastModifyDate(filePath) {
	return fetch(`https://api.github.com/graphql`, {
		method: "POST",
		headers: {
			'Authorization': `bearer ${process.env.GITHUB_TOKEN}`
		},
		body: JSON.stringify({
			query: `{ repository(owner: "remtori", name: "my-website-content") {
				ref(qualifiedName: "refs/heads/master") {
					target {... on Commit {
						history(first: 1, path: "${filePath}") {
							edges { node {
								committedDate
								author { name }
							}}
						}
					}}
				}
			}}
		`})
	}).then(r => r.json()).then(r => {
		const node = r.data.repository.ref.target.history.edges[0].node;
		return {
			committedDate: node.committedDate,
			authorName: node.author.name,
		};
	});
}
