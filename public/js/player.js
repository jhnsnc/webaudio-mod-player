/*
  front end wrapper class for format-specific player classes
  (c) 2015 firehawk/tda
*/

// Emitter utility class that uses a DOM frag to handle event delegation
function Emitter() {
  var eventTarget = document.createDocumentFragment();

  Emitter.methods.forEach(function(method) {
    this[method] = eventTarget[method].bind(eventTarget);
  }, this);
}
Emitter.methods = ['addEventListener', 'dispatchEvent', 'removeEventListener'];


// the main Modplayer class
function Modplayer() {
  Emitter.call(this);

  this.supportedformats = ['mod', 's3m', 'xm'];

  this.url = '';
  this.format = 's3m';

  this.state = 'initializing..';
  this.request = null;

  this.loading = false;
  this.playing = false;
  this.paused = false;
  this.repeat = false;

  this.separation = 1;
  this.mixval = 8.0;

  this.amiga500 = false;

  this.filter = false;
  this.endofsong = false;

  this.autostart = false;
  this.bufferstodelay = 4; // adjust this if you get stutter after loading new song
  this.delayfirst = 0;
  this.delayload = 0;

  this.buffer = 0;
  this.mixerNode = 0;
  this.context = null;
  this.samplerate = 44100;
  this.bufferlen = 4096;

  this.chvu = new Float32Array(32);

  // format-specific player
  this.player = null;

  // read-only data from player class
  this.title = '';
  this.signature = '....';
  this.songlen = 0;
  this.channels = 0;
  this.patterns = 0;
  this.samplenames = new Array();
}


// load module from url into local buffer
Modplayer.prototype.load = function(url) {
  // try to identify file format from url and create a new
  // player class for it
  this.url=url;
  var ext=url.split('.').pop().toLowerCase().trim();
  if (this.supportedformats.indexOf(ext)==-1) {
    // unknown extension, maybe amiga-style prefix?
    ext=url.split('/').pop().split('.').shift().toLowerCase().trim();
    if (this.supportedformats.indexOf(ext)==-1) {
      // ok, give up
      return false;
    }
  }
  this.format=ext;

  switch (ext) {
    case 'mod':
      this.player=new Protracker();
      break;
    case 's3m':
      this.player=new Screamtracker();
      break;
    case 'xm':
      this.player=new Fasttracker();
      break;
  }

  // TODO: need to use events instead of this "state" property for messaging
  this.state="loading..";
  this.loading=true;
  // download the requested track
  this.request = new XMLHttpRequest();
  this.request.open("GET", this.url, true);
  this.request.responseType = "arraybuffer";
  var theModPlayer = this;
  this.request.onprogress = (oe) => {
    // TODO: need to use events instead of this "state" property for messaging
    theModPlayer.state="loading ("+Math.floor(100*oe.loaded/oe.total)+"%)..";
  };
  this.request.onload = () => {
    var buffer = new Uint8Array(this.request.response);
    // TODO: need to use events instead of this "state" property for messaging
    this.state="parsing..";
    // TODO: possibly change this synchronous parsing to an async/callback model?
    if (theModPlayer.player.parse(buffer)) {
      // copy static data from player
      theModPlayer.title=theModPlayer.player.title
      theModPlayer.signature=theModPlayer.player.signature;
      theModPlayer.songlen=theModPlayer.player.songlen;
      theModPlayer.channels=theModPlayer.player.channels;
      theModPlayer.patterns=theModPlayer.player.patterns;
      theModPlayer.filter=theModPlayer.player.filter;
      if (theModPlayer.context) theModPlayer.setfilter(theModPlayer.filter);
      theModPlayer.mixval=theModPlayer.player.mixval; // usually 8.0, though
      theModPlayer.samplenames=new Array(32)
      for(i=0;i<32;i++) theModPlayer.samplenames[i]="";
      if (theModPlayer.format=='xm' || theModPlayer.format=='it') {
        for(i=0;i<theModPlayer.player.instrument.length;i++) theModPlayer.samplenames[i]=theModPlayer.player.instrument[i].name;
      } else {
        for(i=0;i<theModPlayer.player.sample.length;i++) theModPlayer.samplenames[i]=theModPlayer.player.sample[i].name;
      }
      // TODO: need to use events instead of this "state" property for messaging
      theModPlayer.state="ready.";
      theModPlayer.loading=false;
      theModPlayer.dispatchEvent(new Event('ready'));
      if (theModPlayer.autostart) theModPlayer.play();
    } else {
      // TODO: need to use events instead of this "state" property for messaging
      theModPlayer.state="error!";
      theModPlayer.loading=false;
    }
  }
  this.request.send();
  return true;
}


// play loaded and parsed module with webaudio context
Modplayer.prototype.play = function() {
  if (this.loading) return false;
  if (this.player) {
    if (this.context==null) this.createContext();
    this.player.samplerate=this.samplerate;
    if (this.context) this.setfilter(this.player.filter);

    if (this.player.paused) {
      this.player.paused=false;
      return true;
    }

    this.endofsong=false;
    this.player.endofsong=false;
    this.player.paused=false;
    this.player.reset();
    this.player.flags=1+2;
    this.player.playing=true;
    this.playing=true;

    this.chvu=new Float32Array(this.player.channels);
    for(i=0;i<this.player.channels;i++) this.chvu[i]=0.0;

    this.dispatchEvent(new Event('play'));

    this.player.delayfirst=this.bufferstodelay;
    return true;
  } else {
    return false;
  }
}


// pause playback
Modplayer.prototype.pause = function() {
  if (this.player) {
    if (!this.player.paused) {
      this.player.paused=true;
    } else {
      this.player.paused=false;
    }
  }
}


// stop playback
Modplayer.prototype.stop = function() {
  this.paused=false;
  this.playing=false;
  if (this.player) {
    this.player.paused=false;
    this.player.playing=false;
    this.player.delayload=1;
  }
  this.dispatchEvent(new Event('stop'));
}


// stop playing but don't call callbacks
Modplayer.prototype.stopaudio = function(st) {
  if (this.player) {
    this.player.playing=st;
  }
}


// jump positions forward/back
Modplayer.prototype.jump = function(step) {
  if (this.player) {
    this.player.tick=0;
    this.player.row=0;
    this.player.position+=step;
    this.player.flags=1+2;
    if (this.player.position<0) this.player.position=0;
    if (this.player.position >= this.player.songlen) this.stop();
  }
  this.position=this.player.position;
  this.row=this.player.row;
}


// set whether module repeats after songlen
Modplayer.prototype.setrepeat = function(rep) {
  this.repeat=rep;
  if (this.player) this.player.repeat=rep;
}


// set stereo separation mode (0=standard, 1=65/35 mix, 2=mono)
Modplayer.prototype.setseparation = function(sep) {
  this.separation=sep;
  if (this.player) this.player.separation=sep;
}


// set autostart to play immediately after loading
Modplayer.prototype.setautostart = function(st) {
  this.autostart=st;
}


// set amiga model - changes lowpass filter state
Modplayer.prototype.setamigamodel = function(amiga) {
  if (amiga=="600" || amiga=="1200" || amiga=="4000") {
    this.amiga500=false;
    if (this.filterNode) this.filterNode.frequency.value=22050;
  } else {
    this.amiga500=true;
    if (this.filterNode) this.filterNode.frequency.value=6000;
  }
}


// amiga "LED" filter
Modplayer.prototype.setfilter = function(f) {
  if (f) {
    this.lowpassNode.frequency.value=3275;
  } else {
    this.lowpassNode.frequency.value=28867;
  }
  this.filter=f;
  if (this.player) this.player.filter=f;
}


// are there E8x sync events queued?
Modplayer.prototype.hassyncevents = function() {
  if (this.player) return (this.player.syncqueue.length != 0);
  return false;
}


// pop oldest sync event nybble from the FIFO queue
Modplayer.prototype.popsyncevent = function() {
  if (this.player) return this.player.syncqueue.pop();
}


// ger current pattern number
Modplayer.prototype.currentpattern = function() {
  if (this.player) return this.player.patternSequence[this.player.position];
}


// get current pattern in standard unpacked format (note, sample, volume, command, data)
// note: 254=noteoff, 255=no note
// sample: 0=no instrument, 1..255=sample number
// volume: 255=no volume set, 0..64=set volume, 65..239=ft2 volume commands
// command: 0x2e=no command, 0..0x24=effect command
// data: 0..255
Modplayer.prototype.patterndata = function(pn) {
  // TODO: should return a Note object rather than a Uint8Array?
  var i, c, patt;
  if (this.format=='mod') {
    patt=new Uint8Array(this.player.patternDataUnpacked[pn]);
    for(i=0; i<64; i++) { // each beat step
      for(c=0; c<this.player.channels; c++) { // each channel
        if (patt[i*5*this.channels+c*5+3]==0 && patt[i*5*this.channels+c*5+4]==0) {
          patt[i*5*this.channels+c*5+3]=0x2e;
        } else {
          patt[i*5*this.channels+c*5+3]+=0x37;
          if (patt[i*5*this.channels+c*5+3]<0x41) patt[i*5*this.channels+c*5+3]-=0x07;
        }
      }
    }
  } else if (this.format=='s3m') {
    patt=new Uint8Array(this.player.pattern[pn]);
    for(i=0;i<64;i++) for(c=0;c<this.player.channels;c++) {
      if (patt[i*5*this.channels+c*5+3]==255) patt[i*5*this.channels+c*5+3]=0x2e;
      else patt[i*5*this.channels+c*5+3]+=0x40;
    }
  } else if (this.format=='xm') {
    patt=new Uint8Array(this.player.pattern[pn]);
    for(i=0;i<this.player.patternlen[pn];i++) for(c=0;c<this.player.channels;c++) {
      if (patt[i*5*this.channels+c*5+0]<97)
        patt[i*5*this.channels+c*5+0]=(patt[i*5*this.channels+c*5+0]%12)|(Math.floor(patt[i*5*this.channels+c*5+0]/12)<<4);
      if (patt[i*5*this.channels+c*5+3]==255) patt[i*5*this.channels+c*5+3]=0x2e;
      else {
        if (patt[i*5*this.channels+c*5+3]<0x0a) {
          patt[i*5*this.channels+c*5+3]+=0x30;
        } else {
          patt[i*5*this.channels+c*5+3]+=0x41-0x0a;
        }
      }
    }
  }
  return patt;
}


// check if a channel has a note on
Modplayer.prototype.noteon = function(ch) {
  if (ch>=this.channels) return 0;
  return this.player.channel[ch].noteon;
}


// get currently active sample on channel
Modplayer.prototype.currentsample = function(ch) {
  if (ch>=this.channels) return 0;
  if (this.format=="xm" || this.format=="it") return this.player.channel[ch].instrument;
  return this.player.channel[ch].sample;
}


// get length of currently playing pattern
Modplayer.prototype.currentpattlen = function() {
  if (this.format=="mod" || this.format=="s3m") return 64;
  return this.player.patternlen[this.player.patternSequence[this.player.position]];
}


// create the web audio context
Modplayer.prototype.createContext = function() {
  if ( typeof AudioContext !== 'undefined') {
    this.context = new AudioContext();
  } else {
    this.context = new webkitAudioContext();
  }
  this.samplerate=this.context.sampleRate;
  this.bufferlen=(this.samplerate > 44100) ? 4096 : 2048;

  // Amiga 500 fixed filter at 6kHz. WebAudio lowpass is 12dB/oct, whereas
  // older Amigas had a 6dB/oct filter at 4900Hz.
  this.filterNode=this.context.createBiquadFilter();
  if (this.amiga500) {
    this.filterNode.frequency.value=6000;
  } else {
    this.filterNode.frequency.value=22050;
  }

  // "LED filter" at 3275kHz - off by default
  this.lowpassNode=this.context.createBiquadFilter();
  this.setfilter(this.filter);

  // mixer
  if ( typeof this.context.createJavaScriptNode === 'function') {
    this.mixerNode=this.context.createJavaScriptNode(this.bufferlen, 1, 2);
  } else {
    this.mixerNode=this.context.createScriptProcessor(this.bufferlen, 1, 2);
  }
  this.mixerNode.module=this;
  this.mixerNode.onaudioprocess=Modplayer.prototype.mix.bind(this);

  // patch up some cables :)
  this.mixerNode.connect(this.filterNode);
  this.filterNode.connect(this.lowpassNode);
  this.lowpassNode.connect(this.context.destination);
}


// scriptnode callback - pass through to player class
Modplayer.prototype.mix = function(ape) { // NOTE: ape = AudioProcessEvent
  if (this.player && this.delayfirst==0) {
    this.player.repeat=this.repeat;

    var useNewMixMethod = (this.format === 'mod');

    var outputBuffs=new Array(ape.outputBuffer.getChannelData(0), ape.outputBuffer.getChannelData(1));
    var buflen=ape.outputBuffer.length;
    // TODO: make this return values rather than assuming changes to params by reference
    var renderedBuffs;
    if (useNewMixMethod) {
      renderedBuffs = this.player.mix(this.player, outputBuffs, buflen);
    } else {
      this.player.mix(this.player, outputBuffs, buflen);
    }

    outputBuffs = Modplayer.applyStereoAndSoftClipping((useNewMixMethod ? renderedBuffs : outputBuffs), this.separation, this.mixval );

    // update playback position info
    this.row = this.player.row;
    this.position = this.player.position;
    this.speed = this.player.speed;
    this.bpm = this.player.bpm;
    this.endofsong = this.player.endofsong;

    if (this.player.filter != this.filter) {
      this.setfilter(this.player.filter);
    }

    if (this.endofsong && this.playing) this.stop();

    if (this.delayfirst>0) this.delayfirst--;
    this.delayload = 0; // why?

    // update this.chvu from player channel vu
    for(var i=0; i<this.player.channels; i++) {
      this.chvu[i] = 0.25*this.chvu[i] + 0.75*this.player.chvu[i];
      this.player.chvu[i] = 0.0;
    }
  }
}

Modplayer.applyStereoAndSoftClipping = function(buffs, separation, mixval) {
  if (buffs.length !== 2) { return null; }

  var t;
  for(var s=0, var len=buffs[0].length; s<len; s++) {
    // a more headphone-friendly stereo separation
    if (separation) {
      if (separation==2) { // mono
        t = 0.5 * (buffs[0][s] + buffs[1][s]);
        buffs[0][s] = buffs[1][s] = t;
      } else { // narrow stereo
        t = buffs[0][s];
        buffs[0][s] = 0.65*buffs[0][s] + 0.35*buffs[1][s];
        buffs[1][s] = 0.65*buffs[1][s] + 0.35*t;
      }
    }

    // scale down and soft clip
    buffs[0][s] /= mixval;
    buffs[0][s] = 0.5*(Math.abs(buffs[0][s]+0.975) - Math.abs(buffs[0][s]-0.975));
    buffs[1][s] /= mixval;
    buffs[1][s] = 0.5*(Math.abs(buffs[1][s]+0.975) - Math.abs(buffs[1][s]-0.975));
  }

  return buffs;
}
