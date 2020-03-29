let table = document.getElementById("Display Table");

browser.commands.getAll().then( (commands) => {
	commands.forEach( (command) => {
		let commName = command.name;
		browser.storage.local.get( [commName + "_command", commName + "_cookieStoreId", commName + "_pageHTML" ]).then((content) => {
			console.log(content);
			let row = table.insertRow(table.length);
			let cell_shrct = row.insertCell(0);
			let cell_cntnr = row.insertCell(1);

			let cell_shrct_id = "shrct_cell_" + commName;
			cell_shrct.innerHTML = "<input type='text' id='" + cell_shrct_id + "' value='" + command.shortcut + "' >";
			let cell_cntnr_id = "cntnr_cell_" + commName;
			cell_cntnr.innerHTML = "<label for='" + cell_cntnr_id + "' >" + ( content[commName + "_cookieStoreId"] ? browser.contextualIdentities.get(content[commName + "_cookieStoreId"]).name : "" ) + "</label><input type='text' id='" + cell_cntnr_id + "' >";
		});
	});
});