browser.commands.getAll().forEach( (command) => {
	let contentToStore = {};
	contentToStore[command.name] = {
		"command": command,
		"cookieStoreId": "",
		"targetPageHTML": ""
	};
	browser.storage.local.set(contentToStore);
});

browser.commands.onCommand.addListener((commName) => {
	browser.storage.local.get(commName).then((content) => {
		browser.tabs.create({
			url: "about:blank",
			cookieStoreId: content.cookieStoreId
		});
	};
});

browser.contextualIdentities.query({}).then((identities) => {
	if (!identities.length) {
		return;
	}

	for(let i = 1; i <= 4; i++) {
		browser.storage.local.get(command
		if( valid.length == 0) break;
		valid = valid[0];


	}
});