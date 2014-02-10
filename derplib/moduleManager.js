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
	
	var self = this;
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
		speech: {
			dir: './speech/',
			loaded: {},
			prot: [],
		},
	};
	
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
	this.speech = {
		load: function(x){ return self._load(x, 'speech') },
		unload: function(x){ return self._unload(x, 'speech') },
		reload: function(x){ return self._reload(x, 'speech') },
		all: function(){ return self._data.speech.loaded; },
	};
	
	this.plugin.load('default_plugin');
	this._data.plugin.loaded.default_plugin._order = -1;
	
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
	
	var self = this;
	this._data[type].loaded[mod] = new module.Module(path);
	this._data[type].loaded[mod].parent = this;
	this._data[type].loaded[mod].load(path);
	this._data[type].loaded[mod]._id = mod;
	this._data[type].loaded[mod]._order = 0;
	this._data[type].loaded[mod].exports.setOrder = function(x){
		self._data[type].loaded[mod]._order = Math.max(0, x);
		return self._data[type].loaded[mod].exports;
	};
	return this._data[type].loaded[mod].exports;
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

	////////////
	// Export //
	
var moduleManager = new ModuleManager();
exports.instance = moduleManager;