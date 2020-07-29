"use strict"

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

var constructEmptyTargetInnerHTML = async function(targetHTML) {
	if(typeof targetHTML == "undefined") targetHTML = "";
	await browser.storage.local.get( [ "custom_pages" ] ).then( (custom_pages) => {
		let content = JSON.parse(custom_pages["custom_pages"] || "[]");
		content.forEach( (page) => {
			targetHTML += `<option value='${page.selector}'>${page.title}</option>`;
		});
	});

	return targetHTML;
};

var constructTargetHTML = async function() {
	let targetHTML = "<option value='-1'>Default (about:newtab)</option>";
	targetHTML += "<option value='-2'>Blank (about:blank)</option>";
	targetHTML += "<option disabled>-Custom pages: &#9472;</option>";

	targetHTML = await constructEmptyTargetInnerHTML(targetHTML);

	targetHTML = "<select>" + targetHTML + "</select>";

	return targetHTML;
};

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
	let newBody = document.createElement('tbody');

	Promise.all( [constructSelectHTML(), constructTargetHTML()]  ).then( (vals) => {
		const selectHTML = vals[0];
		const targetHTML = vals[1];

		browser.commands.getAll().then( (commands) => {
			commands.forEach( (command) => { constructRow(newBody, selectHTML, targetHTML, command); } );
		});

		table.parentNode.replaceChild(newBody, table);
	});
}

browser.runtime.onMessage.addListener(async (message) => {
	updateCommandTable();
});






var updateTargetOptions = async function(callback) {
	let table = document.getElementById("displayTable");
	table = table.tBodies[0];
	for(let i = 0; i < table.rows.length; ++i) {
		callback(table.rows[i].cells[2].children[0]);
	}
};

var removeSubmitResponse = async function(e) {
	e.preventDefault();

	const rs = document.getElementById("remove_select");
	if( ! rs.value) return;

	const promise_custom = browser.storage.local.get( [ "custom_pages" ] );
	const promise_commands = browser.commands.getAll();
	Promise.all([promise_custom, promise_commands]).then( (results) => {
		let custom_pages = results[0];
		let commands = results[1];
		let content = JSON.parse(custom_pages["custom_pages"] || "[]");

		let i = 0;
		for( ; i < content.length; ++i) {
			if(content[i].selector.toString() === rs.value ) break;
		}
		if(i >= content.length) { console.log("WTF"); throw -69; }

		// god this is ugly and inefficient
		let get_promises = [];
		commands.forEach( (command) => {
			let commName = command.name;
			get_promises.push( browser.storage.local.get( [ commName + "_pageHTML" ]).then((conn) => {
				 if( conn[commName + "_pageHTML"] === content[i].selector ) {
					  return browser.storage.local.set( { [ commName + "_pageHTML" ] : "" } );
				 }
			}) );
		});

		return Promise.all(get_promises).then( () => {
			content.splice(i, 1);
			return browser.storage.local.set({ "custom_pages" : JSON.stringify(content) }) ;
		} );

	}).then( () => {
		let update_promises = [];
		let i = 0;
		updateTargetOptions( (select) => {
			if(select.options[i].value !== rs.value) {
				for( i = 0; i < select.options.length; ++i) {
					if(select.options[i].value == rs.value) {
						break;
					}
				}
			}
			if(i >= select.options) { console.log("WTF"); throw -69; }

			select.remove(select.options[i].index);
			update_promises.push( (targetSelectResponse.call(select)) );
		});

		rs.remove(rs.selectedIndex);

		return Promise.all(update_promises);
	}).catch( (e) => {
		console.log("Something went wrong: <removeSubmitResponse> : " + e);
	});
};
document.getElementById("remove_form").addEventListener("submit", removeSubmitResponse);


var clearTitleError = function() {
	const ate = document.getElementById("add_title_error");
	ate.innerHTML = '';
	ate.className = 'error';
};
document.getElementById("add_title").addEventListener("input", clearTitleError);

var clearContentError = function() {
	const ace = document.getElementById("add_content_error");
	ace.innerHTML = '';
	ace.className = 'error';
};
document.getElementById("add_content").addEventListener("input", clearContentError);

var addSubmitResponse = async function(e) {
	e.preventDefault();

	const add_title = document.getElementById("add_title");
	const add_content = document.getElementById("add_content");
	const rs = document.getElementById("remove_select");
	const ate = document.getElementById("add_title_error");
	const ace = document.getElementById("add_content_error");


	// https://developer.mozilla.org/en-US/docs/Learn/Forms/Form_validation
	if(add_title.value === "") {
		ate.textContent = 'A title is required';
		ate.className = 'error active';
		return;
	}

	for( let i = 0; i < rs.children.length; ++i) {
		if(! rs.options[i].disabled) {
			if(rs.options[i].innerText === add_title.value) {
				ate.textContent = 'Titles must be unique';
				ate.className = 'error active';
				return;
			}
		}
	}

	clearTitleError();

	await browser.storage.local.get( [ "custom_pages" ] ).then( (custom_pages) => {
		let content = JSON.parse(custom_pages["custom_pages"] || "[]");

		// can, technically, overflow someday
		let max = 19;
		for(let i = 0; i < rs.length; ++i) {
			if(rs.options[i].disabled) continue;
			let comp = parseInt(rs.options[i].value);
			max = max < comp ? comp : max;
		}
		max = max + 1;

		let newObject = {
			selector : max,
			title : add_title.value,
			content : add_content.value.replace("`", "\\`").replace("${", "\\${");
		};

		content.push(newObject);
		browser.storage.local.set( { "custom_pages" : JSON.stringify(content) } ).then( () => {
			let newChild = document.createElement('option');
			newChild.value = newObject.selector;
			newChild.innerHTML = newObject.title;
			document.getElementById("remove_select").appendChild(newChild);

			updateTargetOptions( (select) => {
				select.appendChild(newChild.cloneNode(true));
			});


			add_title.value = "";
			add_content.value = "";
		});
	}).catch( (e) => {
		console.log("Something went wrong: <addSubmitResponse> : " + e);
	});
};
document.getElementById("add_form").addEventListener("submit", addSubmitResponse);





var DefaultTextContainer = function( id, propName ) {

	this.relevantElement = document.getElementById(id);

	// Anything that can modify the content needs a listener below

	this.eCR_i = -1;	// current index, so we short-circuit the loop when called repeatedly
	this.eCR_content = null;

	this.editContentResponse = async function() {
		// careful with how long this may take... make async somehow, if possible?
		eCR_content[eCR_i].content = add_content.value;
	};
	this.relevantElement.addEventListener("input", this.editContentResponse);


	this.storeContentResponse = async function() {
		eCR_content[eCR_i][propName] = add_content.value.replace("`", "\\`").replace("${", "\\${");

		return browser.storage.local.set( { "custom_pages" : JSON.stringify(eCR_content) } );
	}
	window.addEventListener("unload", this.storeContentResponse);
	this.relevantElement.addEventListener("change", this.storeContentResponse);
	// TODO: add one for whenever the relevant command is run,
	//  just in case the panels' open, that'll override the bkg script


	this.updateContentResponse = async function() {
		if(eCR_i === -1 || eCR_content[eCR_i].selector.toString() !== page_select.value) {
			for( eCR_i = 0 ; eCR_i < content.length; ++eCR_i) {
				if(eCR_content[eCR_i].selector.toString() === page_select.value ) break;
			}
			if(eCR_i >= content.length) { console.log("WTF"); throw -69; }
		}

		await browser.storage.local.get( [ "custom_pages" ] ).then( (custom_pages) => {
			eCR_content = JSON.parse(custom_pages["custom_pages"] || "[]");
		}
	}
	document.getElementById("page_select").addEventListener("change", this.updateContentResponse);
	document.addEventListener('DOMContentLoaded', this.updateContentResponse);
	// any others? probably tab change

};



// ** depends on tabbing impl
var page_select_element = document.getElementById("page_select");
var page_content_element = document.getElementById("page_content");
var page_title_element = document.getElementById("page_title");

var page_select = new DefaultTextContainer("page_content", "content");
var page_title = new DefaultTextContainer("page_title", "title");
page_title





document.addEventListener('DOMContentLoaded', async () => {
	updateCommandTable();
	document.getElementById("remove_select").innerHTML = await constructEmptyTargetInnerHTML();
});
