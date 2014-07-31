
// Derplib command file

var MM          = module.parent,
    commands    = MM.plugin.load('commands'),
    db          = MM.plugin.load('database'),
    permissions = MM.plugin.load('permissions'),
    utils       = MM.libary.load('utils'),
    DerpLib     = MM.parent,
    _           = require('underscore');
 
commands.register({
	key: 'help',
	access: 0,
	run: function(req){
		var list = _.sortBy(commands.get(), function(command){
			return command.key;
		});
		list = _.reduce(list, function(list, command){
			if(req.perm('cmd.'+command.key+'.run')){
				var cmd = command.key;
				if(command.subcommands.length > 0){
					var subs = [];
					_.each(command.subcommands, function(sub){
						subs.push(sub.key);
					});
					cmd += '('+subs.join(', ')+')';
				}
				list.push(cmd);
			}
			return list;
		}, []);
		var prefixes = db.get('commands.prefixes');
		
		req.write('My prefix: ' + prefixes.join(', ') + " My commands are: " + list.join(', '));
	},
});
