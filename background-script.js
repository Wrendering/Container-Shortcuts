browser.commands.getAll().then( (commands) => {
	commands.forEach( (command) => {
		browser.storage.local.get(command.name + "_command").then((content) => {
			browser.storage.local.set({ [command.name + "_command"]: command });
		});
		browser.storage.local.get(command.name + "_cookieStoreId").then((content) => {
			browser.storage.local.set({ [command.name + "_cookieStoreId"]: "" });
		});
		browser.storage.local.get(command.name + "_pageHTML").then((content) => {
			browser.storage.local.set({ [command.name + "_pageHTML"]: "" });
		});
	});
});

browser.commands.onCommand.addListener( (commName) => {
	browser.storage.local.get( [commName + "_command", commName + "_cookieStoreId", commName + "_pageHTML" ]).then((content) => {
		browser.tabs.create({
			url: "about:blank",
			cookieStoreId: content[commName + "_cookieStoreId"]
		});
	});
});