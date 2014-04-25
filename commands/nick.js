
// Derplib command file

var MM 		   = module.parent,
	commands = MM.plugin.load('commands');
 
commands.register({
	key: 'nick',
	access: 1,
	run: function(req){
		if(req.message.args.length > 0){
			req.user.data.nickname = req.message.args[0];
			req.write("Your nickname is now "+req.user.data.nickname);
		}else{
			req.write('Your nickname is '+req.user.data.nickname);
		}
	}
});