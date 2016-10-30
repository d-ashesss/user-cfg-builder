"use strict";

var _ = require("underscore");
var child_process = require("child_process");
var fs = require("fs-extra");
var path = require("path");

var Group = require("./group");

exports = module.exports = Builder;

function Builder(configPath) {
	this.configPath = configPath;
}

Builder.prototype = {
	configPath: ".",

	updateConfig: function(repoPath) {
		var gitDir = path.join(this.configPath, '.git');
		if (fs.existsSync(this.configPath) && fs.existsSync(gitDir)) {
			try {
				child_process.execFileSync("/usr/bin/env", [
					"git", "pull"
				], {
					cwd: this.configPath,
					encoding: "utf8"
				});
			} catch (e) {
			}
		} else if (repoPath !== null) {
			try {
				child_process.execFileSync("/usr/bin/env", [
					"git", "clone", repoPath, this.configPath
				], {
					encoding: "utf8"
				});
			} catch (e) {
			}
		}
	},

	build: function(dstPath, groupName) {
		var group = (new Group(groupName, this.configPath)).load();
		var files = group.getFiles();
		_.each(files, function(source, file) {
			try {
				var filePath = path.join(dstPath, file);
				this.processFile(filePath, source);
			} catch (e) {
				console.error(e.message);
			}
		}, this);
	},

	processFile: function(filePath, source) {
		if (_.isObject(source) && source.isDirectory) {
			fs.mkdirsSync(filePath);
			fs.chmodSync(filePath, source.mode);
			return;
		}

		var directory = path.dirname(filePath);
		fs.mkdirsSync(directory);

		if (_.isObject(source) && source.isBinary) {
			console.log("Creating", filePath);
			fs.copySync(source.src, filePath);
			fs.chmodSync(filePath, source.mode);
			return;
		} else if (!_.isArray(source) || source.length === 0) {
			return;
		}

		var contents = _.reduce(source, function(contents, source) {
			var template = _.template(fs.readFileSync(source.src, {encoding: "utf8"}));
			contents.push(template(source.params));
			return contents;
		}, []).join("\n");

		// if exists show diff
		if (fs.existsSync(filePath)) {
			console.log("Updating", filePath);
			var diff = child_process.spawnSync("/usr/bin/env", [
				"diff", "--expand-tabs", "--ignore-all-space", "--ignore-blank-lines", filePath, "-"
			], {
				encoding: "utf8",
				input: contents
			});
			diff.stdout.length > 0 && console.log(diff.stdout.trim());
		} else {
			console.log("Creating", filePath);
		}

		fs.writeFileSync(filePath, contents);
		var mode = _.reduce(source, function(mode, source) {
			return source.mode || mode;
		}, 420); // default is 0644
		fs.chmodSync(filePath, mode);
	}
};
