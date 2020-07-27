browser.storage.local.clear();		//TODO: This almost certainly shouldn't be here so I preserve data

browser.storage.local.set({ ["custom_pages"]: ""  });

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
		let page_html = content[commName + "_pageHTML"];
		let cookieStoreId = content[commName + "_cookieStoreId"];

		// for some reason, about:newtab is too privileged and you need "" instead.
		tab_specs = {};
		tab_specs.cookieStoreId = cookieStoreId;
		if( ! ( page_html === "" || page_html === (-1).toString() )) {
			if(page_html === (-2).toString() ) {
				tab_specs.url = "about:blank";
			} else {
				tab_specs.url = "destination-page.html";
			}
		}

		let tab = browser.tabs.create(tab_specs).catch((err) => {
			console.log("Error opening tab: " + err);
			if(err.message.includes("No cookie store exists with ID")) {
				delete tab_specs.cookieStoreId;
				browser.tabs.create(tab_specs);
				return;
			}
		});

		if(tab_specs.url === "destination-page.html") {
			Promise.all([ tab,
				browser.storage.local.get( [ "custom_pages" ] ).then( (custom_pages) => {
					return JSON.parse(custom_pages["custom_pages"] || "[]");
				}) ])
			.then( (results) => {
				let i = 0;
				for(; i < results[1].length; ++i) {
					if(results[1][i].selector.toString() === page_html) break;
				}
				if(i >= results[1].length) {
					console.log("No page exists with that selector");
					return;
				}

				return browser.tabs.executeScript(results[0].id, {
					code: `document.body.innerHTML = \`${results[1][i].content}\`;`
				}).catch( (err) => {
					return browser.tabs.executeScript(results[0].id, {
						code: `document.body.innerHTML = \`Sorry, the HTML code you provided gave an error:<br>"${err}"<br>\` + document.body.innerHTML;`
					});
				});
			});
		}
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
