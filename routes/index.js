var express = require('express');
var fs = require('fs');
var router = express.Router();

var getModFiles = function (currentPath) {
    var i, currentFile, stats,
        dirObj = {},
        files = fs.readdirSync(currentPath);

    for (i in files) {
        if (files[i] === '.DS_Store') {
            continue;
        }
        currentFile = currentPath + '/' + files[i];
        stats = fs.statSync(currentFile);
        if (stats.isFile()) {
            dirObj[files[i].replace('.mod','')] = {
                path: currentFile.substring(currentFile.indexOf('mods/')),
                size: stats.size
            };
        }
        else if (stats.isDirectory()) {
            dirObj[files[i]] = getModFiles(currentFile);
        }
    }
    return dirObj;
};
var modFiles = getModFiles(__dirname + '/../public/mods');

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', {
        helpers: {
            if_even: function(conditional, options) {
                if (conditional % 2 == 0) {
                    return options.fn(this);
                } else {
                    return options.inverse(this);
                }
            }
        },
        numMods: modFiles.length,
        modFiles: modFiles
    });
});

module.exports = router;
