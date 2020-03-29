var table = document.getElementById("displayTable");

var updateTable = async function() {
	browser.commands.getAll().then( (commands) => {
		commands.forEach( (command) => {
			let commName = command.name;
			browser.storage.local.get( [commName + "_command", commName + "_cookieStoreId", commName + "_pageHTML" ]).then((content) => {
				let row = table.insertRow(table.length);
				row.id = "row_" + commName ;

				let cell_shrct = row.insertCell(0);
				let cell_cntnr = row.insertCell(1);
	
				let cell_shrct_id = "shrct_cell_" + commName;
				cell_shrct.innerHTML = "<input type='text' id='" + cell_shrct_id + "' value='" + command.shortcut + "' >";
				let cell_cntnr_id = "cntnr_cell_" + commName;
				cell_cntnr.innerHTML = "<label for='" + cell_cntnr_id + "' >" + ( content[commName + "_cookieStoreId"] ? browser.contextualIdentities.get(content[commName + "_cookieStoreId"]).name : "" ) + "</label><input type='text' id='" + cell_cntnr_id + "' >";

			});
		});
	});
}

document.addEventListener('DOMContentLoaded', updateTable);


var updateShortcuts = async function() {
	for(let i = 1, row; row = table.rows[i]; i++) {
		console.log(row);
		browser.commands.update({
			name: row.id.substring(4),
			shortcut: row.cells[0].children[0].value
		});
	}
}

document.getElementById('update').addEventListener('click', updateShortcuts);