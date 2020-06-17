/*var yuh = function(fdas) {
	console.log("Message receieved: " + fdas);
}
browser.runtime.onMessage.addListener(yuh);
*/

var updateCommandTable = async function() {

	let table = document.getElementById("displayTable");
	table = table.tBodies[0];

	let indexMap = {} ;
	let revIndexMap = {} ;
	let selectHTML = "<option value=''>Default Tab</option>";
	await browser.contextualIdentities.query({}).then( (identities) => {
		let i = 1 ;
		identities.forEach( (ident) => {
			selectHTML += "<option value='" + ident.cookieStoreId + "' >" + ident.name + "</option>";
			// + "<img src='" + ident.iconUrl + "' alt='" + ident.icon + "' style='height:1ex;' > "
			indexMap[ident.cookieStoreId] = i ;
			revIndexMap[i] = ident.cookieStoreId;
			i += 1 ;
		});
	});
	selectHTML = "<select>" + selectHTML + "</select>";

	browser.commands.getAll().then( (commands) => {
		commands.forEach( (command) => {
			let commName = command.name;
			browser.storage.local.get( [ commName + "_cookieStoreId", commName + "_pageHTML" ]).then((content) => {
				let row = table.insertRow(table.length);
				row.id = "row_" + commName ;

				let cell_shrct = row.insertCell(0);
				let cell_cntnr = row.insertCell(1);

				let cell_shrct_id = "shrct_cell_" + commName;
				cell_shrct.innerHTML = "<input type='text' id='" + cell_shrct_id + "' value='" + command.shortcut + "' >";
				let cell_cntnr_id = "cntnr_cell_" + commName;
				cell_cntnr.innerHTML = selectHTML;

				cell_cntnr.children[0].selectedIndex = indexMap[ content[commName + "_cookieStoreId"] ] ;
				cell_cntnr.children[0].onchange = async function(){
					let row = this.parentElement.parentElement;
					let rowI = row.rowIndex;
					indexMap[revIndexMap[rowI]] = rowI;
					revIndexMap[rowI] = this.value;

					let commName = row.id.substring(4);
					await browser.commands.update({
						name: commName,
						shortcut: row.cells[0].children[0].value
					});
					let temppp = {} ; temppp[commName + "_cookieStoreId"] = this.value ;
					await browser.storage.local.set(temppp) ;
					await browser.storage.local.set({ [commName + "_pageHTML"]: "" });
				};
			});
		});
	});
}
document.addEventListener('DOMContentLoaded', updateCommandTable);

var updateShortcuts = async function(e) {
	e.preventDefault();
	/*let table = document.getElementById("displayTable").tBodies[0];

	let rep = 0 ;
	for(let i = 1, row; row = table.rows[i]; i++) {
		rep += 1 ;
		let commName = row.id.substring(4);
		await browser.commands.update({
			name: commName,
			shortcut: row.cells[0].children[0].value
		});
		//console.log("a1");
		let temppp = {} ; temppp[commName + "_cookieStoreId"] = row.cells[1].children[0].options[row.cells[1].children[0].selectedIndex].value ;
		await browser.storage.local.set(temppp) ;
		//.then(() => {console.log("ok")}, (err) => {console.log("err: " + err)});
		//console.log("a2");
		await browser.storage.local.set({ [commName + "_pageHTML"]: "" });
	}//*/
	//await updateCommandTable();

	//console.log("r: " + rep);
}
document.querySelector("form").addEventListener("submit", (e) => { updateShortcuts(e); } );

/*
document.getElementById('test').addEventListener('click', async function() {
	console.log("*******");
	console.log(">> Local storage:");
	await browser.storage.local.get(null).then( (content) => { console.log(content) } );
	console.log(">> Commands:");
	await browser.commands.getAll().then( (content) => { console.log(content) } );
	console.log(">> Stuff:");
	await browser.storage.local.get(["com1" + "_cookieStoreId"]).then( (content) => { console.log(content) } );
	console.log("*******\n");
	browser.storage.local.clear();
});*/
