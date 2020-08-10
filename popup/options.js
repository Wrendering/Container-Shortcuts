"use strict"

// for command redirection; see below
let connection_port = browser.runtime.connect();


//----------------------------------------------------------------------------------------------------------------------------
/*   Primary Select Table    */

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
	return browser.storage.local.get( [ "custom_pages" ] ).then( (custom_pages) => {
		let content = JSON.parse(custom_pages["custom_pages"] || "[]");
		content.forEach( (page) => {
			targetHTML += `<option value='${page.selector}'>${page.title}</option>`;
		});

		return targetHTML;
	});
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

document.addEventListener('DOMContentLoaded', async () => {
	updateCommandTable();
});

//----------------------------------------------------------------------------------------------------------------------------
/*   Add/Remove Page Tab    */

var removeSubmitResponse = async function(e) {
	e.preventDefault();

	if( Nable() ) return;

	//const promise_custom = browser.storage.local.get( [ "custom_pages" ] );
	// this is really unnecessary, just cache it
	const promise_commands = browser.commands.getAll();
	Promise.all([ /*promise_custom,*/ promise_commands]).then( (results) => {
		//let custom_pages = results[0];
		let commands = results[0];
		//let content = JSON.parse(custom_pages["custom_pages"] || "[]");
		let content = eCR.content;

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
			//return browser.storage.local.set({ "custom_pages" : JSON.stringify(content) }) ;
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
		page_select.selectedIndex = 0;	// should be the --- option
		eCR.update(); // actually just sets i to -1 really
		page_select.dispatchEvent(my_disableEvent);

		return Promise.all(update_promises);
	}).catch( (e) => {
		console.log("Something went wrong: <removeSubmitResponse> : " + e);
	});
};
document.getElementById("remove_button").addEventListener("click", removeSubmitResponse);



var addSubmitResponse = async function(e, intitle, incontent) {
	e.preventDefault();

	let content = eCR.content;

	// can, technically, overflow someday
	let max = 19;
	for(let i = 0; i < page_select.options.length; ++i) {
		if(page_select.options[i].disabled) continue;
		let comp = parseInt(page_select.options[i].value);
		max = max < comp ? comp : max;
	}
	max = max + 1;

	let newObject = {
		selector : max,
		title : (typeof intitle == "undefined") ? "New Page(" + max + ")" : intitle,
		content : (typeof incontent == "undefined") ? "" : incontent
	};

	content.push(newObject);

	let newChild = document.createElement('option');
	newChild.value = newObject.selector;
	newChild.innerHTML = newObject.title;

	page_select.appendChild(newChild);
	page_select.selectedIndex = newChild.index;
	page_select.dispatchEvent(new Event('change'));

	findTargetOptions( (select) => {
		select.appendChild(newChild.cloneNode(true));
	});

};
document.getElementById("add_button").addEventListener("click", (e) => { addSubmitResponse(e); } );


var cloneSubmitResponse = async function(e) {
	// TODO: rename eCR content and page.content, that's just an accident waiting to happen
	addSubmitResponse(e, "copy of " + eCR.page.title, eCR.page.content);
};
document.getElementById("clone_button").addEventListener("click", cloneSubmitResponse);

//var uploadSubmitResponse = async function(e) {
//
//	addSubmitResponse(e, , );
//};
//document.getElementById("clone_button").addEventListener("click", uploadSubmitResponse);


//----------------------------------------------------------------------------------------------------------------------------
/*   Title / Content Storage    */


var eCR = {

	i: -1,	// current index, so we short-circuit the loop when called repeatedly
	content: null,	// a local copy of the custom_pages

	get page() {
		return this.content[this.i];
	},

	get turnt() {
		return this.i != -1;
	},

	load: async function() {
		return browser.storage.local.get( [ "custom_pages" ] ).then( (custom_pages) => {
			this.content = JSON.parse(custom_pages["custom_pages"] || "[]");
		});
	},

	save: async function() {
		return browser.storage.local.set( { "custom_pages" : JSON.stringify(this.content) } );
	},

	get invalid() { // TODO: honestly prob take this out shouldn't need to rely on it
		return (this.i == -1 || this.content[this.i].selector.toString() !== page_select.value);
	},

	// ensure that we're currently selecting the same as the page_select box
	update: function() {
		if(Nable()) {
			this.i = -1;
			return;
		}

		for( this.i = 0 ; this.i < this.content.length; ++this.i) {
			if(this.content[this.i].selector.toString() === page_select.value ) break;
		}

		if(this.i >= this.content.length) {
			console.log("eCR broken update:"); console.trace();
			throw -100;
		}
	}

};

var DefaultTextContainer = function( id, propName, errorElementId ) {

	let child = this;	// in case I, idk, add a parent or something at some point

	child.relevantElement = document.getElementById(id);

	page_select.addEventListener("my_enable",  (() => {
		this.relevantElement.removeAttribute('disabled');
	}).bind(child) );
	page_select.addEventListener("my_disable", (() => {
		this.relevantElement.disabled = true;
		this.relevantElement.value = "";
	}).bind(child) );

	// Anything that can modify the content needs a listener below

	child.getContentStore = () => { return eCR.page[propName]; };
	child.setContentStore = (value) => { eCR.page[propName] = value; };

	// Stores the content to ecr. does not save ecr for you
	child.storeContentResponse = function() {
		this.setContentStore(this.relevantElement.value.replace("`", "\\`").replace("${", "\\${") );
	};

	// Loads the appropriate content from eCR. Assumes that eCR_i already set.
	child.loadContentResponse = function() {
		this.relevantElement.value = this.getContentStore();
	};

	child.relevantElement.addEventListener("change", (() => { this.storeContentResponse(); }).bind(child) );

	page_select.addEventListener("my_beforechange", (() => { this.storeContentResponse(); }).bind(child) );
	page_select.addEventListener("my_afterchange", (() => { this.loadContentResponse(); }).bind(child) );
	// any others? probably tab change



	child.errorElement = document.getElementById(errorElementId);
	child.errored = false;
	child.addError = function(message) {
		this.errored = true;
		this.errorElement.textContent = message;
		this.errorElement.className = 'error active';
	};
	child.clearError = function() {
		if(this.errored) {
			this.errored = false;
			this.errorElement.innerHTML = '';
			this.errorElement.className = 'error';
		}
	};
	child.relevantElement.addEventListener("input", (() => { this.clearError(); }).bind(child) );

	return child;
};


var ContentTextContainer = function( id, propName, errorElementId) {
	let child = new DefaultTextContainer(id, propName, errorElementId);
	return child;
};


var TitleTextContainer = function( id, propName, errorElementId) {
	let child = new DefaultTextContainer(id, propName, errorElementId);

	let super_storeContentResponse = child.storeContentResponse;
	child.storeContentResponse = function() {
		if( ! this.validateOrError() ) return;
		this.updateTargetOptions( (select, option_index) => {
			select.options[option_index].innerText = this.relevantElement.value;
		},  eCR.page.selector.toString() );
		page_select[this.getTargetIndex(page_select, eCR.page.selector.toString() )].innerText = this.relevantElement.value;

		return (super_storeContentResponse.bind(this))();
	};

	child.validateOrError = function() {
		if(this.relevantElement.value === "") {
			this.addError('A title is required');
			this.relevantElement.value = this.getContentStore();
			return false; //for inscrutable reasons, can't write to innerText/HTML
		}
		// TODO: onkey updates time var and edit bool,
		//once/second checks bool, then most recent upd >1 sec ago, then check err condition

		for( let i = 0; i < page_select.options.length; ++i) {
			let temp = page_select.options[i];
			if(! temp.disabled && temp.innerText === this.relevantElement.value) {
				if(temp.value == eCR.page.selector.toString()) continue;

				this.addError('Titles must be unique');
				this.relevantElement.value = this.getContentStore();
				return false;
			}
		}
		return true;
	};

	// utility methods
	child.updateTargetOptions = function(callback, targetVal) {
		findTargetOptions( (select) => {	// defined in 1st section
			callback(select, this.getTargetIndex(select, targetVal));
		});
	}.bind(child);
	child.uTO_i = 0;
	child.getTargetIndex = function(select, targetVal) {
		if(this.uTO_i >= select.options.length
		  || select.options[this.uTO_i].value !== targetVal) {

			for( this.uTO_i = 0; this.uTO_i < select.options.length; ++this.uTO_i) {
				if(select.options[this.uTO_i].value == targetVal) break;
			}
		}
		if(this.uTO_i >= select.options.length ) { console.log("WTF"); throw -69; }

		return this.uTO_i;
	}.bind(child);

	return child;
};


//----------------------------------------------------------------------------------------------------------------------------
/*   Responding to open/close/change events    */

// ** depends on tabbing impl
var page_select = document.getElementById("page_select");

var page_title_element = document.getElementById("page_title");
var page_title_container = new TitleTextContainer("page_title", "title", "page_title_error");

var page_content_element = document.getElementById("page_content");
var page_content_container = new ContentTextContainer("page_content", "content", "page_content_error");



var my_commandQueryEvent = new Event("my_commandQuery");
var my_beforechangeEvent = new Event("my_beforechange");
var my_afterchangeEvent  = new Event("my_afterchange");
var my_enableEvent  = new Event("my_enable");
var my_disableEvent  = new Event("my_disable");


var Nable = function() {
	return ( page_select.options[page_select.selectedIndex].id === "ps_empty" );
};

var potentialEvent = function() {
	if(eCR.turnt) {
		page_select.dispatchEvent(my_enableEvent);
		page_select.dispatchEvent(my_afterchangeEvent);
	} else {
		page_select.dispatchEvent(my_disableEvent);
	}
};

// TODO: look into onInput, blur, onPaste, onKeyDown (maybe not), etc
page_select.addEventListener("change", () => {
	if(eCR.invalid) {
		if(eCR.turnt) page_select.dispatchEvent(my_beforechangeEvent);

		eCR.update();

		potentialEvent();
	}
	// ** Technically unnecessary but kinda may as well
	// eCR.save();
});

document.addEventListener('DOMContentLoaded', async () => {
	// should i maybe do OO stuff and make a page_select object to handle the 'selectedness'?
	//   Is there a built-in for this? Also, keep previous selected one
	let prev_sel = browser.storage.local.get( ["previous_selector"] ).then( (val) => {
		return val["previous_selector"];
	});
	page_select.innerHTML = await constructEmptyTargetInnerHTML("<option value='-1' id='ps_empty' >&#9472;</option>");
	prev_sel = (await prev_sel);

	if(prev_sel != -1) {
		let i = 0;
		for(; i < page_select.length; ++i) {
			if(page_select.options[i].value == prev_sel.toString()) break;
		}
		if(i < page_select.length) page_select.selectedIndex = i;
	}	// Note: ALL of the above could almost certainly be done better
		//  by a CSS selector or however those things work. Actually, TODO

	// TODO TODO: Disable (potentially make not exist) buttons if select isn't selecting anything

	await eCR.load();
	eCR.update();

	potentialEvent();
});


// Blur seems to do slightly better than unload because it happens earlier
// TODO Someone explain to me WHY javascript feels the NEED to BE THIS WAY

//window.addEventListener("unload", async () => {
//var unload_nonsense = false;
window.addEventListener("unload", async (e) => {
	if(eCR.turnt) page_select.dispatchEvent(my_beforechangeEvent);

	await Promise.all([	//not like it matters I think
	browser.storage.local.set( {["previous_selector"] : page_select.options[page_select.selectedIndex].value } ),
	eCR.save()        ]);
	//unload_nonsense = true;
});

/*window.addEventListener("unload", async () => {
	if( ! unload_nonsense) {
		console.log("browser.localstorage may be slower than the unload process.");
	}
});*/

browser.runtime.onMessage.addListener(async (message) => {
	if(message.substring(0, 12) == "commandQuery") {

		// Check if the command in question is the one currently being edited
		if(document.getElementById("row_" + message.substring(12)).cells[2].children[0].value == page_select.value) {
			// HANDLE ALL the relevant things that may need saving
			// could probably check only if currently selected, either by saving or checking selected status, but eh
			// TODO: Either make async, or test to show self this is pointless optimization
			page_select.dispatchEvent(my_commandQueryEvent);

			await eCR.save();
		}

		browser.runtime.sendMessage("commandResponse").catch(err => {
			console.log("ERROR: Popup was told about command, but bkg won't accept response: " + err);
		});
	}
});
