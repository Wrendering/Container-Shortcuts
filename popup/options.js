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

var findTargetOptions = async function(callback) {
	let table = document.getElementById("displayTable");
	table = table.tBodies[0];
	for(let i = 0; i < table.rows.length; ++i) {
		callback(table.rows[i].cells[2].children[0]);
	}
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
	if(message === "onRemoved") {
		updateCommandTable();
	}
});


//---------------------------------------------------------------------------


var removeSubmitResponse = async function(e) {
	e.preventDefault();

	if( ! page_select.value) return;

	const promise_custom = browser.storage.local.get( [ "custom_pages" ] );
	const promise_commands = browser.commands.getAll();
	Promise.all([promise_custom, promise_commands]).then( (results) => {
		let custom_pages = results[0];
		let commands = results[1];
		let content = JSON.parse(custom_pages["custom_pages"] || "[]");

		let i = 0;
		for( ; i < content.length; ++i) {
			if(content[i].selector.toString() === page_select.value ) break;
		}
		if(i >= content.length) { console.log("WTF"); throw -69; }

		// god this is ugly and inefficient
		let get_promises = [];
		commands.forEach( (command) => {	// TODO: These are in the row ids
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
		findTargetOptions( (select) => {
			if(select.options[i].value !== page_select.value) {
				for( i = 0; i < select.options.length; ++i) {
					if(select.options[i].value == page_select.value) {
						break;
					}
				}
			}
			if(i >= select.options) { console.log("WTF"); throw -69; }

			select.remove(select.options[i].index);
			update_promises.push( (targetSelectResponse.call(select)) );
		});

		page_select.remove(page_select.selectedIndex);

		return Promise.all(update_promises);
	}).catch( (e) => {
		console.log("Something went wrong: <removeSubmitResponse> : " + e);
	});
};
document.getElementById("remove_form").addEventListener("submit", removeSubmitResponse);



var addSubmitResponse = async function(e) {
	e.preventDefault();

	await browser.storage.local.get( [ "custom_pages" ] ).then( (custom_pages) => {
		let content = JSON.parse(custom_pages["custom_pages"] || "[]");

		// can, technically, overflow someday
		let max = 19;
		for(let i = 0; i < rs.length; ++i) {
			if(page_select.options[i].disabled) continue;
			let comp = parseInt(page_select.options[i].value);
			max = max < comp ? comp : max;
		}
		max = max + 1;

		let newObject = {
			selector : max,
			title : "New Page(" + max + ")";
			content : ""
		};

		content.push(newObject);
		browser.storage.local.set( { "custom_pages" : JSON.stringify(content) } ).then( () => {
			let newChild = document.createElement('option');
			newChild.value = newObject.selector;
			newChild.innerHTML = newObject.title;
			document.getElementById("remove_select").appendChild(newChild);

			findTargetOptions( (select) => {
				select.appendChild(newChild.cloneNode(true));
			});


			page_title_element.value = "";
			page_content_element.value = "";
		});
	}).catch( (e) => {
		console.log("Something went wrong: <addSubmitResponse> : " + e);
	});
};
document.getElementById("add_form").addEventListener("submit", addSubmitResponse);

document.addEventListener('DOMContentLoaded', async () => {
	updateCommandTable();
	page_select.innerHTML = await constructEmptyTargetInnerHTML();
});

//---------------------------------------------------------------------------


var DefaultTextContainer = function( id, propName, errorElementId ) {

	this.relevantElement = document.getElementById(id);

	// Anything that can modify the content needs a listener below

	this.eCR_i = -1;	// current index, so we short-circuit the loop when called repeatedly
	this.eCR_content = null;
	this.getContentStore = () => { return eCR_content[eCR_i][propName]; };
	this.setContentStore = (value) => { eCR_content[eCR_i][propName] = value; };

	this.storeContentResponse = async function() {
		this.setContentStore(this.relevantElement.value.replace("`", "\\`").replace("${", "\\${") );

		return browser.storage.local.set( { "custom_pages" : JSON.stringify(eCR_content) } );
	};

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
	};


	document.addEventListener('DOMContentLoaded', this.updateContentResponse);

	this.relevantElement.addEventListener("change", this.storeContentResponse);
	window.addEventListener("unload", this.storeContentResponse);
	this.addEventListener("commandQuery", this.storeContentResponse);

	document.getElementById("page_select").addEventListener("change",
		this.storeContentResponse.then(this.updateContentResponse));
	// any others? probably tab change



	this.errorElement = document.getElementById(errorElementId);
	this.errored = false;
	this.addError = function(message) {
		this.errored = true;
		this.errorElement.textContent = message;
		this.errorElement.className = 'error active';
	};
	this.clearError = function() {
		if(this.errored) {
			this.errored = false;
			this.errorElement.innerHTML = '';
			this.errorElement.className = 'error';
		}
	};
	this.relevantElement.addListener("input", this.clearError);

};


var ContentTextContainer = function( id, propName, errorElementId) {
	DefaultTextContainer.call(this, id, propName, errorElementId);
};
ContentTextContainer.prototype = Object.create(DefaultTextContainer.prototype);
ContentTextContainer.prototype.constructor = ContentTextContainer;


var TitleTextContainer = function( id, propName, errorElementId) {
	DefaultTextContainer.call(this, id, propName, errorElementId);

	this.storeContentResponse = async function() {

		// https://developer.mozilla.org/en-US/docs/Learn/Forms/Form_validation
		if(add_title.value === "") {
			this.addError('A title is required');
			this.relevantElement.innerHTML = this.getContentStore();
			return;
		}

		for( let i = 0; i < rs.children.length; ++i) {
			if(! rs.options[i].disabled && rs.options[i].innerText === add_title.value) {
				this.addError('Titles must be unique');
				this.relevantElement.innerHTML = this.getContentStore();
				return;
			}
		}

		this.updateTargetOptions( (select, option_index) => {
			select.options[option_index].innerText = this.relevantElement.value;
		});

		return TitleTextContainer.prototype.storeContentResponse.call(this);
	};


	// utility methods
	this.updateTargetOptions(callback) = function(callback) {
		findTargetOptions( (select) => {	// defined in 1st section
			callback(select, this.getTargetIndex(select));
		});
	};
	this.uTO_i = 0;
	this.getTargetIndex = function(select) {
		if(select.options[uTO_i].value !== rs.value) {
			for( uTO_i = 0; uTO_i < select.options.length; ++uTO_i) {
				if(select.options[uTO_i].value == rs.value) break;
			}
		}
		if(uTO_i >= select.options) { console.log("WTF"); throw -69; }
	};

};
TitleTextContainer.prototype = Object.create(DefaultTextContainer.prototype);
TitleTextContainer.prototype.constructor = TitleTextContainer;



// ** depends on tabbing impl
var page_select = document.getElementById("page_select");

var page_content_element = document.getElementById("page_content");
var page_title_element = document.getElementById("page_title");

var page_content_container = new ContentTextContainer("page_content", "content", "page_content_error");
var page_title_container = new TitleTextContainer("page_title", "title", "page_title_error");


// ---------------------------------------------------------------------------


var commandQueryEvent = ("commandQuery", { detail: {} });

browser.runtime.onMessage.addListener(async (message) => {
	if(message.substring(0, 12) == "commandQuery") {
		// Check if the command in question is the one currently being edited
		if(document.getElementById("row_" + message.substring(12)).cells[2].children[0].value == page_select_element.value) {
			// HANDLE ALL the relevant things that may need saving
			// could probably check only if currently selected, either by saving or checking selected status, but eh
			// TODO: Either make async, or test to show self this is pointless optimization
			page_content.dispatchEvent(commandQueryEvent);
			page_title.dispatchEvent(commandQueryEvent);
		}

		browser.runtime.sendMessage("commandResponse").catch(err => {
			console.log("ERROR: Popup was told about command, but bkg won't accept response: " + err);
		});
	}
});
