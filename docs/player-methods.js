// playback controls
Modplayer.prototype.load = function(url) {};
Modplayer.prototype.stop = function() {};
Modplayer.prototype.play = function() {};
Modplayer.prototype.pause = function() {};
Modplayer.prototype.jump = function(step) {};
Modplayer.prototype.stopaudio = function(st) {};
// settings
Modplayer.prototype.setrepeat = function(rep) {};
Modplayer.prototype.setseparation = function(sep) {};
Modplayer.prototype.setautostart = function(st) {};
Modplayer.prototype.setamigamodel = function(amiga) {};
Modplayer.prototype.setfilter = function(f) {};
// playback info / song content accessors
Modplayer.prototype.patterndata = function(pn) {};
Modplayer.prototype.noteon = function(ch) {};
Modplayer.prototype.currentpattern = function() {};
Modplayer.prototype.currentsample = function(ch) {};
Modplayer.prototype.currentpattlen = function() {};
// ??? seems unused. relic of old E8x sync filter effects?
Modplayer.prototype.hassyncevents = function() {};
Modplayer.prototype.popsyncevent = function() {};
// playback internals
Modplayer.prototype.createContext = function() {}; // internal only???
Modplayer.prototype.mix = function(ape) {}; // used for liveaudio mixing? seems unused
