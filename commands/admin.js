
// Derplib command file

var MM 		    = module.parent,
	DerpLib     = MM.parent,
	commands    = MM.plugin.load('commands'),
	db		    = MM.plugin.load('database'),
	permissions = MM.plugin.load('permissions'),
	utils 	    = MM.libary.load('utils'),
	_		    = require('underscore'),
	request		= require('request');

commands.register({
	key: 'e',
	access: 10,
	run: function(req){
		try{
			var result = eval(req.message.args.join(' '));
			req.write('Eval: '+result);
		}catch(e){
			console.log(e.stack.split('\n').slice(0,4).join('\n'));
			req.write(utils.html_view(e.stack.split('\n').slice(0,2).join('')));
		}
	},
});

commands.register({
	key: 'save',
	access: 10,
	run: function(req){
		var start = new Date();
		MM.plugin.load('database').save(function(){
			req.write("Saving complete in "+((new Date() - start)/1000)+' seconds~');
		});
	}
});
