var AppDispatcher = require('../react_actions/dispatcher');
var AppConstants = require('../react_actions/constants');
var EventEmitter = require('events').EventEmitter;
var _ = require('underscore');

// Define initial data points
var _instanceItems = [],
	_sortField = 'name',
	_sortOrder = 'ASC',
	_selectedItems = [],
	_editingData = {};

function loadInstanceItems(data, callback) {
	var params = {
		sortBy: _sortField,
		orderBy: _sortOrder,
		onlyRaw: 'y'
	};
	if(InstanceItemsStore.filter) {
		params.where = JSON.stringify(InstanceItemsStore.filter);
	}
	if(InstanceItemsStore.groupBy) {
		params.groupBy = JSON.stringify(InstanceItemsStore.groupBy);
	}
	var form = new FormData();
	Object.keys(params).map((key, index) => {
		if(typeof(params[key]) == 'object') {
			for(var i in params[key]) {
				form.append(key, params[key][i]);
			}
		} else {
			form.append(key, params[key]);
		}
	});
	fetch('/api/' + InstanceItemsStore.instanceName + '/get_items/', {
		method: 'post',credentials: 'include',
		body: form
	})
	.then(function(response) {
		return response.json();
	})
	.then(function(response) {
		console.log('loadInstanceItems response:', response);
		
		if(response.error) {
			document.getElementsByClassName('errors-holder')[0].innerHTML = response.error;
		} else {
			_instanceItems = response;
		}

		callback();
	});
}

function addInstanceItem(data, callback) {
	var form = new FormData();

	Object.keys(data.state).map((key, index) => {
		if(typeof(data.state[key]) == 'object') {
			for(var i in data.state[key]) {
				form.append(key, data.state[key][i]);
			}
		} else {
			form.append(key, data.state[key]);
		}
	});
	fetch('/api/' + InstanceItemsStore.instanceName + '/add_item/', {
		method: 'post',credentials: 'include',
		body: form
	})
	.then(function(response) {
		return response.json();
	})
	.then(function(response) {
		console.log('addInstanceItem response:', response);
		
		if(response.error) {
			document.getElementsByClassName('errors-holder')[0].innerHTML = response.error;
		} else {
			if(data.addCallback) {
				if(false === data.addCallback()) {
					return;
				}
			}
			loadInstanceItems(false, callback); // TODO: disable loading items if block option add_mode is true
		}
	});
}

function setOrder(order) {
		order = order.split('-');
		_sortField = order[0];
		_sortOrder = order[1].toUpperCase();
}

function setSelected(data) {
		var isSelected = data.isSelected || false,
			itemIndex = _selectedItems.indexOf(data.item);
		if(itemIndex >= 0 && !data.isSelected)
			_selectedItems.splice(itemIndex, 1);
		else if(data.isSelected)
			_selectedItems.push(data.item);
}

function deleteSelected(callback) {
	var form = new FormData();
	for (var i = 0; i < _selectedItems.length; i++) {
		form.append('selectedItems', _selectedItems[i]);
	}
	fetch('/api/' + InstanceItemsStore.instanceName + '/delete_items/', {
		method: 'post',credentials: 'include',
		body: form
	})
	.then(function(response) {
		return response.json();
	})
	.then(function(data) {
		loadInstanceItems(false, callback);
	});
}

function setEditingData(data) {
	console.log('setEditingData data Store', data);
	if(data.value) {
		// setting value
		if(data.isPlural) {
			if(!_editingData[data.code]) _editingData[data.code] = [];
			var foundIndex = _editingData[data.code].indexOf(data.value);
			if(foundIndex < 0) {
				if(data.checked) {
					_editingData[data.code].push(data.value);
				}
			} else if(!data.checked) {
				_editingData[data.code].splice(foundIndex, 1);
			}
		} else {
			_editingData[data.code] = data.value;
		}
	} else if(data.id) {
		// edit mode on
		_editingData = {id : data.id};
		// init editing data values
		_instanceItems.forEach(function(instanceItem){
			if(instanceItem.id == data.id) {
				_editingData = instanceItem;
			}
		});
	}
	console.log('_editingData from Store', _editingData);
}

function updateEditing(callback) {

	var keys = Object.keys(_editingData);
	if (keys.length == 1) { // only id, no data changed
		_editingData = {}; // exit editing mode
		callback();
		return;
	}

	var form = new FormData();
	Object.keys(_editingData).map((key, index) => {
		if(typeof(_editingData[key]) == 'object') {
			for(var i in _editingData[key]) {
				form.append(key, _editingData[key][i]);
			}
		} else {
			form.append(key, _editingData[key]);
		}
	});
	
	fetch('/api/' + InstanceItemsStore.instanceName + '/update_item/', {
		method: 'post',credentials: 'include',
		body: form
	})
	.then(function(response) {
		return response.json();
	})
	.then(function(updatedItem) {
		// we can update item locally without ajax request
		for(var key in _instanceItems) {
			if(_instanceItems[key].id == updatedItem.id) {
				Object.keys(updatedItem).map((fieldCode, index) => {
					_instanceItems[key][fieldCode] = updatedItem[fieldCode];
				});
				break;
			}
		}
		_editingData = {}; // exit editing mode
		callback();
	});
}

var InstanceItemsStore = _.extend({}, EventEmitter.prototype, {

	init: function(name, items, filter, groupBy) {
		this.instanceName = name;
		this.filter = filter;
		this.groupBy = groupBy;
		
		_instanceItems = items;
	},
	
	getInstanceItems: function() {
		return _instanceItems;
	},
	
	getOrder: function(order) {
		return _sortField + '-' + _sortOrder.toLowerCase();
	},
	
	getSelected: function() {
		return _selectedItems;
	},
	
	getEditingData: function() {
		return _editingData;
	},

	// Emit Change event
	emitChange: function() {
		this.emit('change');
	},


	// Add change listener
	addChangeListener: function(callback) {
		this.on('change', callback);
	},

	// Remove change listener
	removeChangeListener: function(callback) {
		this.removeListener('change', callback);
	}

});

// Register callback with AppDispatcher
AppDispatcher.register(function(payload) {
	var action = payload.action;
	var text;

	switch(action.actionType) {

		case AppConstants.RECEIVE_DATA:
			loadInstanceItems(action.data, function(){
				InstanceItemsStore.emitChange();
			});
			break;
			
		case AppConstants.ADD_DATA:
			addInstanceItem(action.data, function(){
				InstanceItemsStore.emitChange();
			});
			break;
			
		case AppConstants.SET_ORDER:
			setOrder(action.data);
			InstanceItemsStore.emitChange();
			break;
			
		case AppConstants.SET_SELECTED:
			setSelected(action.data);
			InstanceItemsStore.emitChange();
			break;
			
		case AppConstants.DELETE_DATA:
			deleteSelected(function(){
				InstanceItemsStore.emitChange();
			});
			break;
			
		case AppConstants.SET_EDITING_DATA:
			setEditingData(action.data);
			InstanceItemsStore.emitChange();
			break;
			
		case AppConstants.UPDATE_DATA:
			updateEditing(function(){
				InstanceItemsStore.emitChange();
			});
			break;

		default:
			return true;
			
	}

	return true;

});

module.exports = InstanceItemsStore;