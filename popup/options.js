var indexMap = {} ;
var revIndexMap = {} ;

var customMap = {}


var shortcutSelectResponse = async function() {
	let row = this.parentElement.parentElement;
	let rowI = row.rowIndex;
	let commName = row.id.substring(4);

	await browser.commands.update({
		name: commName,
		shortcut: row.cells[0].children[0].value
	});
};

var containerSelectResponse = async function() {
	let row = this.parentElement.parentElement;
	let rowI = row.rowIndex;
	let commName = row.id.substring(4);

	indexMap[revIndexMap[rowI]] = rowI;
	revIndexMap[rowI] = this.value;

	let temppp = {} ; temppp[commName + "_cookieStoreId"] = this.value ;
	await browser.storage.local.set(temppp) ;
};

var targetSelectResponse = async function() {
	let row = this.parentElement.parentElement;
	let rowI = row.rowIndex;
	let commName = row.id.substring(4);

	let temppp = {} ; temppp[commName + "_pageHTML"] = this.value ;
	await browser.storage.local.set(temppp) ;
};

var constructEmptyTargetHTML = async function(targetHTML) {
	await browser.storage.local.get( [ "custom_pages" ] ).then( (custom_pages) => {
		content = JSON.parse(custom_pages["custom_pages"] || "[]");
		content.forEach( (page) => {
			targetHTML += `<option value='${page.selector}'>${page.title}</option>`;
		});
	});

	targetHTML = "<select>" + targetHTML + "</select>";
	return targetHTML;
};

var constructTargetHTML = async function() {
	let targetHTML = "<option value='0'>Default (about:newtab)</option>";
	targetHTML += "<option value='1'>Blank (about:blank)</option>";
	targetHTML += "<option disabled>-Custom pages: &#9472;</option>";

	targetHTML = constructEmptyTargetHTML(targetHTML);
	return targetHTML;
};

/*
let contentVal = commName + "_pageHTML";
await browser.storage.local.get( [ contentVal ]).then((content) => {
	content[contentVal]
});
*/

var constructSelectHTML = async function() {
	let selectHTML = "<option value=''>Default Container</option>";
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

	return selectHTML;
};

var constructRow = function(newBody, selectHTML, targetHTML, command) {
	let commName = command.name;
	browser.storage.local.get( [ commName + "_cookieStoreId", commName + "_pageHTML" ]).then((content) => {
		let row = newBody.insertRow(newBody.length);
		row.id = "row_" + commName ;

		let cell_shrct = row.insertCell(0);
		let cell_cntnr = row.insertCell(1);
		let cell_targt = row.insertCell(2);

		cell_shrct.innerHTML = "<input type='text' id='" + ("shrct_cell_" + commName) + "' value='" + command.shortcut + "' >";
		cell_cntnr.innerHTML = selectHTML;
		cell_cntnr.id = "cntnr_cell_" + commName;
		cell_targt.innerHTML = targetHTML;
		cell_targt.id = "targt_cell_" + commName;


		cell_cntnr.children[0].selectedIndex = indexMap[ content[commName + "_cookieStoreId"] ] ;

		let cellt = cell_targt.children[0];	// god i hate <select>
		for(let i = 0; i < cellt.options.length; ++i) {
			if(cellt.options[i].value === content[commName + "_pageHTML"]) {
				cellt.selectedIndex = i;
				break;
			}
		}

		cell_shrct.children[0].onchange = shortcutSelectResponse;
		cell_cntnr.children[0].onchange = containerSelectResponse;
		cell_targt.children[0].onchange = targetSelectResponse;
	});
};

var updateCommandTable = async function() {

	let table = document.getElementById("displayTable");
	table = table.tBodies[0];
	newBody = document.createElement('tbody');

	let selectHTML = await constructSelectHTML();
	let targetHTML = await constructTargetHTML();

	browser.commands.getAll().then( (commands) => {
		commands.forEach( (command) => { constructRow(newBody, selectHTML, targetHTML, command); } );
	});

	table.parentNode.replaceChild(newBody, table);
}
document.addEventListener('DOMContentLoaded', updateCommandTable);

browser.runtime.onMessage.addListener(async (message) => {
	updateCommandTable();
});








var removeSubmitResponse = async function(e) {
	e.preventDefault();

	rs = document.getElementById("remove_select");
	if( ! rs.value) return;

	await browser.storage.local.get( [ "custom_pages" ] ).then( (custom_pages) => {
		content = JSON.parse(custom_pages["custom_pages"] || "[]");

		let i = 0;
		for( ; i < content.length; ++i) {
			if(content[i].selector === rs.value) break;
		}

		// god this is ugly and inefficient
		await browser.commands.getAll().then( (commands) => {
			// could get from the table iterator? ugh even worse. or just 1 to 10?
			commands.forEach( (command) => {
				let commName = command.name;
				await browser.storage.local.get( [ commName + "_pageHTML" ]).then((conn) => {
					 if( conn[commName + "_pageHTML"] === content[i].selector ) {
						 await browser.storage.local.set( { [ commName + "_pageHTML" ] : "" } );
							 // need to batch these promises
					 }
				});
			});
		});


		content.splice(i, 1);
		await browser.storage.local.set( { "custom_pages" : JSON.stringify(content) } );
	});

	await updateCustomOptions();
};
document.getElementById("remove_form").addEventListener("submit", removeSubmitResponse);



var addSubmitResponse = async function(e) {
	e.preventDefault();

	await browser.storage.local.get( [ "custom_pages" ] ).then( (custom_pages) => {
		content = JSON.parse(custom_pages["custom_pages"] || "[]");

		// can, technically, overflow someday
		let rs = document.getElementById("remove_select");
		let max = -1;
		for(let i = 0; i < rs.length; ++i) {
			let comp = rs.options[i].value;
			max = max < comp ? comp ; max;
		}
		max = max + 1;

		newObject = {
			selector : max,
			title : document.getElementById("add_title").value,
			content : document.getElementById("add_content").value
		};

		content.push(newObject);
		await browser.storage.local.set( { "custom_pages" : JSON.stringify(content) } );

	});
	await updateCustomOptions();
};
document.getElementById("add_form").addEventListener("submit", addSubmitResponse);


var updateCustomOptions = async function() {
	document.getElementById("remove_select").innerHTML = constructEmptyTargetHTML();

};
document.addEventListener('DOMContentLoaded', updateCustomOptions);
