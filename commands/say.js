
// Derplib command file

var MM 		   = module.parent,
	commands = MM.plugin.load('commands');
 
commands.register({
	key: 'say',
	run: function(req){
		req.write(req.message.args.join(' '));
	}
});
