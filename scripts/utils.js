const fetch = require('cross-fetch');
const { exec } = require('child_process');

function execute(script) {
	return new Promise((resolve, reject) => {
		exec(script, (err, stdout, stderr) => {
			if (err || stderr) return reject(err || stderr);
			resolve(stdout);
		})
	});
}

function triggerBuild(url) {
	return fetch(url, {
		method: "POST",
		body: '{}'
	});
}

function getBuildData() {
	return fetch(
		'https://firestore.googleapis.com/v1/projects/remtori/databases/(default)/documents/utils/netlify'
	).then(r => r.json())
	.then(r => {
		try {
			return {
				build_url: r.fields.build_url.stringValue,
				generated_commit: r.fields.generated_commit.stringValue,
			}
		} catch(e) {
			console.log("Parse Firestore Data Error:");
			console.log(r);
			process.exit(1);
		}
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
		try {
			const node = r.data.repository.ref.target.history.edges[0].node;
			return {
				committedDate: node.committedDate,
				authorName: node.author.name,
			};
		}
		catch(e) {
			console.log("Parse Github Data Error:");
			console.log(r);
			process.exit(1);
		}
	});
}

module.exports = { execute, getLastModifyDate, getBuildData, triggerBuild };
