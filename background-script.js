browser.contextualIdentities.query({}).then((identities) => {
	if (!identities.length) {
		return;
	}

	for(let i = 1; i <= 4; i++) {
		let valid = identities.filter( iden => iden.name.includes( i.toString() ) )
		if( valid.length == 0) break;
		valid = valid[0];

		browser.commands.onCommand.addListener((command) => {
			if(command.includes(i.toString())) {
				browser.tabs.create({
					url: "https://developer.mozilla.org",
					cookieStoreId: valid.cookieStoreId
				});	
			}
		});
	}
});