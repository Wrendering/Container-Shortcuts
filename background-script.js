browser.storage.local.clear();		//TODO: This almost certainly shouldn't be here so I preserve data

browser.commands.getAll().then( (commands) => {
	commands.forEach( (command) => {
		browser.storage.local.get(command.name + "_cookieStoreId").then((content) => {
			browser.storage.local.set({ [command.name + "_cookieStoreId"]: "" });
		});
		browser.storage.local.get(command.name + "_pageHTML").then((content) => {
			browser.storage.local.set({ [command.name + "_pageHTML"]: "" });
		});
	});
});

browser.commands.onCommand.addListener( (commName) => {
	browser.storage.local.get( [commName + "_cookieStoreId", commName + "_pageHTML" ]).then((content) => {
		browser.tabs.create({
			url: "about:blank ",
			cookieStoreId: content[commName + "_cookieStoreId"]
		}).catch((err) => {
			if(err.message.includes("No cookie store exists with ID")) {
				browser.tabs.create({
					url: "about:blank "
				});
				return;
			}
		});
	});
});


browser.contextualIdentities.onCreated.addListener( async (item) => {
	browser.runtime.sendMessage("onCreated").catch(err => {});
});

browser.contextualIdentities.onUpdated.addListener( async (item) => {
	browser.runtime.sendMessage("onUpdated").catch(err => {});
});

browser.contextualIdentities.onRemoved.addListener( async (item) => {
	const storage = await browser.storage.local.get(null);
	Object.keys(storage).forEach( async (key) => {
		if(key.includes("_cookieStoreId") && item.contextualIdentity.cookieStoreId === storage[key]) {
			let delObj = {}; delObj[key] = "";
			await browser.storage.local.set(delObj);
		};
	});
	browser.runtime.sendMessage("onRemoved").catch(err => {});
});
