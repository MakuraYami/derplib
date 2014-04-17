
// Derplib command file

var MM 		   = module.parent,
	commands = MM.plugin.load('commands'),
	utils 	       = MM.libary.load('utils'),
	DerpLib      = MM.parent,
	_                 = require('underscore');
 
commands.register({
	key: 'e',
	run: function(req){
		try{
			console.log(req.message.args.join(' '));
			var result = eval(req.message.args.join(' '));
			req.write('Eval: '+result);
		}catch(e){
			console.log(e.stack.split('\n').slice(0,4).join('\n'));
			req.write(utils.html_view(e.stack.split('\n').slice(0,2).join('')));
		}
	},
});
