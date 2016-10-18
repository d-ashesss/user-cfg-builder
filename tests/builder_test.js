var sinon = require("sinon");
var assert = require("chai").assert;

var child_process = require("child_process");
var fs = require("fs-extra");

var Builder = require("../src/builder");

suite("Builder", function() {
	var executionLog;

	var copySync_stub;
	var mkdirsSync_stub;
	var chmodSync_stub;
	var readFileSync_stub;
	var existsSync_stub;
	var writeFileSync_stub;

	var spawnSync_stub;
	var log_stub;

	setup(function() {
		executionLog = "";

		copySync_stub = sinon.stub(fs, "copySync");
		mkdirsSync_stub = sinon.stub(fs, "mkdirsSync");
		chmodSync_stub = sinon.stub(fs, "chmodSync");
		readFileSync_stub = sinon.stub(fs, "readFileSync");
		readFileSync_stub.returns("");
		existsSync_stub = sinon.stub(fs, "existsSync");
		existsSync_stub.returns(false);
		writeFileSync_stub = sinon.stub(fs, "writeFileSync");

		spawnSync_stub = sinon.stub(child_process, "spawnSync");
		spawnSync_stub.returns({stdout: ""});

		log_stub = sinon.stub(console, "log", function() {
			executionLog += [].slice.call(arguments).join(" ") + "\n";
		});
	});

	teardown(function() {
		fs.copySync.restore();
		fs.mkdirsSync.restore();
		fs.chmodSync.restore();
		fs.readFileSync.restore();
		fs.existsSync.restore();
		fs.writeFileSync.restore();

		child_process.spawnSync.restore();

		console.log.restore();
	});

	suite("processFile", function() {
		test("for directory source creates directory and changes mode", function() {
			var b = new Builder();
			b.processFile("/dst/subdir", {
				isDirectory: true,
				mode: 750
			});
			sinon.assert.calledWithExactly(mkdirsSync_stub, "/dst/subdir");
			sinon.assert.calledWithExactly(chmodSync_stub, "/dst/subdir", 750);
		});

		test("for file creates directory and doesnt change mode", function() {
			var b = new Builder();
			b.processFile("/dst/subdir/file", []);
			sinon.assert.calledWithExactly(mkdirsSync_stub, "/dst/subdir");
			sinon.assert.neverCalledWith(mkdirsSync_stub, "/dst/subdir/file");
			sinon.assert.notCalled(chmodSync_stub);
		});

		test("just copies binary source file and changes mode", function() {
			var b = new Builder();
			b.processFile("/dst/binaryfile", {
				src: "/src/binaryfile",
				isBinary: true,
				isDirectory: false,
				mode: 754
			});
			sinon.assert.calledWithExactly(copySync_stub, "/src/binaryfile", "/dst/binaryfile");
			sinon.assert.calledWithExactly(chmodSync_stub, "/dst/binaryfile", 754);
		});

		test("reads all text soruce files", function() {
			var b = new Builder();
			b.processFile("/dst/textfile", [{
				src: "/src/1/textfile",
				isBinary: false,
				isDirectory: false,
				mode: 644
			}, {
				src: "/src/2/textfile",
				isBinary: false,
				isDirectory: false,
				mode: 644
			}]);
			sinon.assert.calledWith(readFileSync_stub, "/src/1/textfile");
			sinon.assert.calledWith(readFileSync_stub, "/src/2/textfile");
		});

		test("if target file exists spawns diff process", function() {
			var b = new Builder();
			existsSync_stub.withArgs("/dst/textfile").returns(true);
			b.processFile("/dst/textfile", [{
				src: "/src/textfile",
				isBinary: false,
				isDirectory: false,
				mode: 644
			}]);
			assert.includeMembers(spawnSync_stub.getCall(0).args[1], ["diff", "/dst/textfile", "-"]);
		});

		test("if target file doesnt exist doesnt spawn diff process", function() {
			var b = new Builder();
			b.processFile("/dst/textfile", [{
				src: "/src/textfile",
				isBinary: false,
				isDirectory: false,
				mode: 644
			}]);
			sinon.assert.notCalled(spawnSync_stub);
		});

		test("writes source contents into target file", function() {
			var b = new Builder();
			readFileSync_stub.withArgs("/src/textfile").returns("Hello World");
			b.processFile("/dst/textfile", [{
				src: "/src/textfile",
				isBinary: false,
				isDirectory: false,
				mode: 644
			}]);
			sinon.assert.calledWithExactly(writeFileSync_stub, "/dst/textfile", "Hello World");
		});

		test("joins multipe source files", function() {
			var b = new Builder();
			readFileSync_stub.withArgs("/src/1/textfile").returns("Hello");
			readFileSync_stub.withArgs("/src/2/textfile").returns("World");
			b.processFile("/dst/textfile", [{
				src: "/src/1/textfile",
				isBinary: false,
				isDirectory: false,
				mode: 644
			},{
				src: "/src/2/textfile",
				isBinary: false,
				isDirectory: false,
				mode: 644
			}]);
			sinon.assert.calledWithExactly(writeFileSync_stub, "/dst/textfile", "Hello\nWorld");
		});

		test("runs source template substitution", function() {
			var b = new Builder();
			readFileSync_stub.withArgs("/src/textfile").returns("Hello <%= target %>");
			b.processFile("/dst/textfile", [{
				src: "/src/textfile",
				isBinary: false,
				isDirectory: false,
				mode: 644,
				params: {target: "World"}
			}]);
			sinon.assert.calledWithExactly(writeFileSync_stub, "/dst/textfile", "Hello World");
		});

		test("changes target file mode to the mode of last soruce", function() {
			var b = new Builder();
			b.processFile("/dst/textfile", [{
				src: "/src/1/textfile",
				isBinary: false,
				isDirectory: false,
				mode: 755
			},{
				src: "/src/2/textfile",
				isBinary: false,
				isDirectory: false,
				mode: 640
			}]);
			sinon.assert.calledWithExactly(chmodSync_stub, "/dst/textfile", 640);
		});
	});
});
