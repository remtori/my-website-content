const fetch = require('node-fetch');
const { exec } = require('child_process');

function execute(script) {
	return new Promise((resolve, reject) => {
		exec(script, (err, stdout, stderr) => {
			if (err) return reject(new Error(err));
			resolve(stdout + (stderr || ''));
		})
	});
}

// List of all the "content" that has changed
function contentDiff(sha1) {

	const updatedFiles = [];
	const removedFiles = [];

	return execute(`git diff --name-status ${sha1}`).then(diffs => {
		diffs.split('\n')
		.filter(
			s => /^[AMD]\tcontent\/(\w+)\//.test(s)
		)
		.forEach(
			p => (
				p[0] !== 'D'
				? updatedFiles
				: removedFiles
			).push(
				p.slice(2)
			)
		);

		return { updatedFiles, removedFiles };
	});
}

function triggerBuild(url) {
	return fetch(url, {
		method: "POST",
		body: '{}'
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
			console.log(e);
			process.exit(1);
		}
	});
}

module.exports = {
	execute, contentDiff, triggerBuild, getLastModifyDate,
};
