"use strict"

// for command redirection; see below
let connection_port = browser.runtime.connect();


var ctopMap = {};
var ptocMap = {};
var epPromises = browser.commands.getAll().then( (commands) => {
	let _epPromises = [];
	commands.forEach( (command) => {
		_epPromises.push(browser.storage.local.get(command.name + "_position").then( (val) => {
			let posi = parseInt(val[command.name + "_position"]);
			ctopMap[command.name] = posi;
			if( ! isNaN(posi) ) ptocMap[posi] = command;
			else ctopMap[command.name] = "";
		}) );
	});
	return Promise.all(_epPromises);
});

let commandNames = ( () => {
	let list = [];
	for(let i = 1; i < 11; ++i) {
		list.push("com" + (i % 10) );
	}
	return list;
})();		// So... I kept needing to get this,
// and for some reason browser.commands.getAll() doesn't work in unload

var ctopUnload = async function() {
	let _closePromises = [];
	commandNames.forEach( (commName) => {
		_closePromises.push( browser.storage.local.set({ [commName + "_position"] : ctopMap[commName] }) );
	});
	return Promise.all(_closePromises);
};

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
		shortcut: row.cells[1].children[0].value
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
		callback(table.rows[i].cells[3].children[0]);
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

var updownbutton = function(who, getTarget) {
	let commName = who.id.split('_').splice(-1)[0];
	let curr_row = who.parentNode.parentNode.parentNode.parentNode;
	let currentPosition = ctopMap[commName];
	let targetPosition = getTarget(curr_row, currentPosition);
	if(targetPosition == -1) return;

	let targCommand = ptocMap[targetPosition];
	ptocMap[targetPosition] = ptocMap[currentPosition]
	ptocMap[currentPosition] = targCommand;
	ctopMap[commName] = targetPosition;
	ctopMap[targCommand.name] = currentPosition;
};

var up_button_callback = function(e) {
	updownbutton(this, (curr_row, currentPosition) => {
		if(currentPosition == 1) return -1;

		curr_row.parentNode.insertBefore(curr_row, curr_row.previousElementSibling);

		let targetPosition = currentPosition - 1;
		return targetPosition;
	});
};

var down_button_callback = function(e) {
	updownbutton(this, (curr_row, currentPosition) => {
		if(currentPosition == curr_row.parentNode.children.length) return -1;

		curr_row.parentNode.insertBefore(curr_row.nextElementSibling, curr_row);

		let targetPosition = currentPosition + 1;
		return targetPosition;
	});
};

var delete_button_callback = async function(e) {
	let row = this.parentElement.parentElement.parentElement.parentElement;
	let rowI = row.rowIndex;
	let commName = row.id.substring(4);

	let i = ctopMap[commName] + 1;
	let length = Object.keys(ptocMap).length;
	for( ; i <= length ; ++i) {
		ptocMap[i - 1] = ptocMap[i];
		ctopMap[ptocMap[i - 1].name] = i - 1;
	}
	delete ptocMap[i-1];
	ctopMap[commName] = "";

	await Promise.all([
		browser.commands.update({
			name: commName,
			shortcut: ""
		}),
		browser.storage.local.set({
			[commName + "_position"]: "",
			[commName + "_cookieStoreId"]: "",
			[commName + "_pageHTML"]: ""
		})
	]);

	row.parentElement.removeChild(row);
};

var constructRow = function(newBody, selectHTML, targetHTML, command) {

	let commName = command.name;
	browser.storage.local.get( [ commName + "_cookieStoreId", commName + "_pageHTML" ]).then((content) => {
		let row = newBody.insertRow(newBody.length);
		row.id = "row_" + commName ;


		let cell_ledge = row.insertCell(0);
		cell_ledge.innerHTML = `<div class="table_sidebar"><span style="display: inline-block;"><button class="up_button" id="up_${commName}">↑</button><button class="down_button" id="down_${commName}">↓</button></span>&nbsp;<span style="display: inline-block;"><button class="delete_button" id="delet_${commName}">X</button></span></div>` ;
		cell_ledge.id = "ledge_cell_" + commName;
		cell_ledge.querySelector(".up_button").onclick = up_button_callback;
		cell_ledge.querySelector(".down_button").onclick = down_button_callback;
		cell_ledge.querySelector(".delete_button").onclick = delete_button_callback;


		let cell_shrct = row.insertCell(1);
		cell_shrct.innerHTML = "<input type='text' id='" + ("shrct_cell_" + commName) + "' value='" + command.shortcut + "' class='shortcut_input' >";
		cell_shrct.id = "chrct_cell_" + commName;

		let input = cell_shrct.children[0];
		input.saveShortcut = (function(shortcutString) {
			this.value = shortcutString;	// just to be sure
			shortcutSelectResponse.call(this);
		}).bind(input);	// this is called from shortcuts.js
		input.addEventListener("focus", shortcuts.onShortcutFocus.bind(input) );
		input.addEventListener("blur", shortcuts.onShortcutBlur.bind(input) );
		input.addEventListener("keydown", shortcuts.onShortcutChange );
		input.addEventListener("keyup", shortcuts.onShortcutChange );


		let cell_cntnr = row.insertCell(2);
		cell_cntnr.innerHTML = selectHTML;
		cell_cntnr.id = "cntnr_cell_" + commName;
		cell_cntnr.children[0].onchange = containerSelectResponse;

		cell_cntnr.children[0].selectedIndex = indexMap[ content[commName + "_cookieStoreId"] ] ;


		let cell_targt = row.insertCell(3);
		cell_targt.innerHTML = targetHTML;
		cell_targt.id = "targt_cell_" + commName;
		cell_targt.children[0].onchange = targetSelectResponse;

		let cellt = cell_targt.children[0];	// god i hate <select>
		for(let i = 0; i < cellt.options.length; ++i) {
			if(cellt.options[i].value === content[commName + "_pageHTML"]) {
				cellt.selectedIndex = i;
				break;
			}
		}
	});
};

var shrtAddErr = document.getElementById("shortcut_add_error");
var shrtAddRowButton = document.getElementById("add_row");

shrtAddRowButton.onmouseout = function(e) {
	if( shrtAddErr.classList.contains("shown")) shrtAddErr.classList.remove("shown");
};

var addRowButton = async function() {
	let commandsAll = await browser.commands.getAll();

	let body = this.parentElement.parentElement.parentElement.parentElement.tBodies[0];

	let commName = (() => {
		for(let i = 0; i < commandNames.length; ++i) {
			if(ctopMap[commandNames[i]] == "") return commandNames[i];
		}
		return "error";
	})();
	if(commName == "error") {
		let inputBB = shrtAddRowButton.getBoundingClientRect();
		shrtAddErr.style.left = `${ inputBB.left + inputBB.width / 2 }px`;
		if( ! shrtAddErr.classList.contains("shown")) shrtAddErr.classList.add("shown");

		// Also TODO: gray-out the button when it's full
		return;
	}

	commandsAll = await commandsAll;
	let command = commandsAll.filter( (el) => {
		return el.name == commName;
	} )[0];

	let position = Object.keys(ptocMap).length + 1;
	ptocMap[position] = command;
	ctopMap[commName] = position;

	await browser.storage.local.set({
		[commName + "_position"]: position.toString()
		// other two plus shortcut should be clear already
	});

	constructRow(body, await constructSelectHTML(), await constructTargetHTML(), command);
};
shrtAddRowButton.onclick = addRowButton;

var updateCommandTable = async function() {

	let table = document.getElementById("displayTable");
	table = table.tBodies[0];
	let newBody = document.createElement('tbody');

	Promise.all( [constructSelectHTML(), constructTargetHTML()]  ).then( (vals) => {
		const selectHTML = vals[0];
		const targetHTML = vals[1];

		for(let i = 1; ptocMap.hasOwnProperty(i); ++i) {
			constructRow(newBody, selectHTML, targetHTML, ptocMap[i]);
		}

		table.parentNode.replaceChild(newBody, table);
	});
}

browser.runtime.onMessage.addListener(async (message) => {
	if(message === "onRemoved") {
		updateCommandTable();
	}
});

document.addEventListener('DOMContentLoaded', async () => {
	await epPromises;	// ensure the tables are loaded
	updateCommandTable();	// TODO: Analyze loading time here
});

//----------------------------------------------------------------------------------------------------------------------------
/* Add/delete rows */




//----------------------------------------------------------------------------------------------------------------------------
/*   Add/Remove Page Tab    */

var removeSubmitResponse = async function(e) {
	e.preventDefault();

	if( Nable() ) return;	// TODO: Rename this and eCR

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


window.addEventListener("unload", async (e) => {
	if(eCR.turnt) page_select.dispatchEvent(my_beforechangeEvent);

	await ctopUnload();

	await Promise.all([	//not like it matters I think
		browser.storage.local.set( {["previous_selector"] : page_select.options[page_select.selectedIndex].value } ),
		eCR.save()
    ]);
});

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


//----------------------------------------------------------------------------------------------------------------------------
/*   Tab functionality    */

let getPaneFromTab = (li) => {
	let url = li.querySelector("a").href;
	url = url.substring(url.lastIndexOf ('#') + 1);
	return document.getElementById(url);
};

let tabPanes = document.getElementsByClassName("tabList");
for( const tabPane of tabPanes) {
	let tabList = tabPane.querySelectorAll("li")
	for( const li of tabList) {
		let pane = getPaneFromTab(li);
		li.addEventListener("click", (e) => {
			if(li.classList.contains("selected")) {
				e.stopPropagation();
				return;
			}
		});
		tabPane.addEventListener("click", (e) => {
			if(e.target == tabPane) return;
			if(e.target.parentNode == li) {
				li.className = "selected";
				pane.className = "tabbedDiv";
			} else {
				li.className = "";
				pane.className = "tabbedDiv hide";
			}
		});
	}
}
