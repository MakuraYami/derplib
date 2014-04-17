"use strict";
// Require modules
var util	= require('util'),
	events 	= require('events'),
	colors 	= require('colors'),
	_		= require('underscore');

// Module Manager
var MM = module.parent;

function EventModule(){
	events.EventEmitter.call(this);
	
	var self = this;
	
	this.on("event", function(){
		var args = Array.prototype.slice.call(arguments);
		var event = args.shift();
		MM.event(event, args, function(result){
			result.unshift(event);
			if("function" === typeof result[result.length-1])
				result[result.length-1].apply(self, result.slice(1,result.length-1));
			self.emit.apply(self, result);
		});
	});
	
}

util.inherits(EventModule, events.EventEmitter);

module.exports = new EventModule();

