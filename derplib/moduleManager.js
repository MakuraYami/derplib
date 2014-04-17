'use strict';
	//////////////
	// Requires //
var util 	= require("util"),
	events 	= require("events"),
	module 	= require("module"),
	_ 		= require("underscore");

	///////////////////
	// ModuleManager //
	
function ModuleManager() {
	
	this.parent;
	
	this._data = {
		libary: {
			dir: __dirname+'/',
			loaded: {},
			prot: ['ch_pm', 'ch_room', 'socket'],
		},
		plugin: { 
			dir: './plugins/',
			loaded: {},
			prot: [],
		},
	};
	
	var self = this;
	
	this.loadQueue = [];
	
	this.libary = {
		load: function(x){ return self._load(x, 'libary') },
		unload: function(x){ return self._unload(x, 'libary') },
		reload: function(x){ return self._reload(x, 'libary') },
		all: function(){ return self._data.libary.loaded; },
	};
	this.plugin = {
		load: function(x){ return self._load(x, 'plugin') },
		unload: function(x){ return self._unload(x, 'plugin') },
		reload: function(x){ return self._reload(x, 'plugin') },
		all: function(){ return self._data.plugin.loaded; },
	};
	
	// Handle events for plugins
	this.event = function(event, args, cb){
		
		var plugin_timeout = 2000,
			plugins = self._data.plugin.loaded,
			list = _.reduce(_.sortBy(plugins, function(x){ return x._order; }), function(list,x,y){ list.push(x._id); return list; }, []),
			cb_run = false;
		
		function next(){
			if(list.length === 0){
				cb_run = true;
				cb(args);
				return;
			}
			var current = list.shift();
			if(typeof plugins[current].exports[event] === "function"){
				var wait = plugins[current].exports[event](args, function(){
					if(cb_run) return;
					next();
				});
				if(wait !== false) next();
			}else{
				// This plugin does not have a handler for this event
				next();
			}
		}
		
		next();
		
		setTimeout(function(){
			if(!cb_run){
				cb_run = true;
				cb(args);
			}
		}, plugin_timeout);
	};
	
}

util.inherits(ModuleManager, events.EventEmitter);

	//////////
	// Load //

ModuleManager.prototype._load = function(mod, type) {
	if(mod.indexOf('/') > -1){
		var path = mod;
		mod = mod.split('/').pop().split('.').slice(0,-1).join('.');
	} 
	else var path = this._data[type].dir + mod + '.js';
	
	if(this._data[type].loaded.hasOwnProperty(mod)){
		return this._data[type].loaded[mod].exports;
	}
	// Load module object
	var _mod = this._data[type].loaded[mod] = new module.Module(path);
	// Set module data
	_mod.parent = this;
	_mod.exports.DerpLib = this.DerpLib;
	_mod.exports.setOrder = function(x){
		_mod._order = Math.max(0, x);
		return _mod.exports;
	};
	_mod._id = mod;
	_mod._order = 0;
	// Run the module
	_mod.load(path);
	
	_mod.exports.done = function(cb){
		_mod.exports.done = cb;
	}
	
	return _mod.exports;
};

	////////////
	// Unload //

ModuleManager.prototype._unload = function(mod, type) {
	if(this._data[type].prot.indexOf(mod) != -1)
		return false;
	
	var path = this._data[type].dir+mod+'.js';
	
	if(this._data[type].loaded.hasOwnProperty(path))
		delete this._data[type].loaded[path];
};

	////////////
	// Reload //

ModuleManager.prototype._reload = function(mod, type) {
	this.unload(mod, type);
	return this.load(mod, type);
};

ModuleManager.prototype.setParent = function(_parent) {
	this.parent = _parent;
}

	////////////
	// Export //
	
exports.instance = new ModuleManager();