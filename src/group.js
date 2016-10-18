"use strict";

var _ = require("underscore");
var fs = require("fs-extra");
var isBinaryFile = require("isbinaryfile");
var path = require("path");

exports = module.exports = Group;

function Group(name, configPath) {
	this.name = name;
	this.configPath = configPath;

	this.include = {};
	this.params = {};
	this.files = {};
	this.children = {};
}

Group.prototype = {
	name: "",
	include: null,
	params: null,
	files: null,
	children: null,

	load: function() {
		var config = this.loadConfig();
		this.include = config.include;
		this.params = config.params;

		this.files = this.readDir();
		this.children = this.loadChildren(this.include);
		return this;
	},

	getPath: function() {
		return path.join(this.configPath, this.name);
	},

	getChildPath: function(childName) {
		return path.join(this.getPath(), childName);
	},

	getConfigPath: function() {
		return this.getPath() + ".json";
	},

	loadConfig: function() {
		var config = {};
		try {
			config = fs.readJsonSync(this.getConfigPath());
		} catch (e) {
		}
		return _.defaults(config, {
			include: {},
			params: {}
		});
	},

	setParams: function(params) {
		this.params = _.extend(this.params, params);
	},

	readDir: function(name, files) {
		if (typeof name === "undefined") {
			name = "";
		}
		if (typeof files === "undefined") {
			files = {};
		}
		var filePath = this.getChildPath(name);
		try {
			var stat = fs.statSync(filePath);
		} catch (e) {
			return {};
		}
		if (stat.isDirectory()) {
			if (name !== "") {
				files[name] = {
					mode: stat.mode,
					isDirectory: true
				};
			}
			return _.reduce(fs.readdirSync(filePath), function(files, sub) {
				var subPath = path.join(name, sub);
				return this.readDir(subPath, files);
			}, files, this);
		}

		files[name] = {
			src: filePath,
			mode: stat.mode,
			isBinary: isBinaryFile.sync(filePath),
			isDirectory: false
		};
		return files;
	},

	loadChildren: function(childrenParams) {
		return _.reduce(childrenParams, function(children, params, name) {
			var child = (new Group(name, this.configPath)).load();
			child.setParams(params);
			children[child.name] = child;
			return children;
		}, {}, this);
	},

	getFiles: function() {
		// var files = {};
		var files = _.reduce(this.children, function(files, child) {
			return _.extend(files, child.getFiles());
		}, {});
		return _.reduce(this.files, function(files, fileStat, fileName) {
			// if (typeof files[file] === "undefined" || typeof files[file] === "string") {
			if (!_.isArray(files[fileName])) {
				files[fileName] = [];
			}
			// var filePath = this.getChildPath(file);
			if (fileStat.isDirectory) {
				files[fileName] = _.extend({}, fileStat);
			} else if (fileStat.isBinary) {
				files[fileName] = _.extend({}, fileStat);
			} else {
				files[fileName].push(_.extend({}, fileStat, {
					params: this.params
				}));
			}
			return files;
		}, files, this);
	}
};
