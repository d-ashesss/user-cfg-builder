var sinon = require("sinon");
var assert = require("chai").assert;

var fs = require("fs-extra");
var isBinaryFile = require("isbinaryfile");

var Group = require("../src/group");

suite("Group", function() {
	var directory_stub;
	var file_stub;
	var binfile_stub;

	var readdirSync_stub;
	var readJsonSync_stub;
	var statSync_stub;
	var isBinaryFile_stub;

	setup(function() {
		directory_stub = sinon.createStubInstance(fs.Stats);
		directory_stub.isDirectory.returns(true);
		directory_stub.isFile.returns(false);
		directory_stub.mode = 755;
		file_stub = sinon.createStubInstance(fs.Stats);
		file_stub.isDirectory.returns(false);
		file_stub.isFile.returns(true);
		file_stub.mode = 644;
		binfile_stub = sinon.createStubInstance(fs.Stats);
		binfile_stub.isDirectory.returns(false);
		binfile_stub.isFile.returns(true);
		binfile_stub.mode = 755;

		readdirSync_stub = sinon.stub(fs, "readdirSync");
		readdirSync_stub.throws("Error");
		readJsonSync_stub = sinon.stub(fs, "readJsonSync");
		readJsonSync_stub.throws("Error");
		statSync_stub = sinon.stub(fs, "statSync");
		statSync_stub.throws("Error");
		isBinaryFile_stub = sinon.stub(isBinaryFile, "sync");
		isBinaryFile_stub.returns(false);

		readJsonSync_stub.withArgs("/test/single.json").returns({
			params: {param1: "value1", param2: "value2"},
			key: "value"
		});

		readdirSync_stub.withArgs("/test/single").returns(["testdir1", "testdir2", "testfile1", "testfile2", "binaryfile"]);
		statSync_stub.withArgs("/test/single").returns(directory_stub);
		statSync_stub.withArgs("/test/single/testfile1").returns(file_stub);
		statSync_stub.withArgs("/test/single/testfile2").returns(file_stub);
		statSync_stub.withArgs("/test/single/binaryfile").returns(binfile_stub);
		isBinaryFile_stub.withArgs("/test/single/binaryfile").returns(true);

		readdirSync_stub.withArgs("/test/single/testdir1").returns(["testfile1"]);
		statSync_stub.withArgs("/test/single/testdir1").returns(directory_stub);
		statSync_stub.withArgs("/test/single/testdir1/testfile1").returns(file_stub);

		readdirSync_stub.withArgs("/test/single/testdir2").returns(["testdir3"]);
		statSync_stub.withArgs("/test/single/testdir2").returns(directory_stub);

		readdirSync_stub.withArgs("/test/single/testdir2/testdir3").returns(["testfile1"]);
		statSync_stub.withArgs("/test/single/testdir2/testdir3").returns(directory_stub);
		statSync_stub.withArgs("/test/single/testdir2/testdir3/testfile1").returns(file_stub);

		readJsonSync_stub.withArgs("/test/multi_high.json").returns({
			params: {}, include: {
				multi_low: {param2: "value2x"}
			}
		});

		readdirSync_stub.withArgs("/test/multi_high").returns(["testfile1", "testfile2", "binaryfile"]);
		statSync_stub.withArgs("/test/multi_high").returns(directory_stub);
		statSync_stub.withArgs("/test/multi_high/testfile1").returns(file_stub);
		statSync_stub.withArgs("/test/multi_high/testfile2").returns(file_stub);
		statSync_stub.withArgs("/test/multi_high/binaryfile").returns(binfile_stub);
		isBinaryFile_stub.withArgs("/test/multi_high/binaryfile").returns(true);

		readJsonSync_stub.withArgs("/test/multi_low.json").returns({
			params: {param1: "value1", param2: "value2"},
			include: {}
		});

		readdirSync_stub.withArgs("/test/multi_low").returns(["testdir1", "testfile2", "testfile3", "binaryfile"]);
		statSync_stub.withArgs("/test/multi_low").returns(directory_stub);
		statSync_stub.withArgs("/test/multi_low/testfile2").returns(file_stub);
		statSync_stub.withArgs("/test/multi_low/testfile3").returns(file_stub);
		statSync_stub.withArgs("/test/multi_low/binaryfile").returns(binfile_stub);
		isBinaryFile_stub.withArgs("/test/multi_low/binaryfile").returns(true);

		readdirSync_stub.withArgs("/test/multi_low/testdir1").returns(["testfile1"]);
		statSync_stub.withArgs("/test/multi_low/testdir1").returns(directory_stub);
		statSync_stub.withArgs("/test/multi_low/testdir1/testfile1").returns(file_stub);
	});

	teardown(function() {
		fs.readdirSync.restore();
		fs.readJsonSync.restore();
		fs.statSync.restore();
		isBinaryFile.sync.restore();
	});

	test("getPath", function() {
		var g = new Group("single", "/test");
		assert.equal(g.getPath(), "/test/single");
	});

	test("getChildPath", function() {
		var g = new Group("single", "/test");
		assert.equal(g.getChildPath("sub"), "/test/single/sub");
	});

	test("getPath", function() {
		var g = new Group("single", "/test");
		assert.equal(g.getConfigPath(), "/test/single.json");
	});

	suite("loadConfig", function() {
		test("loads group config", function() {
			var g = new Group("single", "/test");
			assert.deepEqual(g.loadConfig(), {
				include: {},
				params: {param1: "value1", param2: "value2"},
				key: "value"
			});
		});

		test("handles non existing config file", function() {
			var g = new Group("nothing", "/test");
			assert.deepEqual(g.loadConfig(), {include: {}, params: {}});
		});
	});

	suite("readDir", function() {
		test("handles non existend directory", function() {
			var g = new Group("nothing", "/test");
			assert.deepEqual(g.readDir(), {});
		});

		test("reads directories", function() {
			var g = new Group("single", "/test");
			var contents = g.readDir();
			assert.isObject(contents["testdir1"]);
		});

		test("reads sub-directories", function() {
			var g = new Group("single", "/test");
			var contents = g.readDir();
			assert.isObject(contents["testdir2/testdir3"]);
		});

		test("sets directory flag on directories", function() {
			var g = new Group("single", "/test");
			var contents = g.readDir();
			assert.isTrue(contents["testdir1"].isDirectory);
		});

		test("reads directory mode", function() {
			var g = new Group("single", "/test");
			var contents = g.readDir();
			assert.equal(contents["testdir1"].mode, 755);
		});

		test("doesnt include source for directory", function() {
			var g = new Group("single", "/test");
			var contents = g.readDir();
			assert.isUndefined(contents["testdir1"].src);
		});

		test("reads files", function() {
			var g = new Group("single", "/test");
			var contents = g.readDir();
			assert.isObject(contents["testfile1"]);
		});

		test("reads files from sub-directories", function() {
			var g = new Group("single", "/test");
			var contents = g.readDir();
			assert.isObject(contents["testdir1/testfile1"]);
		});

		test("sets directory flag on files", function() {
			var g = new Group("single", "/test");
			var contents = g.readDir();
			assert.isFalse(contents["testfile1"].isDirectory);
		});

		test("reads file mode", function() {
			var g = new Group("single", "/test");
			var contents = g.readDir();
			assert.equal(contents["testfile1"].mode, 644);
			assert.equal(contents["binaryfile"].mode, 755);
		});

		test("includes source for file", function() {
			var g = new Group("single", "/test");
			var contents = g.readDir();
			assert.equal(contents["testfile1"].src, "/test/single/testfile1");
			assert.equal(contents["testdir2/testdir3/testfile1"].src, "/test/single/testdir2/testdir3/testfile1");
		});

		test("detects text files", function() {
			var g = new Group("single", "/test");
			var contents = g.readDir();
			assert.isFalse(contents["testfile1"].isBinary);
		});

		test("detects binary files", function() {
			var g = new Group("single", "/test");
			var contents = g.readDir();
			assert.isTrue(contents["binaryfile"].isBinary);
		});
	});

	suite("loadChildren", function() {
		test("loads included groups", function() {
			var g = new Group("multi_high", "/test");
			var children = g.loadChildren({multi_low: {}});
			assert.equal(children["multi_low"].name, "multi_low");
		});

		test("applies config params", function() {
			var g = new Group("multi_high", "/test");
			var children = g.loadChildren({multi_low: {param2: "value2x"}});
			assert.deepEqual(children["multi_low"].params, {param1: "value1", param2: "value2x"});
		});
	});

	suite("setParams", function() {
		test("extends params", function() {
			var g = new Group("single", "/test").load();
			g.setParams({param2: "value2x", param3: "value3"});
			assert.deepEqual(g.params, {param1: "value1", param2: "value2x", param3: "value3"});
		});

		test("default values not referenced", function() {
			var g1 = new Group("nothing1", "/test").load();
			var g2 = new Group("nothing2", "/test").load();
			g1.setParams({key: "value"});
			assert.deepEqual(g1.params, {key: "value"});
			assert.deepEqual(g2.params, {});
		});
	});

	suite("getFiles", function() {
		test("gets directories as object", function() {
			var g = new Group("single", "/test").load();
			var files = g.getFiles();
			assert.isObject(files["testdir1"]);
		});

		test("gets sub-directories", function() {
			var g = new Group("single", "/test").load();
			var files = g.getFiles();
			assert.isObject(files["testdir2/testdir3"]);
		});

		test("gets binary files as objects", function() {
			var g = new Group("single", "/test").load();
			var files = g.getFiles();
			assert.isObject(files["binaryfile"]);
		});

		test("gets text files as arrays", function() {
			var g = new Group("single", "/test").load();
			var files = g.getFiles();
			assert.isArray(files["testfile1"]);
		});

		test("adds parameters to text files", function() {
			var g = new Group("single", "/test").load();
			var files = g.getFiles();
			assert.deepEqual(files["testfile1"][0].params, {param1: "value1", param2: "value2"});
		});

		test("gets files from sub-directories", function() {
			var g = new Group("single", "/test").load();
			var files = g.getFiles();
			assert.isArray(files["testdir1/testfile1"]);
		});

		test("gets files from higher group", function() {
			var g = new Group("multi_high", "/test").load();
			var files = g.getFiles();
			assert.equal(files["testfile1"][0].src, "/test/multi_high/testfile1");
		});

		test("applies higher group params", function() {
			var g = new Group("multi_high", "/test").load();
			var files = g.getFiles();
			assert.deepEqual(files["testfile1"][0].params, {});
		});

		test("gets files from lower group", function() {
			var g = new Group("multi_high", "/test").load();
			var files = g.getFiles();
			assert.equal(files["testfile3"][0].src, "/test/multi_low/testfile3");
		});

		test("applies higher lower params", function() {
			var g = new Group("multi_high", "/test").load();
			var files = g.getFiles();
			assert.deepEqual(files["testfile3"][0].params, {param1: "value1", param2: "value2x"});
		});

		test("gets files from all groups in order from low to high", function() {
			var g = new Group("multi_high", "/test").load();
			var files = g.getFiles();
			assert.equal(files["testfile2"][0].src, "/test/multi_low/testfile2");
			assert.deepEqual(files["testfile2"][0].params, {param1: "value1", param2: "value2x"});
			assert.equal(files["testfile2"][1].src, "/test/multi_high/testfile2");
			assert.deepEqual(files["testfile2"][1].params, {});
		});

		test("replaces binary files by files from higher group", function() {
			var g = new Group("multi_high", "/test").load();
			var files = g.getFiles();
			assert.equal(files["binaryfile"].src, "/test/multi_high/binaryfile");
		});
	});
});
